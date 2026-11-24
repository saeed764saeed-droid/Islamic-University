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
  'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, HEAD, PUT, POST, DELETE, OPTIONS',
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
  // Pass the original request stream directly to R2. Wrapping it in TransformStream
  // can remove the stream's known-length metadata and cause R2.put() to fail.
  // The client-declared size is validated above; the upload endpoint is capped at 100 MB.
  try {
    if (!env.MY_BUCKET || typeof env.MY_BUCKET.put !== 'function') {
      throw new Error('R2 binding MY_BUCKET is missing from this Worker deployment');
    }
    await env.MY_BUCKET.put(path, request.body, {
      httpMetadata: { contentType: request.headers.get('Content-Type') || 'application/octet-stream', cacheControl: 'private, no-store' },
      customMetadata: { mediaId: id, ownerUid: a.user.sub, status: 'pending', declaredSize: String(size) }
    });
    return json({ success: true, mediaId: id, status: 'pending', size });
  } catch (e) {
    const detail = String(e?.message || e || 'Unknown R2 error').slice(0, 300);
    console.error('R2 upload failed', { mediaId: id, path, declaredSize: size, detail });
    return json({ error: 'R2 upload failed', detail }, 500);
  }
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

// ---------- Secure Firebase Admin REST bridge (no Firebase Functions / Blaze required) ----------
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
let serviceTokenCache = null;
let serviceTokenExpiry = 0;
const enc = new TextEncoder();
function b64url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function pemBytes(pem) {
  const body = String(pem).replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  return decodeBase64Url(body.replace(/\+/g, '-').replace(/\//g, '_'));
}
async function getServiceAccessToken(env) {
  if (serviceTokenCache && Date.now() < serviceTokenExpiry - 60000) return serviceTokenCache;
  let sa;
  try { sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT || ''); }
  catch { throw new Error('FIREBASE_SERVICE_ACCOUNT secret is missing or invalid JSON'); }
  if (!sa.client_email || !sa.private_key || sa.project_id !== PROJECT_ID) throw new Error('Firebase service account project/email/private key mismatch');
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64url(enc.encode(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit', aud: sa.token_uri || 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })));
  const unsigned = `${head}.${claim}`;
  const key = await crypto.subtle.importKey('pkcs8', pemBytes(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(unsigned));
  const assertion = `${unsigned}.${b64url(new Uint8Array(sig))}`;
  const response = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(`Google OAuth token exchange failed (${response.status})`);
  serviceTokenCache = data.access_token; serviceTokenExpiry = Date.now() + Number(data.expires_in || 3600) * 1000;
  return serviceTokenCache;
}
function fromFs(v) {
  if (!v || typeof v !== 'object') return v;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFs);
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {});
  if ('referenceValue' in v) return v.referenceValue;
  return v;
}
function fromFields(fields = {}) { return Object.fromEntries(Object.entries(fields).map(([k,v]) => [k, fromFs(v)])); }
function toFs(v) {
  if (v === null) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFs) } };
  if (v && typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k,x]) => [k,toFs(x)])) } };
  return { nullValue: null };
}
async function fsRequest(env, path, options = {}) {
  const token = await getServiceAccessToken(env);
  const response = await fetch(`${FIRESTORE_BASE}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const msg = data?.error?.message || `Firestore request failed (${response.status})`; const e = new Error(msg); e.status = response.status; throw e; }
  return data;
}
async function adminGet(env, collectionName, id) {
  try { const d = await fsRequest(env, `/${collectionName}/${encodeURIComponent(id)}`); return { name: d.name, fields: fromFields(d.fields || {}) }; }
  catch (e) { if (e.status === 404) return null; throw e; }
}
async function adminList(env, collectionName, limit = 500, orderField = null) {
  const body = { structuredQuery: { from: [{ collectionId: collectionName }], ...(orderField ? { orderBy: [{ field: { fieldPath: orderField }, direction: 'ASCENDING' }] } : {}), limit } };
  const rows = await fsRequest(env, ':runQuery', { method: 'POST', body: JSON.stringify(body) });
  return (Array.isArray(rows) ? rows : []).filter(x => x.document).map(x => ({ id: x.document.name.split('/').pop(), fields: fromFields(x.document.fields || {}) }));
}
async function commitWrites(env, writes) {
  if (!writes.length) return;
  await fsRequest(env, ':commit', { method: 'POST', body: JSON.stringify({ writes }) });
}
function fsDoc(collectionName, id, fields) { return { name: `${FIRESTORE_BASE}/${collectionName}/${encodeURIComponent(id)}`, fields: Object.fromEntries(Object.entries(fields).map(([k,v]) => [k,toFs(v)])) }; }
function updateWrite(collectionName, id, fields, transforms = []) {
  return { update: fsDoc(collectionName,id,fields), updateMask: { fieldPaths: Object.keys(fields) }, ...(transforms.length ? { updateTransforms: transforms } : {}) };
}
function serverTimestampTransform(fieldPath) { return { fieldPath, setToServerValue: 'REQUEST_TIME' }; }
function activeRole(row) { return row?.active === true || (row?.role === 'superadmin' && row?.active !== false); }
const ADMIN_DEFAULTS = { superadmin: ['upload','createContent','editContent','deleteContent','publish','manageUsers','manageLibrary','editSettings','viewAudit','review'], admin: ['upload','createContent','editContent','deleteContent','publish','manageLibrary','editSettings','viewAudit','review'], sectionAdmin: ['upload','createContent','editContent','review'], uploader: ['upload','createContent'], user: [] };
function hasAdminPermission(data, permission) {
  if (data.role === 'superadmin') return true;
  if (data.permissions && Object.prototype.hasOwnProperty.call(data.permissions, permission)) return data.permissions[permission] === true;
  return (ADMIN_DEFAULTS[data.role] || []).includes(permission);
}
async function getAdminActor(request, env) {
  const a = await authenticate(request); if (a.error) return { error: a.error };
  const row = await adminGet(env, 'userRoles', a.user.sub);
  if (!row || !activeRole(row.fields)) return { error: json({ error: 'دا حساب فعال اداري واک نه لري.' }, 403) };
  return { uid: a.user.sub, data: row.fields };
}
async function adminApi(request, env, action) {
  const actor = await getAdminActor(request, env); if (actor.error) return actor.error;
  const role = actor.data.role;
  const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
  if (action === 'listPendingLessons') {
    if (!hasAdminPermission(actor.data, 'review')) return json({ error: 'د درسونو د کتنې اجازه نشته.' },403);
    const global = ['superadmin','admin'].includes(role), sections = Array.isArray(actor.data.sectionKeys) ? actor.data.sectionKeys : [];
    if (!global && !sections.length) return json({ lessons: [] });
    const rows = await adminList(env,'pendingLessons',500);
    const lessons = rows.map(r => ({ id:r.id, item:r.fields.item || {}, ownerUid:r.fields.ownerUid || '', section:r.fields.section || '', folder:r.fields.folder || '', scopeKey:r.fields.scopeKey || '', status:r.fields.status || '', mediaIds:Array.isArray(r.fields.mediaIds)?r.fields.mediaIds:[], updatedAt:r.fields.updatedAt || null }))
      .filter(r => ['pending','admin_review'].includes(r.status) && (global || (r.status === 'pending' && sections.includes(r.section))))
      .sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
    return json({ lessons });
  }
  if (action === 'listUserRoles') {
    if (role !== 'superadmin') return json({ error: 'د ټولو حسابونو لېست یوازې ستر اډمین لیدلی شي.' },403);
    const rows = await adminList(env,'userRoles',500,'email');
    return json({ users: rows.map(r=>({ uid:r.id,email:r.fields.email||'',role:r.fields.role||'user',active:activeRole(r.fields),sectionKeys:Array.isArray(r.fields.sectionKeys)?r.fields.sectionKeys:[],folderKeys:Array.isArray(r.fields.folderKeys)?r.fields.folderKeys:[],permissions:r.fields.permissions&&typeof r.fields.permissions==='object'?r.fields.permissions:{},updatedAt:r.fields.updatedAt||null })) });
  }
  if (action === 'setUserRoleStatus') {
    if (role !== 'superadmin') return json({ error:'د حسابونو فعالول او بندول یوازې ستر اډمین کولی شي.' },403);
    const uid=String(body.uid||'').trim(), active=body.active;
    if (!uid || typeof active !== 'boolean') return json({ error:'UID او فعال/غیرفعال حالت اړین دی.' },400);
    const target=await adminGet(env,'userRoles',uid); if (!target) return json({error:'اداري حساب ونه موندل شو.'},404);
    if (target.fields.role==='superadmin' && active===false) {
      const all=await adminList(env,'userRoles',500); const count=all.filter(x=>x.fields.role==='superadmin' && activeRole(x.fields)).length;
      if (count<=1) return json({error:'وروستی فعال ستر اډمین نه شي بندېدای.'},409);
    }
    await commitWrites(env,[updateWrite('userRoles',uid,{active,updatedBy:actor.uid},[serverTimestampTransform('updatedAt')]), {update:fsDoc('auditLogs',`log_${Date.now()}_${crypto.randomUUID().slice(0,8)}`,{actorUid:actor.uid,action:active?'account_activated':'account_deactivated',target:uid,details:{email:target.fields.email||'',role:target.fields.role||''}}),updateTransforms:[serverTimestampTransform('createdAt')]}]);
    return json({success:true,uid,active});
  }
  if (action === 'setUserRoleByEmail') {
    if (role !== 'superadmin') return json({error:'د رول ټاکلو اجازه یوازې ستر اډمین لري.'},403);
    const email=String(body.email||'').trim().toLowerCase(), newRole=String(body.role||'');
    const validRoles=['superadmin','admin','sectionAdmin','uploader','user'];
    const active=body.active===undefined?true:body.active;
    const folderKeys=Array.isArray(body.folderKeys)?[...new Set(body.folderKeys.map(x=>String(x).trim()).filter(Boolean))]:[];
    const sectionKeys=Array.isArray(body.sectionKeys)?[...new Set(body.sectionKeys.map(x=>String(x).trim()).filter(Boolean))]:[];
    const permissionKeys=['upload','createContent','editContent','deleteContent','publish','manageUsers','manageLibrary','editSettings','viewAudit','review'];
    const permissions={};
    if (body.permissions && typeof body.permissions==='object') for (const [k,v] of Object.entries(body.permissions)) { if(!permissionKeys.includes(k)||typeof v!=='boolean') return json({error:'د اجازې نوم یا ارزښت ناسم دی.'},400); permissions[k]=v; }
    const validSections=['قرآن کریم او علوم القرآن','حدیث او علوم الحدیث','فقه او فروع','عقیده او توحید','اصول الفقه او قواعد','سیرت او شمائل نبوي ﷺ','اسلامي تاریخ او تمدن','د صحابه‌وو او علماوو ژوندلیکونه','عربي ژبه او ادبیات','اخلاق، تزکیه او سلوک','دعوت، تبلیغ او خطابت','فتاوی او معاصرې مسئلې','اسلامي زده کړې او درسي نصاب','دعاوې، اذکار او عبادتي لارښود','اسلام، کورنۍ او ټولنه','اسلام او معاصر علوم'];
    if(!email||!validRoles.includes(newRole)||typeof active!=='boolean') return json({error:'ایمیل، رول او فعال حالت سم وټاکئ.'},400);
    if(folderKeys.length>200||folderKeys.some(x=>x.length>300||!x.includes('::'))) return json({error:'د فولډر واک بڼه ناسمه ده.'},400);
    if(sectionKeys.length>10||sectionKeys.some(x=>!validSections.includes(x))) return json({error:'علمي برخه ناسمه ده.'},400);
    const uploadEnabled=permissions.upload===true||(permissions.upload===undefined&&['superadmin','admin','sectionAdmin','uploader'].includes(newRole));
    if(uploadEnabled&&!['superadmin','admin'].includes(newRole)&&!folderKeys.length&&!sectionKeys.length) return json({error:'اپلوډر ته لږ تر لږه یوه علمي برخه یا فولډر وټاکئ.'},400);
    if(['superadmin','admin'].includes(newRole)&&(folderKeys.length||sectionKeys.length)) return json({error:'ستر او عمومي اډمین ته ځانګړي فولډرونه مه ټاکئ.'},400);
    const oauth=await getServiceAccessToken(env);
    const lookup=await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}:queryAccounts`,{method:'POST',headers:{Authorization:`Bearer ${oauth}`,'Content-Type':'application/json'},body:JSON.stringify({expression:[{email}],returnUserInfo:true,limit:'1'})});
    const lookupData=await lookup.json().catch(()=>({})); const user=(lookupData.userInfo||[]).find(x=>String(x.email||'').toLowerCase()===email);
    if(!lookup.ok||!user) return json({error:'دا ایمیل په Firebase Authentication کې حساب نه لري.'},404);
    const previous=await adminGet(env,'userRoles',user.localId);
    if(previous?.fields.role==='superadmin'&&activeRole(previous.fields)&& (newRole!=='superadmin'||active===false)) {
      const all=await adminList(env,'userRoles',500); if(all.filter(x=>x.fields.role==='superadmin'&&activeRole(x.fields)).length<=1) return json({error:'وروستی ستر اډمین نه شي لرې کېدای.'},409);
    }
    const fields={uid:user.localId,email:user.email||email,role:newRole,active,folderKeys:['superadmin','admin'].includes(newRole)?[]:folderKeys,sectionKeys:['superadmin','admin'].includes(newRole)?[]:sectionKeys,permissions:newRole==='superadmin'?{}:permissions,updatedBy:actor.uid};
    const doc=fsDoc('userRoles',user.localId,fields);
    await commitWrites(env,[{update:doc,updateMask:{fieldPaths:Object.keys(fields)},updateTransforms:[serverTimestampTransform('updatedAt')]},{update:fsDoc('auditLogs',`log_${Date.now()}_${crypto.randomUUID().slice(0,8)}`,{actorUid:actor.uid,action:'role_assigned',target:user.localId,details:{email,oldRole:previous?.fields.role||null,newRole,active,folderKeys,sectionKeys,permissions}}),updateTransforms:[serverTimestampTransform('createdAt')]}]);
    return json({success:true,uid:user.localId,role:newRole});
  }
  if (action === 'reviewPendingLesson') {
    const lessonId=String(body.lessonId||''), decision=String(body.decision||'');
    if(!lessonId||!['forward','approve','reject'].includes(decision)) return json({error:'د درس پېژند او پرېکړه اړینه ده.'},400);
    const pending=await adminGet(env,'pendingLessons',lessonId); if(!pending) return json({error:'درس ونه موندل شو.'},404);
    const p=pending.fields, current=p.status;
    if(decision==='forward') {
      if(!hasAdminPermission(actor.data,'review')) return json({error:'د کتنې اجازه نشته.'},403);
      if(!Array.isArray(actor.data.sectionKeys)||!actor.data.sectionKeys.includes(p.section)) return json({error:'دا علمي برخه ستاسې په واک کې نه ده.'},403);
      if(current!=='pending') return json({error:'یوازې لومړنی انتظار درس لېږل کېدای شي.'},409);
      await commitWrites(env,[updateWrite('pendingLessons',lessonId,{status:'admin_review',sectionReviewedBy:actor.uid},[serverTimestampTransform('sectionReviewedAt')]),{update:fsDoc('auditLogs',`log_${Date.now()}_${crypto.randomUUID().slice(0,8)}`,{actorUid:actor.uid,action:'lesson_forwarded_to_admin',target:lessonId,details:{section:p.section,folder:p.folder}}),updateTransforms:[serverTimestampTransform('createdAt')]}]);
      return json({success:true,status:'admin_review'});
    }
    if(!['superadmin','admin'].includes(role)||!hasAdminPermission(actor.data,'publish')) return json({error:'وروستی تایید یوازې ستر اډمین او مجاز عمومي اډمین کولی شي.'},403);
    if(!['pending','admin_review'].includes(current)) return json({error:'درس د وروستۍ پرېکړې لپاره په مناسب حالت کې نه دی.'},409);
    if(role==='admin'&&current==='pending') { const sectionAdmins=await adminList(env,'userRoles',500); if(sectionAdmins.some(x=>x.fields.role==='sectionAdmin'&&activeRole(x.fields)&&Array.isArray(x.fields.sectionKeys)&&x.fields.sectionKeys.includes(p.section))) return json({error:'د دې برخې اډمین باید لومړی درس وڅېړي.'},409); }
    const ids=Array.isArray(p.mediaIds)?[...new Set(p.mediaIds.map(String))]:[];
    if(ids.length>50||ids.some(x=>!/^[A-Za-z0-9_-]{1,160}$/.test(x))) return json({error:'د فایلونو پېژندپاڼې ناسمې دي.'},400);
    const mediaRows=await Promise.all(ids.map(id=>adminGet(env,'mediaAssets',id)));
    if(mediaRows.some(x=>!x||x.fields.ownerUid!==p.ownerUid||x.fields.status!=='pending'||x.fields.storageProvider!=='cloudflare-r2'||typeof x.fields.storagePath!=='string'||!x.fields.storagePath.startsWith(`pending/${p.ownerUid}/`))) return json({error:'د درس یو یا څو فایلونه نیمګړي دي.'},409);
    const writes=[];
    if(decision==='approve') {
      const urls={};
      for(let i=0;i<ids.length;i++){const id=ids[i];urls[id]=`${new URL(request.url).origin}/media/${encodeURIComponent(id)}`;writes.push(updateWrite('mediaAssets',id,{status:'approved',downloadUrl:urls[id],storageProvider:'cloudflare-r2',reviewedBy:actor.uid},[serverTimestampTransform('reviewedAt')]));}
      const item=JSON.parse(JSON.stringify(p.item||{}));
      const replace=file=>{if(!file)return file;const uri=urls[file.mediaId],cover=urls[file.coverMediaId];return {...file,...(uri?{uri,reviewStatus:'approved'}:{}),...(cover?{coverUri:cover,coverReviewStatus:'approved'}:{})};};
      item.audioTracks=Array.isArray(item.audioTracks)?item.audioTracks.map(replace):[]; item.attachments=Array.isArray(item.attachments)?item.attachments.map(replace):[];
      const pdf=mediaRows.map(x=>x.fields).find(x=>x.mediaType==='pdf'); if(pdf?.mediaId&&urls[pdf.mediaId]&&typeof item.pdf==='string') item.pdf=urls[pdf.mediaId];
      if(item.pdfCoverMediaId&&urls[item.pdfCoverMediaId]){item.pdfCoverUri=urls[item.pdfCoverMediaId];item.pdfCoverReviewStatus='approved';}
      if(item.audioTracks.length)item.audio=item.audioTracks[0].uri; item.cloudReviewStatus='approved';
      const publishedId=String(p.item?.id||lessonId);
      writes.push({update:fsDoc('publishedLessons',publishedId,{item,ownerUid:p.ownerUid,section:p.section,folder:p.folder,scopeKey:p.scopeKey||`${p.section}::${p.folder}`,status:'approved',mediaIds,approvedBy:actor.uid}),updateTransforms:[serverTimestampTransform('approvedAt')]});
      writes.push(updateWrite('pendingLessons',lessonId,{status:'approved',reviewedBy:actor.uid},[serverTimestampTransform('reviewedAt')]));
    } else {
      for(const id of ids) writes.push(updateWrite('mediaAssets',id,{status:'rejected',reviewedBy:actor.uid},[serverTimestampTransform('reviewedAt')]));
      writes.push(updateWrite('pendingLessons',lessonId,{status:'rejected',reviewedBy:actor.uid},[serverTimestampTransform('reviewedAt')]));
    }
    writes.push({update:fsDoc('auditLogs',`log_${Date.now()}_${crypto.randomUUID().slice(0,8)}`,{actorUid:actor.uid,action:decision==='approve'?'lesson_published':'lesson_rejected',target:lessonId,details:{section:p.section,folder:p.folder,previousStatus:current}}),updateTransforms:[serverTimestampTransform('createdAt')]});
    await commitWrites(env,writes);
    return json({success:true,status:decision==='approve'?'approved':'rejected',cleanupMediaIds:decision==='reject'?ids:[]});
  }
  return json({error:'Unknown admin action'},404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url); const parts = url.pathname.split('/').filter(Boolean);
    if (request.method === 'OPTIONS') return cors();
    if (parts.length === 2 && parts[0] === 'admin' && request.method === 'POST') {
      try { return await adminApi(request, env, parts[1]); }
      catch (error) { console.error('Worker admin API failed', { action: parts[1], message: String(error?.message || error).slice(0, 300) }); return json({ error: 'د اداري سرور په عملیاتو کې ستونزه رامنځته شوه.', detail: String(error?.message || 'Unknown error').slice(0, 240) }, 500); }
    }
    if (url.pathname === '/health' && request.method === 'GET') return json({ status: 'online', service: 'Mirath Islam Media' });
    if (parts.length === 2 && parts[0] === 'upload' && request.method === 'PUT') return uploadMedia(request, env, parts[1]);
    if (parts.length === 2 && parts[0] === 'media' && ['GET', 'HEAD'].includes(request.method)) return serveMedia(request, env, parts[1]);
    if (parts.length === 2 && parts[0] === 'media' && request.method === 'DELETE') return deleteMedia(request, env, parts[1]);
    return json({ error: 'Not found' }, 404);
  }
};
