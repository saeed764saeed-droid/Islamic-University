# د میراث اسلام د وروستي Build او Backend لارښود

## د GitHub Secrets اړین نومونه
- `EXPO_TOKEN` — د EAS Android APK جوړولو لپاره
- `CLOUDFLARE_API_TOKEN` — د Cloudflare Worker خپرولو لپاره
- `FIREBASE_SERVICE_ACCOUNT` — د Firebase Functions او Rules خپرولو لپاره (د Service Account بشپړ JSON)

د Secret ارزښتونه هېڅکله په GitHub عامه فایلونو، چټ یا سکرین‌شاټ کې مه خپروئ.

## د نشر ترتیب
1. `worker/` فولډر او R2 Bucket `islamic-university-files` باید په Cloudflare کې موجود وي.
2. د GitHub Actions له لارې `Deploy Cloudflare Worker` وچلوئ.
3. `Deploy Firebase Backend` وچلوئ، څو Functions او Rules خپاره شي.
4. د دواړو بریالي کېدو وروسته `Build Android APK` وچلوئ.

## د رسنیو جریان
- اپلېکېشن د Firebase Auth ID Token سره فایل `PUT /upload/{mediaId}` ته لېږي.
- Worker د Firestore `mediaAssets/{mediaId}` مالکیت او pending حالت ګوري او فایل R2 ته لیکي.
- Firebase Function د مدیر له تایید وروسته د رسنۍ حالت `approved` کوي او د Worker `/media/{mediaId}` لینک په خپاره شوي درس کې ثبتوي.
- رد شوي فایلونه د مدیر د اپلېکېشن له لارې د Worker `DELETE /media/{mediaId}` په وسیله پاکېږي.

## یادونه
د R2 فایلونو لپاره د Worker URL په `App.js` او `functions/index.js` کې تنظیم شوی. د Worker د R2 binding نوم `MY_BUCKET` دی او Bucket نوم `islamic-university-files` دی.
