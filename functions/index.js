const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { randomUUID } = require('crypto');

initializeApp({ storageBucket: 'islamic-university-27d8f.firebasestorage.app' });
const db = getFirestore();
const auth = getAuth();
const bucket = getStorage().bucket();

const VALID_ROLES = ['superadmin', 'admin', 'sectionAdmin', 'uploader', 'user'];
const VALID_SECTIONS = [
  'قرآن کریم او علوم القرآن', 'حدیث او علوم الحدیث', 'فقه او فروع', 'عقیده او توحید',
  'اصول الفقه او قواعد', 'سیرت او شمائل نبوي ﷺ', 'اسلامي تاریخ او تمدن',
  'د صحابه‌وو او علماوو ژوندلیکونه', 'عربي ژبه او ادبیات', 'اخلاق، تزکیه او سلوک',
  'دعوت، تبلیغ او خطابت', 'فتاوی او معاصرې مسئلې', 'اسلامي زده کړې او درسي نصاب',
  'دعاوې، اذکار او عبادتي لارښود', 'اسلام، کورنۍ او ټولنه', 'اسلام او معاصر علوم'
];

async function getActor(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'ننوتل اړین دي.');
  const snap = await db.doc(`userRoles/${request.auth.uid}`).get();
  if (!snap.exists || snap.data().active !== true) throw new HttpsError('permission-denied', 'دا حساب فعال اداري واک نه لري.');
  return { uid: request.auth.uid, data: snap.data() };
}

async function writeAudit(actorUid, action, target, details = {}) {
  await db.collection('auditLogs').add({
    actorUid, action, target: String(target || ''), details,
    createdAt: FieldValue.serverTimestamp()
  });
}

exports.setUserRoleByEmail = onCall(async (request) => {
  const actor = await getActor(request);
  const actorRole = actor.data.role;
  if (!['superadmin', 'admin'].includes(actorRole)) throw new HttpsError('permission-denied', 'یوازې ستر اډمین یا عمومي اډمین رول ټاکلی شي.');

  const email = String(request.data?.email || '').trim().toLowerCase();
  const role = String(request.data?.role || '');
  const folderKeys = Array.isArray(request.data?.folderKeys)
    ? [...new Set(request.data.folderKeys.map(value => String(value).trim()).filter(Boolean))]
    : [];
  const sectionKeys = Array.isArray(request.data?.sectionKeys)
    ? [...new Set(request.data.sectionKeys.map(value => String(value).trim()).filter(Boolean))]
    : [];

  if (!email || !VALID_ROLES.includes(role)) throw new HttpsError('invalid-argument', 'ایمیل او له ټاکل شوو رولونو څخه یو انتخاب کړئ.');
  if (actorRole === 'admin' && ['superadmin', 'admin'].includes(role)) throw new HttpsError('permission-denied', 'عمومي اډمین د ستر یا بل عمومي اډمین رول نه شي ټاکلی.');
  if (folderKeys.length > 200 || folderKeys.some(value => value.length > 300 || !value.includes('::'))) {
    throw new HttpsError('invalid-argument', 'د اپلوډر فولډر باید د برخه::فولډر په بڼه وي.');
  }
  if (sectionKeys.length > 10 || sectionKeys.some(value => !VALID_SECTIONS.includes(value))) {
    throw new HttpsError('invalid-argument', 'د برخې اډمین لپاره تر لسو پورې معتبرې علمي برخې ټاکل کېدای شي.');
  }
  if (role === 'sectionAdmin' && sectionKeys.length === 0) throw new HttpsError('invalid-argument', 'د برخې اډمین لپاره لږ تر لږه یوه علمي برخه وټاکئ.');
  if (role === 'uploader' && folderKeys.length === 0) throw new HttpsError('invalid-argument', 'اپلوډر ته لږ تر لږه یو فولډر وټاکئ.');
  if (role !== 'uploader' && folderKeys.length) throw new HttpsError('invalid-argument', 'د فولډر اجازه یوازې اپلوډر ته ټاکل کېږي.');
  if (role !== 'sectionAdmin' && sectionKeys.length) throw new HttpsError('invalid-argument', 'د علمي برخو اجازه یوازې د برخې اډمین ته ټاکل کېږي.');

  let target;
  try { target = await auth.getUserByEmail(email); }
  catch (_) { throw new HttpsError('not-found', 'دا ایمیل په Firebase Authentication کې حساب نه لري.'); }
  const targetRoleRef = db.doc(`userRoles/${target.uid}`);
  const targetRoleSnap = await targetRoleRef.get();
  const previous = targetRoleSnap.exists ? targetRoleSnap.data() : null;

  if (actorRole === 'admin' && previous && ['superadmin', 'admin'].includes(previous.role)) {
    throw new HttpsError('permission-denied', 'عمومي اډمین د ستر یا بل عمومي اډمین حساب نه شي بدلولی.');
  }
  if (previous?.role === 'superadmin' && previous.active === true && role !== 'superadmin') {
    const activeSuperadmins = await db.collection('userRoles').where('role', '==', 'superadmin').get();
    if (activeSuperadmins.docs.filter(row => row.data().active === true).length <= 1) {
      throw new HttpsError('failed-precondition', 'وروستی ستر اډمین نه شي لرې کېدای؛ لومړی بل ستر اډمین وټاکئ.');
    }
  }

  await targetRoleRef.set({
    uid: target.uid,
    email: target.email || email,
    role,
    active: true,
    folderKeys: role === 'uploader' ? folderKeys : [],
    sectionKeys: role === 'sectionAdmin' ? sectionKeys : [],
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.uid
  }, { merge: true });
  await writeAudit(actor.uid, 'role_assigned', target.uid, { email, oldRole: previous?.role || null, newRole: role, folderKeys, sectionKeys });
  return { success: true, uid: target.uid, role };
});

exports.reviewPendingLesson = onCall(async (request) => {
  const actor = await getActor(request);
  const actorRole = actor.data.role;
  const lessonId = String(request.data?.lessonId || '');
  const decision = String(request.data?.decision || '');
  if (!lessonId || !['forward', 'approve', 'reject'].includes(decision)) {
    throw new HttpsError('invalid-argument', 'د درس پېژند او سمه پرېکړه اړینه ده.');
  }

  const pendingRef = db.doc(`pendingLessons/${lessonId}`);
  const snap = await pendingRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'درس ونه موندل شو.');
  const pending = snap.data();
  const currentStatus = pending.status;

  if (decision === 'forward') {
    if (actorRole !== 'sectionAdmin') throw new HttpsError('permission-denied', 'یوازې د برخې اډمین درس عمومي اډمین ته لېږلی شي.');
    const assigned = Array.isArray(actor.data.sectionKeys) ? actor.data.sectionKeys : [];
    if (!assigned.includes(pending.section)) throw new HttpsError('permission-denied', 'دا علمي برخه ستاسې په واک کې نه ده.');
    if (currentStatus !== 'pending') throw new HttpsError('failed-precondition', 'یوازې د لومړنۍ کتنې درس لېږل کېدای شي.');
    await pendingRef.update({ status: 'admin_review', sectionReviewedBy: actor.uid, sectionReviewedAt: FieldValue.serverTimestamp() });
    await writeAudit(actor.uid, 'lesson_forwarded_to_admin', lessonId, { section: pending.section, folder: pending.folder });
    return { success: true, status: 'admin_review' };
  }

  if (!['superadmin', 'admin'].includes(actorRole)) throw new HttpsError('permission-denied', 'وروستی خپرول یوازې عمومي اډمین یا ستر اډمین کولی شي.');
  if (!['pending', 'admin_review'].includes(currentStatus)) throw new HttpsError('failed-precondition', 'دا درس د وروستۍ پرېکړې لپاره په مناسب حالت کې نه دی.');

  if (actorRole === 'admin' && currentStatus === 'pending') {
    const sectionAdmins = await db.collection('userRoles').where('role', '==', 'sectionAdmin').get();
    const hasActiveSectionAdmin = sectionAdmins.docs.some(row => row.data().active === true
      && Array.isArray(row.data().sectionKeys) && row.data().sectionKeys.includes(pending.section));
    if (hasActiveSectionAdmin) throw new HttpsError('failed-precondition', 'د دې برخې اډمین باید لومړی درس وڅېړي او عمومي اډمین ته یې ولېږي.');
  }

  const mediaIds = Array.isArray(pending.mediaIds) ? [...new Set(pending.mediaIds.map(String))] : [];
  if (mediaIds.length > 50 || mediaIds.some(id => !/^[A-Za-z0-9_-]{1,160}$/.test(id))) {
    throw new HttpsError('failed-precondition', 'د درس د فایلونو پېژندپاڼې ناسمې دي.');
  }
  const mediaRefs = mediaIds.map(id => db.doc(`mediaAssets/${id}`));
  const mediaSnaps = await Promise.all(mediaRefs.map(ref => ref.get()));
  if (mediaSnaps.some(row => !row.exists
    || row.data().ownerUid !== pending.ownerUid
    || row.data().status !== 'pending'
    || typeof row.data().storagePath !== 'string'
    || !row.data().storagePath.startsWith(`pending/${pending.ownerUid}/`))) {
    throw new HttpsError('failed-precondition', 'د درس له فایلونو څخه یو یا څو فایلونه نیمګړي دي یا د تایید په تمه نه دي.');
  }

  const batch = db.batch();
  const reviewedAt = FieldValue.serverTimestamp();
  if (decision === 'approve') {
    const approvedUrls = {};
    for (let i = 0; i < mediaRefs.length; i++) {
      const media = mediaSnaps[i].data();
      const token = randomUUID();
      const file = bucket.file(media.storagePath);
      await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
      approvedUrls[media.mediaId || mediaRefs[i].id] = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(media.storagePath)}?alt=media&token=${token}`;
      batch.update(mediaRefs[i], { status: 'approved', downloadToken: token, reviewedBy: actor.uid, reviewedAt });
    }
    const publishedItem = JSON.parse(JSON.stringify(pending.item || {}));
    const replaceMediaUri = file => {
      if (!file) return file;
      const url = approvedUrls[file.mediaId];
      const coverUrl = approvedUrls[file.coverMediaId];
      return {
        ...file,
        ...(url ? { uri: url, reviewStatus: 'approved' } : {}),
        ...(coverUrl ? { coverUri: coverUrl, coverReviewStatus: 'approved' } : {})
      };
    };
    publishedItem.audioTracks = Array.isArray(publishedItem.audioTracks) ? publishedItem.audioTracks.map(replaceMediaUri) : [];
    publishedItem.attachments = Array.isArray(publishedItem.attachments) ? publishedItem.attachments.map(replaceMediaUri) : [];
    if (publishedItem.pdf && typeof publishedItem.pdf === 'string') {
      const pdfMedia = mediaSnaps.map(row => row.data()).find(row => row.mediaType === 'pdf');
      if (pdfMedia?.mediaId && approvedUrls[pdfMedia.mediaId]) publishedItem.pdf = approvedUrls[pdfMedia.mediaId];
    }
    if (publishedItem.pdfCoverMediaId && approvedUrls[publishedItem.pdfCoverMediaId]) {
      publishedItem.pdfCoverUri = approvedUrls[publishedItem.pdfCoverMediaId];
      publishedItem.pdfCoverReviewStatus = 'approved';
    }
    if (publishedItem.audioTracks?.length) publishedItem.audio = publishedItem.audioTracks[0].uri;
    publishedItem.cloudReviewStatus = 'approved';
    const publishedLessonId = String(pending.item?.id || lessonId);
    batch.set(db.doc(`publishedLessons/${publishedLessonId}`), {
      item: publishedItem, ownerUid: pending.ownerUid, section: pending.section,
      folder: pending.folder, scopeKey: pending.scopeKey || `${pending.section}::${pending.folder}`,
      status: 'approved', mediaIds, approvedAt: reviewedAt, approvedBy: actor.uid
    });
    batch.update(pendingRef, { status: 'approved', reviewedAt, reviewedBy: actor.uid });
  } else {
    for (let i = 0; i < mediaRefs.length; i++) batch.update(mediaRefs[i], { status: 'rejected', reviewedBy: actor.uid, reviewedAt });
    batch.update(pendingRef, { status: 'rejected', reviewedAt, reviewedBy: actor.uid });
  }
  await batch.commit();

  if (decision === 'reject') {
    for (const row of mediaSnaps) {
      const path = row.data().storagePath;
      if (path) await bucket.file(path).delete({ ignoreNotFound: true }).catch(() => {});
    }
  }
  await writeAudit(actor.uid, decision === 'approve' ? 'lesson_published' : 'lesson_rejected', lessonId, { section: pending.section, folder: pending.folder, previousStatus: currentStatus });
  return { success: true, status: decision === 'approve' ? 'approved' : 'rejected' };
});

