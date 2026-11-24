# د Islamic-University د ZIP د کتنې او اصلاح راپور

## د ترسره شوو بدلونونو نښه

### 1) `.github/workflows/deploy-firebase.yml` — اصلاح شوی
- پخوانی workflow د `FIREBASE_SERVICE_ACCOUNT` له Secret څخه JSON فایل جوړاوه او `GOOGLE_APPLICATION_CREDENTIALS` یې ټاکه؛ خو د GitHub اجرا په پای کې Firebase CLI لا هم د تصدیق تېروتنه ورکوله.
- نوی workflow د GitHub د `FIREBASE_TOKEN` Secret کاروي، ځکه کارن د `firebase login:ci` له لارې نوی Token جوړ کړی او په GitHub کې یې ثبت کړی.
- د Deploy له مخه د `FIREBASE_TOKEN` د تشوالي کتنه ورزیاته شوه، څو که Secret ورک وي واضح خطا ښکاره شي.
- د Functions د dependency نصبولو لپاره `npm ci --omit=dev` وکارول شو، څو د package-lock له مخې تکرارېدونکی نصب وشي.
- د Deploy قوماندې ته `--token "$FIREBASE_TOKEN"` ورزیات شو.

**اړین GitHub Secret:** `FIREBASE_TOKEN`

**یادونه:** `FIREBASE_SERVICE_ACCOUNT` Secret په GitHub کې مه حذفوه؛ دا workflow اوس هغه نه کاروي. `firebase login:ci` د Firebase CLI زوړ/Deprecated میتود دی، نو دا د اوسني Deploy د سمولو لنډمهالی حل دی. وروسته باید د Service Account/ADC تصدیق جلا په کنټرول شوې ازموینه کې فعال شي.

## د نورو فایلونو په اړه
- `App.js`، `functions/index.js`، `worker/index.js`، `firestore.rules`، `storage.rules` او نور تنظیماتي فایلونه د اصلي ZIP څخه ساتل شوي؛ په دې اصلاح کې یې منطق نه دی بدل شوی، ځکه د اوسني GitHub Actions د ناکامۍ ښکاره علت د Deploy تصدیق و.
- د اصلي ZIP په دننه کې یو اضافي ناسم مسیر `functions/package.json functions/...` موجود و. دا تکراري/ناسم مسیر له پاک شوي ZIP څخه ایستل شوی؛ اصلي `functions/scripts/bootstrap_superadmins.js` پر خپل سم مسیر پاتې دی.
- هېڅ Firebase private key، Service Account JSON، Token، `.env` یا بل Secret په دې ZIP کې نه دی شامل شوی.

## ترسره شوې اتوماتیکې کتنې
- `node --check App.js` بریالی شو.
- `node --check functions/index.js` بریالی شو.
- `node --check worker/index.js` بریالی شو.
- د `firebase.json` او `package.json` JSON جوړښتونه د ZIP د کتنې پر مهال لوستل شوي.
- د GitHub Actions YAML د جوړښت کتنه ترسره شوې.

## لا نه دي ثابت شوي
- Firebase Deploy لا په GitHub Actions کې بیا نه دی اجرا شوی.
- Cloudflare Worker په Cloudflare کې بیا نه دی Deploy شوی.
- د Super Admin، Pending Lessons، د فایل اپلوډ او Android اپلیکیشن End-to-End ازموینه نه ده ترسره شوې.
- د Android APK نوی Build نه دی جوړ شوی.

## د کارولو طریقه
1. د دې ZIP محتویات په خپل GitHub Repository کې د موجودو فایلونو پر ځای اپلوډ/Commit کړئ؛ یا لږ تر لږه اصلاح شوی `.github/workflows/deploy-firebase.yml` په همدې مسیر کې بدل کړئ.
2. په GitHub → Settings → Secrets and variables → Actions کې وګورئ چې `FIREBASE_TOKEN` موجود دی.
3. Actions → Deploy Firebase Backend → Run workflow اجرا کړئ.
4. که ناکام شو، د لومړۍ سره خطا بشپړ متن راولېږئ؛ Token مه شریکوئ.
