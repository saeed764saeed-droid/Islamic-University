# میراث اسلام – آنلاین او افلاین علمي کتابتون

دا د React Native / Expo اپ بشپړه پروژه ده. د پخواني کتابتون، AsyncStorage کلیدونه، د لمانځه وختونه، اذکار، نوټونه، نښې، قرآن او حدیث جوړښت، PDF/آډیو پلیر او د کورپاڼې تنظیمات ساتل شوي دي.

## د آنلاین سیستم جوړښت
- Firebase Authentication د ننوتلو او د کارن د پېژندنې لپاره.
- Firestore د رولونو، درسونو، رسنیو او audit معلوماتو لپاره.
- Cloudflare Worker د اداري عملیاتو، د فایلونو اپلوډ، تایید، رد او خپرولو لپاره.
- Cloudflare R2 د MP3، PDF او نورو فایلونو لپاره.
- Firebase Functions او Firebase Storage د دې نسخې د deploy برخه نه دي؛ د Firebase Blaze پلان ته د Functions لپاره اړتیا نشته.

## اداري رولونه
پنځه رولونه شته: `superadmin`، `admin`، `sectionAdmin`، `uploader` او `user`. د دواړو موجودو Super Admin حسابونو `userRoles/{uid}` سندونه ساتل کېږي. د وروستي فعال Super Admin د بندېدو/لرې کېدو مخنیوی د Worker په سرور-اړخ کوډ کې شته.

## تر Deploy مخکې
1. د Cloudflare Worker نوم `islamic-university-storage`، R2 binding `MY_BUCKET` او bucket `islamic-university-files` مه بدلوئ.
2. په Worker Production Secrets کې `FIREBASE_SERVICE_ACCOUNT` باید د همدې Firebase پروژې د Service Account بشپړ JSON ولري.
3. په Google Cloud IAM کې دې Service Account ته `Cloud Datastore User` (`roles/datastore.user`) او `Firebase Authentication Viewer` (`roles/firebaseauth.viewer`) ورکړئ.
4. د GitHub Actions Secrets کې `CLOUDFLARE_API_TOKEN`، `FIREBASE_TOKEN` او د APK لپاره `EXPO_TOKEN` موجود وي.
5. د `CLOUDFLARE_WORKER_ADMIN_SETUP_PASHTO.md` او `README-DEPLOY-PASHTO.md` لارښودونه تعقیب کړئ.

**د Service Account JSON، خصوصي کیلي، پاسورډ او Token هېڅکله GitHub، App.js یا عام چټ ته مه پورته کوئ.**

## Android جوړول
```bash
npm ci
npx expo-doctor
eas build --platform android --profile preview
```
APK یوازې د EAS Build له بریالي بشپړېدو وروسته ترلاسه کېږي. د Backend د Deploy او ازموینې تر بشپړېدو مخکې Build مه کوئ.

## د ازموینې حالت
د Worker JavaScript syntax او د App.js JSX parsing کتنه شوې؛ خو د Cloudflare حقیقي Deploy، د Google IAM اجازې، د Firebase/Worker end-to-end عملیات او د Android APK Build لا په دې چاپېریال کې نه دي اجرا شوي. نو دا ZIP د Deploy او حقیقي ازموینې لپاره چمتو شوی، خو لا د تولید لپاره تایید شوی release نه دی.


## First Super Admin bootstrap

The verified owner UID is `CtaXP0WGrFfusIKSsMFYP4ZKb6P2`. After deploying `worker/index.js`, sign in to the app with that Firebase account and use the owner-only button in Settings. The Worker verifies the Firebase ID token and writes the `userRoles/{uid}` record using its Cloudflare secret. Never commit the Firebase service-account JSON.
