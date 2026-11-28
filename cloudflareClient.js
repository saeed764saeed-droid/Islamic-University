// Cloudflare D1/R2 client compatibility layer for the existing React Native UI.
// This module communicates only with the Cloudflare Worker API.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE_URL = 'https://islamic-university-storage.saeed764saeed.workers.dev';
const TOKEN_KEY = 'mirath_cf_session_v1';
let token = null;
let currentUser = null;
const listeners = new Set();
let ready = null;

async function loadSession() {
  if (!ready) ready = (async () => {
    try { token = await AsyncStorage.getItem(TOKEN_KEY); if (token) { const response = await fetch(`${API_BASE_URL}/v1/auth/me`, {headers:{Authorization:`Bearer ${token}`}}); const r=await response.json(); if(!response.ok) throw new Error(r.error||'Session expired'); currentUser = withToken(r.user); } }
    catch (_) { token = null; currentUser = null; await AsyncStorage.removeItem(TOKEN_KEY).catch(()=>{}); }
    return currentUser;
  })();
  return ready;
}
async function api(path, options = {}) {
  await (ready || Promise.resolve());
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(typeof Blob !== 'undefined' && options.body instanceof Blob)) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const raw = String(data.error || data.message || '');
    // Hide implementation details if an older Worker deployment still returns raw crypto errors.
    if (/pbkdf2|iteration counts|derivebits|subtlecrypto|internal error/i.test(raw)) {
      throw new Error('د حسابونو خدمت کې تخنیکي ستونزه ده. مهرباني وکړئ لږ وروسته بیا هڅه وکړئ.');
    }
    throw new Error(raw || 'غوښتنه بشپړه نه شوه. بیا هڅه وکړئ.');
  }
  return data;
}
function notify() { listeners.forEach(fn => { try { fn(currentUser); } catch (_) {} }); }
export const auth = {
  get currentUser() { return currentUser; },
  async signOut() { await loadSession(); token = null; currentUser = null; await AsyncStorage.removeItem(TOKEN_KEY); notify(); }
};
export const db = { __cloudflare: true };
export function onAuthStateChanged(_auth, callback) {
  let active = true; loadSession().then(() => { if (active) callback(currentUser); });
  listeners.add(callback); return () => { active = false; listeners.delete(callback); };
}
async function authRequest(path, email, password) {
  await loadSession();
  const result = await api(path, { method: 'POST', body: JSON.stringify({ email: String(email).trim().toLowerCase(), password }) });
  token = result.token; currentUser = withToken(result.user); await AsyncStorage.setItem(TOKEN_KEY, token); notify();
  return { user: currentUser };
}
export const signInWithEmailAndPassword = (_auth,email,password) => authRequest('/v1/auth/login',email,password);
export const createUserWithEmailAndPassword = (_auth,email,password) => authRequest('/v1/auth/register',email,password);
export async function signOut(_auth) { return auth.signOut(); }
export async function sendEmailVerification() { return { success:true, note:'Email verification is not configured; password authentication is active.' }; }

function withToken(user){ return user ? {...user, getIdToken:async()=>token, reload:async()=>{}, emailVerified:true} : null; }
const ts = () => new Date().toISOString();
export const serverTimestamp = () => ({ __serverTimestamp: true, value: ts() });
export const documentId = () => '__name__';
export function collection(_db, ...segments) { return { kind:'collection', path:segments.join('/').replace(/^\/|\/$/g,'') }; }
export function doc(_db, ...segments) { return { kind:'document', path:segments.join('/').replace(/^\/|\/$/g,'') }; }
export function where(field, op, value) { return { type:'where', field, op, value }; }
export function orderBy(field, direction='asc') { return { type:'orderBy', field, direction }; }
export function limit(count) { return { type:'limit', count }; }
export function startAfter(snapshot) { return { type:'startAfter', id:snapshot?.id || snapshot }; }
export function query(ref, ...constraints) { return { ...ref, constraints }; }
function snapDoc(path, data) { const id = path.split('/').pop(); return { id, ref:{kind:'document',path}, exists:()=>data!==undefined&&data!==null, data:()=>data??undefined, get:(key)=>data?.[key] }; }
export async function getDoc(ref) { await loadSession(); const r=await api(`/v1/docs/${encodeURIComponent(ref.path)}`); return snapDoc(ref.path,r.exists?r.data:undefined); }
export async function getDocs(ref) { await loadSession(); const r=await api('/v1/query',{method:'POST',body:JSON.stringify({path:ref.path,constraints:ref.constraints||[]})}); const docs=(r.docs||[]).map(x=>snapDoc(x.path,x.data)); return {docs,empty:docs.length===0,size:docs.length,forEach:fn=>docs.forEach(fn)}; }
export async function setDoc(ref, data, options={}) { await loadSession(); return api(`/v1/docs/${encodeURIComponent(ref.path)}`,{method:'PUT',body:JSON.stringify({data,merge:!!options.merge})}); }
export async function deleteDoc(ref) { await loadSession(); return api(`/v1/docs/${encodeURIComponent(ref.path)}`,{method:'DELETE'}); }
export function onSnapshot(ref, next, error) {
  let active=true, last=''; const read=async()=>{try { const s=ref.kind==='document'?await getDoc(ref):await getDocs(ref); const signature=ref.kind==='document'?JSON.stringify(s.data()):JSON.stringify(s.docs.map(d=>[d.id,d.data()])); if(signature!==last){last=signature;if(active)next(s);} } catch(e){if(active&&error)error(e);} };
  read(); const timer=setInterval(read,5000); return ()=>{active=false;clearInterval(timer);};
}
export function getFunctions(){ return { __cloudflare:true }; }
export function httpsCallable(_functions,name){ return async data => ({data:await api(`/v1/call/${encodeURIComponent(name)}`,{method:'POST',body:JSON.stringify(data||{})})}); }
