# د میراث اسلام – د اصلاح شویو فایلونو راپور

دا ZIP د کارن له خوا رالېږل شوي فایلونه د اصلي پروژې په توګه ساتي او لاندې اصلاحات پکې شامل دي:

1. په `worker/index.js` کې د `/bootstrap/superadmin` خوندي لاره اضافه شوې. یوازې د پروژې ثابت مالک UID او معتبر Firebase ID Token یې کارولی شي.
2. په `App.js` کې د Settings/Firebase برخه کې د مالک حساب لپاره د «زما حساب د ستر اډمین په توګه فعال کړه» تڼۍ اضافه شوې. د نورو حسابونو لپاره نه ښکاري.
3. د Super Admin رول د Worker د Firebase Service Account له لارې په Firestore کې لیکل کېږي؛ Service Account JSON په ZIP کې نشته او باید یوازې د Cloudflare Secret په توګه وساتل شي.
4. GitHub Actions فایلونه سمې پټې لارې `.github/workflows/` ته انتقال شوي.
5. `app.json` د پروژې د تایید شوو Expo owner او EAS Project ID سره برابر شوی.
6. `@expo/config-plugins` د مستقیم dependency په توګه ثبت شوی او `package-lock.json` ورسره برابر شوی.
7. د ZIP دننه د نه موجود player artwork عکس ته reference لرې شوی، څو د Android bundle د ورک asset له امله ناکام نه شي.
8. `.gitignore` اضافه شوی، څو `node_modules`، build output، logs او رازونه GitHub ته پورته نه شي.

## د ازموینې پایلې

- `node --check` د Worker، Functions، bootstrap script او app.config.js لپاره بریالی شو.
- `tsc` د `App.js` د JSX/JavaScript parse کتنه پرته له خطا بشپړه کړه.
- د Worker `/health` ازموینه HTTP 200 ورکړه.
- د بې Token `/bootstrap/superadmin` غوښتنه په سمه توګه HTTP 401 رد شوه.
- د تولیدي Firebase/Cloudflare اتصال، واقعي Firestore لیکنه، GitHub Actions Deploy او Android EAS APK لا نه دي اجرا شوي؛ دا د حسابونو د Deploy او لاسرسي له اجازې وروسته کېږي.

## د فعالولو لنډ ترتیب

1. د ZIP ټول فایلونه د GitHub د `main` څانګې په ریښه کې پورته کړئ؛ `.github` پټ فولډر هم باید ورسره پورته شي.
2. ډاډ ترلاسه کړئ چې Cloudflare Worker کې `FIREBASE_SERVICE_ACCOUNT` Secret او `MY_BUCKET` R2 binding شته.
3. GitHub Actions کې `Deploy Cloudflare Worker` اجرا کړئ او تر بریالي Deploy انتظار وکړئ.
4. په موبایل کې نوې نسخه نصب/چلول او د Firebase له لارې د مالک UID حساب ته ننوتل وکړئ.
5. Settings > Firebase کې د «زما حساب د ستر اډمین په توګه فعال کړه» تڼۍ کېکاږئ.
6. که بریالی شو، د Firestore `userRoles/{UID}` سند باید `role: superadmin` او `active: true` ولري؛ اپ باید د رول تازه کېدو خبر وښيي.
7. وروسته د `Deploy Firestore Rules Only` او بیا `Build Android APK` اجرا کړئ.

**یادونه:** د دې ZIP جوړول او محلي syntax ازموینې د Cloudflare/Firebase Deploy یا د APK جوړېدو معنا نه لري. تر واقعي ازموینې مخکې د تولید لپاره بشپړ تصدیق مه ګڼئ.

## د رسمي زده کړو نوی سیستم (د ۲۰۲۶-۱۱-۲۶ اصلاح)

- `FormalLearning.js` د رسمي زده کړو جلا پاڼه ده؛ د زده کړې د مسیر له پاڼې څخه پرانیستل کېږي.
- عادي عامه کتابتون بې له Gmail/ننوتلو هم د خپرو شویو آډیو او PDF موادو لپاره پرانیستی پاتې کېږي.
- رسمي کورس ته ثبت نام، د پرمختګ ساتل او وروستۍ ازموینه د Firebase ایمیل حساب ته اړتیا لري.
- یوازې تایید شوي `publishedLessons` د رسمي کورس په نصاب کې ټاکل کېدای شي.
- د کورس ټول درسونه باید بشپړ شي؛ بیا زده کوونکی وروستۍ ازموینه ورکوي. د کورس د `passPercent` حد پوره کولو وروسته سرور په `certificates` کې یو ځانګړی ډیجیټلي سند جوړوي.
- د سند پېژند او تصدیق کوډ د اپ له لارې شریکېدای شي. د سند اعتبار د Firestore د `certificates/{certificateId}` سند له مخې ساتل کېږي.
- د زده کوونکي پرمختګ، ازموینې نمرې او سندونه د Cloud Functions له لارې لیکل کېږي؛ د موبایل اپ مستقیم لیکلو اجازه نه لري.

### د رسمي کورس جوړول
1. د ستر اډمین یا د `manageLibrary` اجازې لرونکي عمومي اډمین حساب ته ننوتل وکړئ.
2. د زده کړې مسیر > رسمي زده کړې او سند ته لاړ شئ.
3. د کورس نوم، تشریح، د بریا سلنه، تایید شوي درسونه او د ازموینې پوښتنې د JSON په بڼه ولیکئ.
4. د ازموینې د هرې پوښتنې بڼه: `{"question":"پوښتنه؟","options":["الف","ب","ج","د"],"correctIndex":0}`؛ `correctIndex` له صفر څخه شمېرل کېږي.
5. کورس خپور کړئ. زده کوونکي د Gmail ایمیل حساب له لارې ثبت نام، درسونه بشپړ او ازموینه پاسوي.

### اړین Deploy
- `functions/index.js` نوې Callable Functions لري: `saveFormalCourse`, `enrollFormalCourse`, `completeFormalLesson`, `submitFormalExam`.
- `firestore.rules` د رسمي کورسونو، زده کوونکو د ثبت او سندونو قواعد لري.
- د `firebase.json` له لارې Functions او Firestore دواړه Deploy کېدای شي.
- د Functions لپاره Node.js 22 اړین دی. لومړی `firebase deploy --only functions,firestore:rules` اجرا کړئ؛ بیا Android نوی APK جوړ او نصب کړئ.

یادونه: د ZIP په جوړولو سره Functions په Firebase کې نه Deploy کېږي. د Cloud Functions، Firestore Rules او Android APK حقیقي ازموینه باید د کارن په Firebase/GitHub/EAS حساب کې ترسره شي. دا پروژه د deploy تر مخه محلي syntax او static checks ته اړتیا لري.
