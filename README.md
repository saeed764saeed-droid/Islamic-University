# میراث اسلام – آنلاین او افلاین علمي کتابتون

دا د موجود React Native / Expo اپ بشپړه پروژه ده. د پخواني کتابتون، AsyncStorage کلیدونه، د لمانځه وختونه، اذکار، نوټونه، نښې، د قرآن او حدیثو جوړښت، PDF/آډیو پلیر او د کورپاڼې تنظیمات ساتل شوي دي.

## د دې نسخې نوې اسانتیاوې

- د Firebase Authentication له لارې د مدیر او اپلوډر ننوتل.
- پنځه رولونه: `superadmin`، `admin`، `sectionAdmin`، `uploader` او `user`.
- اپلوډر یوازې هغو فولډرونو ته نوی MP3/PDF درس سپاري چې لوی مدیر ورته ټاکلي وي.
- د فایلونو اصلي بڼه په Firebase Cloud Storage کې د جلا `pending` مسیر لاندې پورته کېږي.
- د اپلوډر درس تر تایید مخکې عامو کاروونکو ته نه ښکاري.
- عمومي Admin د درس وروستی تایید/رد او خپرول کوي؛ Section Admin لومړنۍ کتنه کوي او درس عمومي Admin ته لېږي. د رولونو ټاکل یوازې د خوندي Cloud Functions له لارې کېږي.
- تایید شوي درسونه د برخې/فولډر له مخې همغږي کېږي او آنلاین اورېدل/لوستل کېږي.
- MP3 او PDF په موبایل کې ډاونلوډ او افلاین کارول کېدای شي.
- د موجودو تایید شوو فایلونو د بیا کارولو پر مهال د رد کولو له امله پخواني فایلونه نه حذف کېږي.

## مهم: تر نصب مخکې

دا پروژه د Firebase Rules او Cloud Functions د خپرولو او د لومړي لوی مدیر د خوندي ټاکلو اړتیا لري. یوازې ZIP نصب کول آنلاین اپلوډ نه فعالوي. د لومړي لوی مدیر UID باید د خپل Firebase Authentication حساب له Users برخې واخیستل شي؛ په کوډ کې هېڅ ایمیل، UID یا پاسورډ اټکل شوی نه دی.

د پنځو رولونو وروستۍ طرحه او د کارولو طریقه په `ADMIN_ROLES_SETUP_PASHTO.md` کې ده؛ د Firebase تخنیکي ترتیب لپاره `MEDIA_BACKEND_SETUP_PASHTO.md` هم ولولئ. د Service Account شخصي فایل هېڅکله ZIP، GitHub یا اپلیکیشن ته مه پورته کوئ.

## Android جوړول

```bash
npm install
npx expo-doctor
eas build --platform android --profile preview
```

د EAS لپاره خپل Expo حساب ته ننوتل او د پروژې معتبر `EXPO_TOKEN`/credentials اړین دي. دا ZIP APK نه دی؛ د EAS build وروسته APK جلا ترلاسه کېږي.

## د ظرفیت او لګښت یادښت

دا جوړښت د Firestore metadata، Cloud Storage object files او د فولډر پر بنسټ sync کاروي؛ ټول فایلونه په Firestore کې نه ساتي. خو د یو میلیون میاشتنیو کاروونکو لپاره ظرفیت او لګښت یوازې د کاروونکو په شمېر نه اټکل کېږي: د آډیو ساعتونه، فایلونه، د ډاونلوډ شمېر، جغرافیه او CDN cache مهم دي. د عامه پراخ خپرېدو مخکې باید Cloud Billing budget alerts، usage monitoring، rate limits، CDN/edge cache او load testing تنظیم شي. په دې ZIP کې CDN په اتومات ډول نه دی فعال شوی.

## د ازموینې حالت

د JavaScript/JSX نحوي کتنه او د Cloud Functions د فایلونو Node syntax check باید د build تر مخه بیا اجرا شي. د Firebase Rules/Functions واقعي deploy، د Storage upload، د آنلاین playback، د افلاین ډاونلوډ او د Android native PDF/آډیو عملي ازموینه د اړوند Firebase او Expo حسابونو ته اړتیا لري؛ تر هغې دا نسخه د تولید لپاره بشپړه تایید شوې نه ګڼل کېږي.
