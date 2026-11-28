# میراث اسلام — Cloudflare Edition

دا پروژه د اسلامي علمي کتابتون د React Native/Expo اپلیکیشن دی. د اصلي اپلیکیشن ډیزاین، د کتابونو او درسونو جوړښت، محلي تنظیمات، نوټونه، خوښې، اذکار، لمونځ وختونه، آفلاین فایلونه او نور موجود UI فیچرونه ساتل شوي دي.

## Backend

- Cloudflare Worker: API، ننوتل، رولونه، صلاحیتونه، د درسونو کتنه/خپرول او د رسنیو لاسرسی.
- Cloudflare D1: د کارن حسابونه، رولونه، د درسونو metadata، کورسونه، enrollment، ازموینې او نور JSON اسناد.
- Cloudflare R2: د آډیو، PDF، ویډیو او نورو رسنیو اصلي فایلونه.
- موبایل: د کارن شخصي نوټونه، خوښې، تنظیمات او آفلاین فایلونه په محلي حافظه کې ساتي.

**په دې پروژه کې د Firebase SDK، Firebase Authentication، Firestore، Firebase Functions، Firebase config او Firebase deploy workflow نشته.**

## د نصب او خپرولو لار

1. د Cloudflare بشپړ تنظیم، D1 database، secrets او R2 binding لپاره `CLOUDFLARE_MIGRATION_SETUP_PASHTO.md` ولولئ.
2. د `worker/wrangler.toml` د `database_id` ارزښت د خپل Cloudflare D1 ID سره بدل کړئ.
3. د D1 schema تطبیق او Worker deploy کړئ.
4. د اپ ریښه کې `npm install` او بیا `npx expo start` یا د EAS Android build اجرا کړئ.
5. د لومړي ستر اډمین لپاره، د `BOOTSTRAP_ADMIN_EMAIL` ایمیل په وسیله د Formal Learning له برخې حساب جوړ کړئ، بیا په Settings کې ننوتل او د Super Admin فعالولو تڼۍ وکاروئ.

## د ازموینې حدود

په دې چاپېریال کې د Worker JavaScript syntax، د D1 schema، د پروژې د Firebase importونو حذف او د ZIP جوړښت محلي کتنه کېږي. د کارن د Cloudflare حساب ته لاسرسی نه لرو؛ نو D1 database باید د کارن په حساب کې جوړ، secretونه ثبت او Worker deploy شي. تر دې کارونو او د حقیقي Android device د end-to-end ازموینې مخکې دا فایلونه د بشپړ deploy شوي production release په توګه مه ګڼئ.
