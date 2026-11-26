// One-time secure bootstrap. Run from this folder with a trusted Admin SDK identity.
// Legacy trusted-admin fallback only. The primary bootstrap is the owner-UID-restricted Cloudflare Worker endpoint.
// Usage (only if explicitly needed): GOOGLE_APPLICATION_CREDENTIALS=/secure/path/service-account.json node scripts/bootstrap_superadmins.js CtaXP0WGrFfusIKSsMFYP4ZKb6P2
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const OWNER_UID = 'CtaXP0WGrFfusIKSsMFYP4ZKb6P2';
const uid = String(process.argv[2] || '').trim();
if (!uid || uid !== OWNER_UID) throw new Error('Only the verified project owner UID is permitted for bootstrap.');
initializeApp({ credential: applicationDefault() });
const db = getFirestore();
const auth = getAuth();

(async () => {
  const user = await auth.getUser(uid);
  const systemRef = db.doc('system/bootstrap');
  const roleRef = db.doc(`userRoles/${uid}`);
  await db.runTransaction(async tx => {
    const systemSnap = await tx.get(systemRef);
    if (systemSnap.exists && systemSnap.data().firstSuperAdminUid) {
      throw new Error('Bootstrap already completed. Use an existing superadmin to appoint more admins.');
    }
    const roleSnap = await tx.get(roleRef);
    if (roleSnap.exists && roleSnap.data().role === 'superadmin' && roleSnap.data().active === true) {
      tx.set(systemRef, { firstSuperAdminUid: uid, bootstrappedAt: FieldValue.serverTimestamp() }, { merge: true });
      return;
    }
    tx.set(roleRef, {
      uid,
      email: user.email || '',
      role: 'superadmin',
      active: true,
      folderKeys: [],
      sectionKeys: [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      bootstrap: true
    });
    tx.set(systemRef, { firstSuperAdminUid: uid, bootstrappedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  process.stdout.write(`Superadmin role bootstrapped for ${user.email || uid}\n`);
  process.exit(0);
})().catch(error => { console.error(error); process.exit(1); });

