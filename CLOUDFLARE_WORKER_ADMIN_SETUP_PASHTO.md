# د میراث اسلام د اداري سیستم د Cloudflare Worker تنظیم

## نوی جوړښت
- Firebase Authentication: د کارن ننوتل او پېژندنه.
- Firestore: د `userRoles`، `pendingLessons`، `publishedLessons`، `mediaAssets` او `auditLogs` معلومات.
- Cloudflare Worker: د پنځو اداري عملیاتو خوندي اجرا او د R2 رسنیو اداره.
- Cloudflare R2: د آډیو، PDF او نورو رسنیو فایلونه.
- Firebase Functions او Firebase Storage د دې نسخې د Deploy برخه نه دي.

## Cloudflare Secret
په Worker `islamic-university-storage` کې د Production Secret نوم باید `FIREBASE_SERVICE_ACCOUNT` وي. ارزښت یې د همدې Firebase پروژې د Service Account د JSON فایل بشپړ متن دی. دا Secret باید هېڅکله په GitHub، App.js یا عام پیغام کې ونه لیکل شي.

## د Service Account اجازې
د Google Cloud Console په IAM برخه کې د همدې Service Account ایمیل ته دا دوه رولونه ورکړئ:
1. Cloud Datastore User (`roles/datastore.user`) — د Firestore لوستل او لیکل.
2. Firebase Authentication Viewer (`roles/firebaseauth.viewer`) — د ایمیل له مخې د Auth کارن پېژندل.

د پروژې ID باید `islamic-university-27d8f` وي. د Worker په Bindings کې د R2 موجود `MY_BUCKET` binding او `islamic-university-files` bucket مه بدلوئ.

## GitHub Deploy
- `Deploy Cloudflare Worker` workflow د `worker/index.js` بدلون سره Worker خپروي.
- `Deploy Firestore Rules Only` یوازې Firestore Rules خپروي؛ Functions او Storage نه Deploy کوي.
- د GitHub Actions لپاره `CLOUDFLARE_API_TOKEN` او `FIREBASE_TOKEN` Secrets پکار دي.

## د اداري API لارې
ټولې لارې POST دي او د Firebase ID Token غواړي:
- `/admin/listPendingLessons`
- `/admin/listUserRoles`
- `/admin/setUserRoleStatus`
- `/admin/setUserRoleByEmail`
- `/admin/reviewPendingLesson`

د رول پرېکړه د Worker له خوا د Firestore `userRoles/{uid}` سند څخه کېږي؛ د موبایل له خوا رالېږل شوی رول د واک ثبوت نه ګڼل کېږي.

## مهم احتیاط
دواړه موجود Super Admin حسابونه او د هغوی `userRoles` سندونه مه حذفوئ او مه یې بیا جوړوئ. د وروستي فعال Super Admin د بندولو مخنیوی په Worker کې شته.
