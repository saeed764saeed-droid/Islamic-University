const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();
const auth = getAuth();
const MEDIA_WORKER_URL = 'https://islamic-university-storage.saeed764saeed.workers.dev';

const VALID_ROLES = ['superadmin', 'admin', 'sectionAdmin', 'uploader', 'user'];

const DEFAULT_ROLE_PERMISSIONS = {
  superadmin: ['upload','createContent','editContent','deleteContent','publish','manageUsers','manageLibrary','editSettings','viewAudit','review'],
  admin: ['upload','createContent','editContent','deleteContent','publish','manageLibrary','editSettings','viewAudit','review'],
  sectionAdmin: ['upload','createContent','editContent','review'],
  uploader: ['upload','createContent'], user: []
};
function actorHasPermission(actor, permission) {
  if (actor.data.role === 'superadmin') return true;
  const custom = actor.data.permissions;
  if (custom && Object.prototype.hasOwnProperty.call(custom, permission)) return custom[permission] === true;
  return (DEFAULT_ROLE_PERMISSIONS[actor.data.role] || []).includes(permission);
}

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
  if (!snap.exists || (snap.data().active !== true && !(snap.data().role === 'superadmin' && snap.data().active !== false))) throw new HttpsError('permission-denied', 'دا حساب فعال اداري واک نه لري.');
  return { uid: request.auth.uid, data: snap.data() };
}

async function writeAudit(actorUid, action, target, details = {}) {
  await db.collection('auditLogs').add({
    actorUid, action, target: String(target || ''), details,
    createdAt: FieldValue.serverTimestamp()
  });
}


exports.listPendingLessons = onCall(async (request) => {
  const actor = await getActor(request);
  if (!actorHasPermission(actor, 'review')) {
    throw new HttpsError('permission-denied', 'د درسونو د کتنې اجازه نشته.');
  }

  const isGlobalReviewer = ['superadmin', 'admin'].includes(actor.data.role);
  const sectionKeys = Array.isArray(actor.data.sectionKeys) ? actor.data.sectionKeys : [];
  if (!isGlobalReviewer && sectionKeys.length === 0) return { lessons: [] };

  // Admin SDK query: Firestore client rules/index constraints do not block authorized reviewers.
  const snapshot = await db.collection('pendingLessons').limit(500).get();
  const lessons = snapshot.docs.map((row) => {
    const data = row.data();
    const updatedAt = data.updatedAt && typeof data.updatedAt.toDate === 'function'
      ? data.updatedAt.toDate().toISOString() : null;
    return {
      id: row.id,
      item: data.item || {},
      ownerUid: data.ownerUid || '',
      section: data.section || '',
      folder: data.folder || '',
      scopeKey: data.scopeKey || '',
      status: data.status || '',
      mediaIds: Array.isArray(data.mediaIds) ? data.mediaIds : [],
      updatedAt
    };
  }).filter((row) => {
    if (!['pending', 'admin_review'].includes(row.status)) return false;
    if (isGlobalReviewer) return true;
    return row.status === 'pending' && sectionKeys.includes(row.section);
  });

  lessons.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  return { lessons };
});

exports.listUserRoles = onCall(async (request) => {
  const actor = await getActor(request);
  if (actor.data.role !== 'superadmin') {
    throw new HttpsError('permission-denied', 'د ټولو حسابونو بشپړ لېست یوازې ستر اډمین لیدلی شي.');
  }
  const snapshot = await db.collection('userRoles').orderBy('email').limit(500).get();
  return {
    users: snapshot.docs.map(row => {
      const data = row.data();
      return {
        uid: row.id,
        email: data.email || '',
        role: data.role || 'user',
        active: data.active === true || (data.role === 'superadmin' && data.active !== false),
        sectionKeys: Array.isArray(data.sectionKeys) ? data.sectionKeys : [],
        folderKeys: Array.isArray(data.folderKeys) ? data.folderKeys : [],
        permissions: data.permissions && typeof data.permissions === 'object' ? data.permissions : {},
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : null
      };
    })
  };
});

exports.setUserRoleStatus = onCall(async (request) => {
  const actor = await getActor(request);
  if (actor.data.role !== 'superadmin') {
    throw new HttpsError('permission-denied', 'د حسابونو فعالولو او بندولو اجازه یوازې ستر اډمین لري.');
  }
  const uid = String(request.data?.uid || '').trim();
  const active = request.data?.active;
  if (!uid || typeof active !== 'boolean') {
    throw new HttpsError('invalid-argument', 'د حساب UID او فعال/غیرفعال حالت اړین دی.');
  }
  const targetRef = db.doc(`userRoles/${uid}`);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) throw new HttpsError('not-found', 'دا اداري حساب ونه موندل شو.');
  const target = targetSnap.data();
  if (actor.data.role !== 'superadmin' && ['superadmin','admin'].includes(target.role)) throw new HttpsError('permission-denied', 'یوازې ستر اډمین د ستر/عمومي اډمین حساب بدلولی شي.');
  if (target.role === 'superadmin' && active === false) {
    const all = await db.collection('userRoles').where('role', '==', 'superadmin').get();
    const activeCount = all.docs.filter(row => row.data().active === true || row.data().active == null).length;
    if (activeCount <= 1) {
      throw new HttpsError('failed-precondition', 'وروستی فعال ستر اډمین نه شي بندېدای؛ لومړی بل ستر اډمین فعال کړئ.');
    }
  }
  await targetRef.update({
    active,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.uid
  });
  await writeAudit(actor.uid, active ? 'account_activated' : 'account_deactivated', uid, {
    email: target.email || '', role: target.role || ''
  });
  return { success: true, uid, active };
});

exports.setUserRoleByEmail = onCall(async (request) => {
  const actor = await getActor(request);
  const actorRole = actor.data.role;
  if (actorRole !== 'superadmin') throw new HttpsError('permission-denied', 'د رول ټاکلو اجازه یوازې ستر اډمین لري.');

  const email = String(request.data?.email || '').trim().toLowerCase();
  const role = String(request.data?.role || '');
  const active = request.data?.active === undefined ? true : request.data.active;
  if (typeof active !== 'boolean') throw new HttpsError('invalid-argument', 'د حساب فعال حالت ناسم دی.');
  const folderKeys = Array.isArray(request.data?.folderKeys)
    ? [...new Set(request.data.folderKeys.map(value => String(value).trim()).filter(Boolean))]
    : [];
  const sectionKeys = Array.isArray(request.data?.sectionKeys)
    ? [...new Set(request.data.sectionKeys.map(value => String(value).trim()).filter(Boolean))]
    : [];
  const PERMISSION_KEYS = ['upload','createContent','editContent','deleteContent','publish','manageUsers','manageLibrary','editSettings','viewAudit','review'];
  const permissions = {};
  if (request.data?.permissions && typeof request.data.permissions === 'object') {
    for (const [key, value] of Object.entries(request.data.permissions)) {
      if (!PERMISSION_KEYS.includes(key) || typeof value !== 'boolean') throw new HttpsError('invalid-argument', 'د اجازې نوم یا ارزښت ناسم دی.');
      permissions[key] = value;
    }
  }

  if (!email || !VALID_ROLES.includes(role)) throw new HttpsError('invalid-argument', 'ایمیل او له ټاکل شوو رولونو څخه یو انتخاب کړئ.');
  if (role === 'superadmin' && actorRole !== 'superadmin') throw new HttpsError('permission-denied', 'یوازې ستر اډمین نوی ستر اډمین ټاکلی شي.');
  if (actorRole !== 'superadmin' && role === 'admin') throw new HttpsError('permission-denied', 'یوازې ستر اډمین عمومي اډمین ټاکلی شي.');
  if (folderKeys.length > 200 || folderKeys.some(value => value.length > 300 || !value.includes('::'))) {
    throw new HttpsError('invalid-argument', 'د اپلوډر فولډر باید د برخه::فولډر په بڼه وي.');
  }
  if (sectionKeys.length > 10 || sectionKeys.some(value => !VALID_SECTIONS.includes(value))) {
    throw new HttpsError('invalid-argument', 'د برخې اډمین لپاره تر لسو پورې معتبرې علمي برخې ټاکل کېدای شي.');
  }
  const defaultUploadRoles = ['superadmin','admin','sectionAdmin','uploader'];
  const uploadEnabled = permissions.upload === true || (permissions.upload === undefined && defaultUploadRoles.includes(role));
  if (uploadEnabled && !['superadmin','admin'].includes(role) && folderKeys.length === 0 && sectionKeys.length === 0) throw new HttpsError('invalid-argument', 'د اپلوډ واک لرونکي حساب ته لږ تر لږه یوه علمي برخه یا فولډر وټاکئ.');
  if (['superadmin','admin'].includes(role) && (folderKeys.length || sectionKeys.length)) throw new HttpsError('invalid-argument', 'ستر او عمومي اډمین ته د ټولو برخو واک وي؛ ځانګړي فولډرونه مه ټاکئ.');

  let target;
  try { target = await auth.getUserByEmail(email); }
  catch (_) { throw new HttpsError('not-found', 'دا ایمیل په Firebase Authentication کې حساب نه لري.'); }
  const targetRoleRef = db.doc(`userRoles/${target.uid}`);
  const targetRoleSnap = await targetRoleRef.get();
  const previous = targetRoleSnap.exists ? targetRoleSnap.data() : null;

  if (actorRole !== 'superadmin' && previous && ['superadmin', 'admin'].includes(previous.role)) {
    throw new HttpsError('permission-denied', 'عمومي اډمین د ستر یا بل عمومي اډمین حساب نه شي بدلولی.');
  }
  if (previous?.role === 'superadmin' && previous.active !== false && (role !== 'superadmin' || active === false)) {
    const activeSuperadmins = await db.collection('userRoles').where('role', '==', 'superadmin').get();
    if (activeSuperadmins.docs.filter(row => row.data().active === true || row.data().active == null).length <= 1) {
      throw new HttpsError('failed-precondition', 'وروستی ستر اډمین نه شي لرې کېدای؛ لومړی بل ستر اډمین وټاکئ.');
    }
  }

  await targetRoleRef.set({
    uid: target.uid,
    email: target.email || email,
    role,
    active,
    folderKeys: ['superadmin','admin'].includes(role) ? [] : folderKeys,
    sectionKeys: ['superadmin','admin'].includes(role) ? [] : sectionKeys,
    permissions: role === 'superadmin' ? {} : permissions,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.uid
  }, { merge: true });
  await writeAudit(actor.uid, 'role_assigned', target.uid, { email, oldRole: previous?.role || null, newRole: role, active, folderKeys, sectionKeys, permissions });
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
    if (!actorHasPermission(actor, 'review')) throw new HttpsError('permission-denied', 'د درسونو د کتنې اجازه نشته.');
    const assigned = Array.isArray(actor.data.sectionKeys) ? actor.data.sectionKeys : [];
    if (!assigned.includes(pending.section)) throw new HttpsError('permission-denied', 'دا علمي برخه ستاسې په واک کې نه ده.');
    if (currentStatus !== 'pending') throw new HttpsError('failed-precondition', 'یوازې د لومړنۍ کتنې درس لېږل کېدای شي.');
    await pendingRef.update({ status: 'admin_review', sectionReviewedBy: actor.uid, sectionReviewedAt: FieldValue.serverTimestamp() });
    await writeAudit(actor.uid, 'lesson_forwarded_to_admin', lessonId, { section: pending.section, folder: pending.folder });
    return { success: true, status: 'admin_review' };
  }

  if (!["superadmin", "admin"].includes(actorRole) || !actorHasPermission(actor, "publish")) throw new HttpsError("permission-denied", "وروستی تایید او خپرول یوازې ستر اډمین او عمومي اډمین کولای شي.");
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
    || row.data().storageProvider !== 'cloudflare-r2'
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
      const mediaId = media.mediaId || mediaRefs[i].id;
      approvedUrls[mediaId] = `${MEDIA_WORKER_URL}/media/${encodeURIComponent(mediaId)}`;
      batch.update(mediaRefs[i], {
        status: 'approved',
        downloadUrl: approvedUrls[mediaId],
        storageProvider: 'cloudflare-r2',
        reviewedBy: actor.uid,
        reviewedAt
      });
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

  await writeAudit(actor.uid, decision === 'approve' ? 'lesson_published' : 'lesson_rejected', lessonId, { section: pending.section, folder: pending.folder, previousStatus: currentStatus });
  return { success: true, status: decision === 'approve' ? 'approved' : 'rejected', cleanupMediaIds: decision === 'reject' ? mediaIds : [] };
});

