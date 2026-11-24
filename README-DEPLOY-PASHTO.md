# د میراث اسلام – Backend او Android Deploy لارښود

## GitHub Secrets
- `CLOUDFLARE_API_TOKEN` — د Worker Deploy لپاره.
- `FIREBASE_TOKEN` — یوازې د Firestore Rules Deploy لپاره.
- `EXPO_TOKEN` — د Android EAS Build لپاره.

د Firebase Service Account JSON یوازې د Cloudflare Worker د Production Secret په توګه وساتئ؛ GitHub ته یې مه پورته کوئ.

## د لومړي ځل Worker تنظیم
1. په Cloudflare کې Worker `islamic-university-storage` خلاص کړئ.
2. Production > Settings > Variables and Secrets کې `FIREBASE_SERVICE_ACCOUNT` باید د Secret په توګه موجود وي.
3. د Google Cloud IAM له لارې د Service Account ایمیل ته `roles/datastore.user` او `roles/firebaseauth.viewer` ورکړئ.
4. موجود R2 binding `MY_BUCKET` او bucket `islamic-university-files` هماغسې وساتئ.

## Deploy ترتیب
1. د GitHub `main` څانګې ته د پروژې فایلونه پورته کړئ.
2. د `Deploy Cloudflare Worker` workflow اجرا کړئ؛ یا د `worker/index.js` بدلون push کړئ.
3. د `Deploy Firestore Rules Only` workflow اجرا کړئ. دا یوازې `firestore.rules` خپروي؛ Firebase Functions او Firebase Storage نه خپروي.
4. د Worker روغتیا د `https://islamic-university-storage.saeed764saeed.workers.dev/health` له لارې وګورئ.
5. د اپلیکیشن د اداري حسابونو، درسونو کتنې او R2 اپلوډ حقیقي ازموینه وکړئ.
6. یوازې د ټولو ازموینو تر بریا وروسته `Build Android APK` اجرا کړئ.

## د رسنیو جریان
- اپ د Firebase ID Token سره `PUT /upload/{mediaId}` ته فایل لېږي.
- Worker د Firestore `mediaAssets/{mediaId}` مالکیت او pending حالت تاییدوي او فایل R2 ته لیکي.
- د اداري غوښتنې پنځه لارې د Worker لاندې دي: `/admin/listPendingLessons`، `/admin/listUserRoles`، `/admin/setUserRoleStatus`، `/admin/setUserRoleByEmail`، `/admin/reviewPendingLesson`.
- د تایید وروسته Worker د رسنیو حالت approved کوي او خپور شوی درس په Firestore کې ثبتوي.
- رد شوي فایلونه د Worker `DELETE /media/{mediaId}` له لارې پاکېږي.

## د ازموینې مهم شرطونه
- دواړه موجود Super Admin حسابونه باید په Firebase Auth کې فعال او په Firestore `userRoles/{uid}` کې `role: "superadmin"` ولري.
- د Worker Secret ارزښت باید د پروژې `islamic-university-27d8f` د Service Account JSON وي.
- د Worker د Firestore/Identity Toolkit د لاسرسي لپاره د Service Account IAM رولونه اړین دي.
- د `FIREBASE_SERVICE_ACCOUNT` Secret ارزښت په سکرین‌شاټ یا چټ کې مه ښکاره کوئ.
