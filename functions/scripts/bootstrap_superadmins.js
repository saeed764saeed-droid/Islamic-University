 
// Secure one-time bootstrap for the two approved Super Admin accounts.
// Run from the functions folder using a trusted Firebase Admin SDK identity.

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const SUPERADMIN_UIDS = [
  'CtaXP0WGrFfusIKSsMFYP4ZKb6P2',
  'IsfYfWU6f4a9B4B7a9kg1zevGjw2'
];

const uid = String(process.argv[2] || '').trim();

if (!SUPERADMIN_UIDS.includes(uid)) {
  throw new Error('UID is not in the approved Super Admin list.');
}

initializeApp({ credential: applicationDefault() });

const db = getFirestore();
const auth = getAuth();

(async () => {
  const user = await auth.getUser(uid);

  const systemRef = db.doc('system/bootstrap');
  const roleRef = db.doc(`userRoles/${uid}`);

  await db.runTransaction(async tx => {
    const systemSnap = await tx.get(systemRef);
    const roleSnap = await tx.get(roleRef);

    const bootstrapData = systemSnap.exists ? systemSnap.data() : {};

    if (bootstrapData.firstSuperAdminUid &&
        !SUPERADMIN_UIDS.includes(bootstrapData.firstSuperAdminUid)) {
      throw new Error(
        'The recorded first Super Admin is not in the approved Super Admin list.'
      );
    }

    if (roleSnap.exists &&
        roleSnap.data().role === 'superadmin' &&
        roleSnap.data().active === true) {
      tx.set(systemRef, {
        ...(bootstrapData.firstSuperAdminUid ? {} : { firstSuperAdminUid: uid }),
        bootstrappedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      return;
    }

    tx.set(roleRef, {
      uid,
      email: user.email || '',
      role: 'superadmin',
      active: true,
      folderKeys: [],
      sectionKeys: [],
      updatedAt: FieldValue.serverTimestamp(),
      bootstrap: true
    }, { merge: true });

    tx.set(systemRef, {
      ...(bootstrapData.firstSuperAdminUid ? {} : { firstSuperAdminUid: uid }),
      bootstrappedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  process.stdout.write(
    `Superadmin role checked for ${user.email || uid}\n`
  );

  process.exit(0);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
