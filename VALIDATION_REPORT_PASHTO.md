# د میراث اسلام – د اداري رولونو، نومونو او پوښونو د ادغام راپور

## ساتل شوي سیستمونه

- د پنځو اداري رولونو ماډل: `superadmin`, `admin`, `sectionAdmin`, `uploader`, `user`.
- عمومي Admin د ټولو ۱۶ علمي برخو د مدیریت او وروستي خپرولو واک لري.
- Section Admin یوازې ټاکل شوې علمي برخې ګوري او درس عمومي Admin ته استوي.
- Uploader یوازې ټاکل شوي فولډرونو ته مواد سپاري؛ عادي User یوازې خپاره شوي مواد لولي.
- د وروستي Super Admin د لرې کولو/تنزیل مخنیوی او Audit Logs ساتل شوي.
- د کتابونو، درسونو، ګډ کتابتون، آډیو/PDF د پیل او پای نقطو، یادښتونو، اذکارو، لمانځه، خوښ شویو فایلونو او نورو پخوانیو برخو کوډ ساتل شوی.
- د AsyncStorage پخوانۍ کلیدونه نه دي بدل شوي؛ د آفلاین فایلونو لپاره هماغه `offline_media_v1` کارول کېږي.

## په دې نسخه کې اضافه شوي اصلاحات

- د پښتو/عربي ګډو نومونو لپاره محدود محلي املايي وړاندیزونه.
- د آډیو د نوم وړاندیز او د نوم د لاسي تایید بهیر ساتل شوی.
- د PDF لپاره د ښکاره نوم ثبت او د `.pdf` extension ساتل.
- د آډیو د هر ټریک پوښ د جلا Firebase image asset په توګه د Pending/Review بهیر ته نښلول شوی.
- د PDF پوښ ټاکل، metadata، آنلاین تایید او خپرول اضافه شوي.
- د آډیو آفلاین ډاونلوډ له پوښ عکس سره جوړه شوې؛ پوښ جلا فایل دی، خو د آډیو له URI سره په `offline_media_v1` کې تړل کېږي.
- د PDF آفلاین ډاونلوډ هم د PDF پوښ عکس جلا خوندي کوي.
- د Lock Screen او پلیر لپاره د آفلاین پوښ URI کارول کېږي.

## اتوماتيک تخنیکي کتنې چې ترسره شوې

- `App.js` د TypeScript parser له لارې د JSX/JavaScript د syntax کتنې څخه تېر شو (`tsc --allowJs --checkJs false --jsx react --noEmit --skipLibCheck --noResolve --target ES2020 App.js`).
- `functions/index.js` او `functions/scripts/bootstrap_superadmins.js` د `node --check` څخه تېر شول.
- د JSON تنظیماتي فایلونه د JSON parser له لارې تایید شول.
- د نوم د اصلاح دندې په څو پښتو/عربي بېلګو وازمویل شوې.
- د ZIP دننه د `App.js`، Firebase Functions، Firestore/Storage Rules، Expo config، assets او لارښودونو شتون تایید شو.

## لا نه دي عملي تایید شوي

- Android EAS build او په واقعي موبایل کې نصب/ازموینه.
- د Firebase Rules او Functions واقعي Deploy او د پنځو رولونو end-to-end ازموینه.
- د Firebase Storage حقیقي اپلوډ/ډاونلوډ او د تولیدي کارونې امنیتي ازموینه.
- د MP3 دننه د ID3 پوښ لیکل: په دې نسخه کې نه دي عملي شوي؛ پوښ د MP3 ترڅنګ د جلا image فایل په توګه ساتل کېږي.
- د املا وړاندیزونه بشپړ لغت‌لیک نه دی؛ محدود محلي قواعد دي او انساني تایید غواړي.
- TeraBox API نښلول لا نه دي شوي.

## د سرچینې او اپلوډ مهم وضاحت

دا ZIP د Library کې د کارن له خوا منل شوې وروستۍ محلي بشپړې پروژې او د پنځو رولونو ادغام له نسخې څخه جوړ شوی. د GitHub د `main/App.js` پخوانی ثبت شوی SHA له دې محلي `App.js` سره توپیر درلود؛ نو دا ZIP د GitHub له اوسني فایل سره د اتومات یو-پر-یو برابرۍ ادعا نه کوي. دا د بشپړې پروژې د اپلوډ لپاره جلا package دی. په دې کار کې GitHub ته هېڅ بدلون Push شوی نه دی.

**د APK جوړول، Firebase Deploy او د موبایل حقیقي ازموینه لا نه ده شوې. دا د اپلوډ او ازموینې لپاره ادغام شوی package دی، نه د تولید لپاره تصدیق شوی release.**

## د دې اصلاح شوې نسخې نوې کتنې

- د Super Admin حسابونو د لېست لپاره `listUserRoles` callable اضافه شو (یوازې Super Admin).
- د حساب فعال/بندولو لپاره `setUserRoleStatus` callable اضافه شو؛ وروستی فعال Super Admin نه بندېږي.
- د موجود حساب د رول او ټاکل شوو اجازو د سمون لپاره د اپ په تنظیماتو کې فورم ته د معلوماتو راوړلو تڼۍ اضافه شوه.
- د Firebase UID او د رول د `active` حالت تشخیصي ښودنه اضافه شوه.
- د دې اصلاحاتو لپاره د Firebase Deploy او حقیقي Android/Firebase ازموینه لا هم د پروژې مالک باید ترسره کړي.

## د Super Admin د فایل/اجازو د اصلاح نوې نسخه

- د Super Admin د رول لپاره د Firestore او Storage د `active` چک اصلاح شو: که `active` ساحه ورکه وي Super Admin فعال ګڼل کېږي؛ که په ښکاره `false` وي، بند پاتې کېږي.
- د Super Admin لپاره د ټولو فولډرونو اپلوډ او د محتوا د اصلاح واک په App، Firestore Rules او Storage Rules کې برابر شو.
- د کارن د هر رول لپاره د `permissions` ځانګړی Map اضافه شو؛ د موجودې اجازې `true/false` د رول پر اصلي واک لومړیتوب لري.
- د غیرعمومي رولونو لپاره د علمي برخې او `section::folder` د ټاکلو واک اضافه شو.
- د کارنانو او رولونو اداره یوازې Super Admin ته محدوده شوه؛ عمومي Admin د Super Admin/عمومي Admin حسابونه نه شي بدلولی.
- د موجود Super Admin د بیا Bootstrap کولو اړتیا نشته؛ د setup لارښود کې د Bootstrap د بیا اجرا منع لیکل شوې.
- `node --check App.js`، `node --check functions/index.js` او د JSON فایلونو parsing بریالي شول.
- د Firebase Rules د Emulator/Production د عملي ازموینې، Firebase Deploy، د Android build او د موبایل د حقیقي اپلوډ ازموینه لا نه ده ترسره شوې.

## د Cloudflare Worker Admin انتقال – 2026-11-24

- د App.js پنځه Callable Functions غوښتنې د Cloudflare Worker `/admin/*` لارو ته واړول شوې.
- Worker کې د Firebase Service Account JWT/OAuth، Firestore REST او Identity Toolkit `projects:queryAccounts` اتصال ورزیات شو.
- د Identity Toolkit د `userInfo` ځواب بڼه د Google رسمي REST API له مستنداتو سره برابره شوه.
- CORS کې POST اجازه ورزیاته شوه.
- `firebase.json` اوس یوازې Firestore Rules لري؛ GitHub Firebase workflow نور Functions یا Storage نه Deploy کوي.
- موجود R2 binding `MY_BUCKET` او bucket نوم نه دي بدل شوي.
- د Worker `node --check` بریالی شو؛ د App.js JSX/JavaScript parsing د TypeScript transpile parser له لارې صفر diagnostics ورکړل.
- د JSON config فایلونه parse شول.
- **لا نه دي اجرا شوي:** د Cloudflare حقیقي deploy، د Google IAM role ازموینه، د Worker secret حقیقي OAuth token exchange، د Firestore عملیاتو end-to-end ازموینه، Android EAS Build او د موبایل حقیقي upload/approve/reject ازموینه. د دې لپاره د کارن Cloudflare/Firebase/GitHub/EAS حسابونو ته لاسرسی اړین دی.


## 2026-11-26 – د ZIP پر بنسټ اصلاحات
- د مالک UID لپاره Worker endpoint او د اپ دننه د فعالولو تڼۍ اضافه شوې.
- د GitHub workflow مسیر `.github/workflows/` ته سم شو.
- Expo owner/projectId د پروژې د ثبت شوو معلوماتو سره برابر شول.
- د `@expo/config-plugins` مستقیم dependency اضافه شو.
- د ورک player artwork asset ته reference لرې شو، ځکه ZIP کې د `assets/` فولډر نه و.
- د Worker، Functions او bootstrap سکریپټ JavaScript syntax کتنه او د App.js JSX parse کتنه ترسره کېږي.
- Cloudflare/Firebase Deploy، د Worker Secret واقعي تایید، د Firebase role document لوستل، او Android APK build د حسابونو له اجازې پرته لا نه دي تایید شوي.
