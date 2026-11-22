
const PROJECT_ID = "islamic-university-27d8f";
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const FIREBASE_KEYS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

let cachedKeys = null;
let keysExpiry = 0;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store"
    }
  });
}

function cors() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, Range",
      "Access-Control-Expose-Headers":
        "Content-Length, Content-Range, Accept-Ranges"
    }
  });
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function decodeJsonPart(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function getFirebaseKeys() {
  if (cachedKeys && Date.now() < keysExpiry) return cachedKeys;

  const response = await fetch(FIREBASE_KEYS_URL);
  if (!response.ok) throw new Error("Firebase verification keys unavailable");

  const data = await response.json();
  cachedKeys = data.keys || [];
  keysExpiry = Date.now() + 50 * 60 * 1000;

  return cachedKeys;
}

async function verifyFirebaseToken(token) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token");

  const header = decodeJsonPart(parts[0]);
  const payload = decodeJsonPart(parts[1]);

  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Invalid token algorithm");
  }

  const now = Math.floor(Date.now() / 1000);

  if (
    payload.aud !== PROJECT_ID ||
    payload.iss !== `https://securetoken.google.com/${PROJECT_ID}` ||
    !payload.sub ||
    payload.exp <= now ||
    payload.iat > now ||
    payload.auth_time > now
  ) {
    throw new Error("Invalid or expired Firebase token");
  }

  const keys = await getFirebaseKeys();
  const jwk = keys.find(key => key.kid === header.kid);

  if (!jwk) throw new Error("Unknown signing key");

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    false,
    ["verify"]
  );

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );

  if (!valid) throw new Error("Invalid token signature");

  return payload;
}

function firestoreValue(fields, name) {
  const value = fields?.[name];
  if (!value) return undefined;

  return (
    value.stringValue ??
    value.integerValue ??
    value.booleanValue ??
    value.doubleValue
  );
}

async function getMediaDocument(mediaId, token) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}` +
    `/databases/(default)/documents/mediaAssets/${encodeURIComponent(mediaId)}`;

  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { headers });

  if (!response.ok) return null;

  const document = await response.json();
  return document.fields || null;
}

function getBearerToken(request) {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function validMediaPath(path, uid, mediaId) {
  return (
    typeof path === "string" &&
    path.startsWith(`pending/${uid}/${mediaId}/`) &&
    !path.includes("..") &&
    !path.includes("\\")
  );
}

async function uploadMedia(request, env, mediaId) {
  const token = getBearerToken(request);
  if (!token) return json({ error: "Authentication required" }, 401);

  let user;

  try {
    user = await verifyFirebaseToken(token);
  } catch {
    return json({ error: "Invalid Firebase authentication" }, 401);
  }

  const fields = await getMediaDocument(mediaId, token);

  if (!fields) {
    return json({ error: "Media record not found" }, 404);
  }

  const ownerUid = firestoreValue(fields, "ownerUid");
  const status = firestoreValue(fields, "status");
  const storagePath = firestoreValue(fields, "storagePath");

  if (
    ownerUid !== user.sub ||
    status !== "pending" ||
    !validMediaPath(storagePath, user.sub, mediaId)
  ) {
    return json({ error: "Upload not permitted" }, 403);
  }

  const size = Number(request.headers.get("Content-Length") || 0);

  if (!size) {
    return json({ error: "Content-Length is required" }, 411);
  }

  if (size > MAX_FILE_SIZE) {
    return json({ error: "File exceeds 100 MB limit" }, 413);
  }

  const contentType =
    request.headers.get("Content-Type") || "application/octet-stream";

  try {
    await env.MY_BUCKET.put(storagePath, request.body, {
      httpMetadata: {
        contentType,
        cacheControl: "private, no-store"
      },
      customMetadata: {
        mediaId,
        ownerUid: user.sub,
        status: "pending"
      }
    });

    return json({
      success: true,
      mediaId,
      status: "pending"
    });
  } catch {
    return json({ error: "R2 upload failed" }, 500);
  }
}

function parseRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value || "");
  if (!match) return null;

  let start;
  let end;

  if (match[1] === "") {
    const suffix = Number(match[2]);
    if (!suffix) return null;

    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }

  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return null;
  }

  end = Math.min(end, size - 1);
  return { start, end, length: end - start + 1 };
}

async function serveMedia(request, env, mediaId) {
  const fields = await getMediaDocument(mediaId, null);

  if (!fields) return json({ error: "Media not found" }, 404);

  const status = firestoreValue(fields, "status");
  const storagePath = firestoreValue(fields, "storagePath");
  const ownerUid = firestoreValue(fields, "ownerUid");

  if (
    status !== "approved" ||
    !validMediaPath(storagePath, ownerUid, mediaId)
  ) {
    return json({ error: "Media is not approved" }, 403);
  }

  const object = await env.MY_BUCKET.head(storagePath);
  if (!object) return json({ error: "File not found" }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);

  headers.set("Accept-Ranges", "bytes");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Cache-Control", "public, max-age=300");
  headers.set("Content-Length", String(object.size));

  if (request.method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }

  const rangeHeader = request.headers.get("Range");

  if (rangeHeader) {
    const range = parseRange(rangeHeader, object.size);

    if (!range) {
      headers.set("Content-Range", `bytes */${object.size}`);
      return new Response(null, { status: 416, headers });
    }

    const rangedObject = await env.MY_BUCKET.get(storagePath, {
      range: {
        offset: range.start,
        length: range.length
      }
    });

    if (!rangedObject) return json({ error: "File not found" }, 404);

    headers.set(
      "Content-Range",
      `bytes ${range.start}-${range.end}/${object.size}`
    );
    headers.set("Content-Length", String(range.length));

    return new Response(rangedObject.body, {
      status: 206,
      headers
    });
  }

  const fullObject = await env.MY_BUCKET.get(storagePath);
  if (!fullObject) return json({ error: "File not found" }, 404);

  return new Response(fullObject.body, {
    status: 200,
    headers
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);

    if (request.method === "OPTIONS") return cors();

    if (url.pathname === "/health" && request.method === "GET") {
      return json({ status: "online", service: "Mirath Islam Media" });
    }

    if (
      parts.length === 2 &&
      parts[0] === "upload" &&
      request.method === "PUT"
    ) {
      return uploadMedia(request, env, parts[1]);
    }

    if (
      parts.length === 2 &&
      parts[0] === "media" &&
      ["GET", "HEAD"].includes(request.method)
    ) {
      return serveMedia(request, env, parts[1]);
    }

    return json({ error: "Not found" }, 404);
  }
};
