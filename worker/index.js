const PROJECT_ID = 'islamic-university-27d8f';
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const FIREBASE_KEYS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let cachedKeys = null;
let keysExpiry = 0;
function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store', ...extraHeaders
  }});
}
function cors() { return new Response(null, { status: 204, headers: {
  'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, HEAD, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Range, X-File-Size',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges'
}}); }
function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
function decodeJsonPart(value) { return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))); }
async function getFirebaseKeys() {
  if (cachedKeys && Date.now() < keysExpiry) return cachedKeys;
  const response = await fetch(FIREBASE_KEYS_URL);
  if (!response.ok) throw new Error('Firebase verification keys unavailable');
  cachedKeys = (await response.json()).keys || [];
  keysExpiry = Date.now() + 50 * 60 * 1000;
  return cachedKeys;
}
async function verifyFirebaseToken(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const header = decodeJsonPart(parts[0]);
  const payload = decodeJsonPart(parts[1]);
  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== 'RS256' || !header.kid || payload.aud !== PROJECT_ID ||
      payload.iss !== `https://securetoken.google.com/${PROJECT_ID}` || !payload.sub ||
      payload.exp <= now || payload.iat > now || payload.auth_time > now) throw new Error('Invalid token claims');
  const jwk = (await getFirebaseKeys()).find(key => key.kid === header.kid);
  if (!jwk) throw new Error('Unknown signing key');
  const publicKey = await crypto.subtle.importKey('jwk', jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey,
    decodeBase64Url(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!valid) throw new Error('Invalid token signature');
  return payload;
}
function firestoreValue(fields, name) {
  const v = fields?.[name];
  if (!v) return undefined;
  return v.stringValue ?? v.integerValue ?? v.booleanValue ?? v.doubleValue;
}
async function getFirestoreDocument(path, token) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
  const response = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) return null;
  return (await response.json()).fields || null;
}
function bearer(request) {
  const m = (request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}
async function authenticate(request) {
  const token = bearer(request);
  if (!token) return { error: json({ error: 'Authentication required' }, 401) };
  try { return { token, user: await verifyFirebaseToken(token) }; }
  catch { return { error: json({ error: 'Invalid Firebase authentication' }, 401) }; }
}
function validPath(path, uid, id) {
  return typeof path === 'string' && path.startsWith(`pending/${uid}/${id}/`) &&
    !path.includes('..') && !path.includes('\\') && path.length < 700;
}
async function uploadMedia(request, env, id) {
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(id)) return json({ error: 'Invalid media id' }, 400);
  const a = await authenticate(request); if (a.error) return a.error;
  const fields = await getFirestoreDocument(`mediaAssets/${encodeURIComponent(id)}`, a.token);
  if (!fields) return json({ error: 'Media record not found' }, 404);
  const owner = firestoreValue(fields, 'ownerUid');
  const status = firestoreValue(fields, 'status');
  const provider = firestoreValue(fields, 'storageProvider');
  const path = firestoreValue(fields, 'storagePath');
  if (owner !== a.user.sub || status !== 'pending' || provider !== 'cloudflare-r2' || !validPath(path, a.user.sub, id)) return json({ error: 'Upload not permitted' }, 403);
  const size = Number(request.headers.get('X-File-Size') || request.headers.get('Content-Length') || 0);
  if (!Number.isSafeInteger(size) || size <= 0) return json({ error: 'Valid file size is required' }, 411);
  if (size > MAX_FILE_SIZE) return json({ error: 'File exceeds 100 MB limit' }, 413);
  if (!request.body) return json({ error: 'Upload body is empty' }, 400);
  let actualSize = 0;
  const limitedBody = request.body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      actualSize += chunk.byteLength;
      if (actualSize > MAX_FILE_SIZE || actualSize > size) throw new Error('Upload size exceeds declared limit');
      controller.enqueue(chunk);
    },
    flush() {
      if (actualSize !== size) throw new Error('Uploaded size does not match declared size');
    }
  }));
  try {
    await env.MY_BUCKET.put(path, limitedBody, {
      httpMetadata: { contentType: request.headers.get('Content-Type') || 'application/octet-stream', cacheControl: 'private, no-store' },
      customMetadata: { mediaId: id, ownerUid: a.user.sub, status: 'pending' }
    });
    return json({ success: true, mediaId: id, status: 'pending', size: actualSize });
  } catch (e) { return json({ error: 'R2 upload failed', detail: String(e?.message || '').slice(0, 180) }, 500); }
}
function parseRange(value, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(value || ''); if (!m) return null;
  let start, end;
  if (m[1] === '') { const suffix = Number(m[2]); if (!suffix) return null; start = Math.max(0, size - suffix); end = size - 1; }
  else { start = Number(m[1]); end = m[2] ? Number(m[2]) : size - 1; }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= size) return null;
  end = Math.min(end, size - 1); return { start, end, length: end - start + 1 };
}
async function serveMedia(request, env, id) {
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(id)) return json({ error: 'Invalid media id' }, 400);
  const fields = await getFirestoreDocument(`mediaAssets/${encodeURIComponent(id)}`, null);
  if (!fields) return json({ error: 'Media not found' }, 404);
  const status = firestoreValue(fields, 'status');
  const provider = firestoreValue(fields, 'storageProvider');
  const path = firestoreValue(fields, 'storagePath');
  const owner = firestoreValue(fields, 'ownerUid');
  if (status !== 'approved' || provider !== 'cloudflare-r2' || !validPath(path, owner, id)) return json({ error: 'Media is not approved' }, 403);
  const object = await env.MY_BUCKET.head(path);
  if (!object) return json({ error: 'File not found' }, 404);
  const headers = new Headers(); object.writeHttpMetadata(headers);
  headers.set('Accept-Ranges', 'bytes'); headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Cache-Control', 'public, max-age=300'); headers.set('Content-Length', String(object.size));
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
  const rangeHeader = request.headers.get('Range');
  if (rangeHeader) {
    const r = parseRange(rangeHeader, object.size);
    if (!r) { headers.set('Content-Range', `bytes */${object.size}`); return new Response(null, { status: 416, headers }); }
    const part = await env.MY_BUCKET.get(path, { range: { offset: r.start, length: r.length } });
    if (!part) return json({ error: 'File not found' }, 404);
    headers.set('Content-Range', `bytes ${r.start}-${r.end}/${object.size}`); headers.set('Content-Length', String(r.length));
    return new Response(part.body, { status: 206, headers });
  }
  const full = await env.MY_BUCKET.get(path);
  return full ? new Response(full.body, { status: 200, headers }) : json({ error: 'File not found' }, 404);
}
async function deleteMedia(request, env, id) {
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(id)) return json({ error: 'Invalid media id' }, 400);
  const a = await authenticate(request); if (a.error) return a.error;
  const fields = await getFirestoreDocument(`mediaAssets/${encodeURIComponent(id)}`, a.token);
  if (!fields) return json({ error: 'Media record not found' }, 404);
  const owner = firestoreValue(fields, 'ownerUid');
  const status = firestoreValue(fields, 'status');
  const provider = firestoreValue(fields, 'storageProvider');
  const path = firestoreValue(fields, 'storagePath');
  if (provider !== 'cloudflare-r2' || !validPath(path, owner, id)) return json({ error: 'Invalid media path' }, 400);
  const roleDoc = await getFirestoreDocument(`userRoles/${encodeURIComponent(a.user.sub)}`, a.token);
  const role = firestoreValue(roleDoc, 'role');
  const active = firestoreValue(roleDoc, 'active');
  const globalAdmin = (active === true || (role === 'superadmin' && active !== false)) && ['superadmin', 'admin'].includes(role);
  const allowed = (owner === a.user.sub && status === 'pending') || (globalAdmin && status === 'rejected');
  if (!allowed) return json({ error: 'Delete not permitted' }, 403);
  try { await env.MY_BUCKET.delete(path); return json({ success: true, mediaId: id, deleted: true }); }
  catch (e) { return json({ error: 'R2 delete failed', detail: String(e?.message || '').slice(0, 180) }, 500); }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url); const parts = url.pathname.split('/').filter(Boolean);
    if (request.method === 'OPTIONS') return cors();
    if (url.pathname === '/health' && request.method === 'GET') return json({ status: 'online', service: 'Mirath Islam Media' });
    if (parts.length === 2 && parts[0] === 'upload' && request.method === 'PUT') return uploadMedia(request, env, parts[1]);
    if (parts.length === 2 && parts[0] === 'media' && ['GET', 'HEAD'].includes(request.method)) return serveMedia(request, env, parts[1]);
    if (parts.length === 2 && parts[0] === 'media' && request.method === 'DELETE') return deleteMedia(request, env, parts[1]);
    return json({ error: 'Not found' }, 404);
  }
};
