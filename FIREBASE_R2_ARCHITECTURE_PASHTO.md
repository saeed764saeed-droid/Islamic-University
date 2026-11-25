# میراث اسلام: د Firebase او Cloudflare R2 جلا مسؤلیتونه

## د سیستم وېش
- Firebase Authentication: د کارن ننوتل او پېژندنه.
- Cloud Firestore: د رولونو، صلاحیتونو، Pending درسونو، خپرو شویو درسونو او Audit Logs معلومات.
- Cloudflare Worker: د Super Admin/Admin اداري عملیات، د درسونو کتنه، تایید او خپرول؛ Worker د Service Account له لارې Firestore REST API کاروي.
- Cloudflare Worker + R2: د آډیو، PDF او نورو فایلونو اپلوډ، زېرمه، لوستل او حذف.

## مهمه خبره
دا پروژه Firebase Storage نه کاروي. د `storage.rules` فایل په پروژه کې پاتې کېدای شي، خو deploy نه کېږي او د Firebase Storage فعالول لازم نه دي. `firebase.json` یوازې Functions او Firestore rules لري.

## GitHub Secrets
1. `FIREBASE_TOKEN` — د Firebase workflow لپاره.
2. `CLOUDFLARE_API_TOKEN` — د Worker deploy لپاره، د R2 اړوند اجازو سره.

د Secret ارزښتونه په GitHub Secrets کې وساتئ؛ په کوډ یا چټ کې یې مه لیکئ.

## Deploy ترتیب
1. GitHub Actions → Deploy Firebase Backend → Run workflow. دا یوازې `functions` او `firestore.rules` خپروي.
2. GitHub Actions → Deploy Cloudflare Worker → Run workflow. دا Worker خپروي؛ R2 binding باید `MY_BUCKET` او bucket `islamic-university-files` وي، لکه `worker/wrangler.toml` کې.
3. د Worker health endpoint وګورئ: `https://islamic-university-storage.saeed764saeed.workers.dev/health` باید `status: online` ورکړي.

## د موجودو سرچینو په اړه
`App.js` د Firebase له لارې د `mediaAssets` metadata ثبتوي او د فایل bytes د Worker `/upload/{mediaId}` endpoint ته لېږي. `worker/index.js` د رولونو اداره او د درسونو تایید/خپرول ترسره کوي. `functions/index.js` په دې اوسني جریان کې د اپ له خوا نه کارول کېږي او د دې نسخې د Deploy برخه نه ده.

## د ازموینې مهم محدودیت
دا ZIP د Deploy د Firebase Storage ناسم تړاو لرې کوي؛ دا په خپله د حقیقي R2 اپلوډ بریالیتوب نه ثابتوي. د اپلوډ د 500 خطا لپاره باید د Worker Observability کې د `R2 upload failed` اړوند `detail` متن وکتل شي. تر هغې د اپلوډ ستونزه حل شوې نه بلل کېږي.
