# د بدلونونو یادښت

## Cloudflare Worker Admin Migration
- د پنځو اداري عملیاتو غوښتنې له Firebase Callable Functions څخه Cloudflare Worker ته انتقال شوې.
- د Worker لپاره د `FIREBASE_SERVICE_ACCOUNT` Secret له لارې د Google OAuth Service Account لاسرسی ورزیات شو.
- د Firebase ID Token تصدیق او د Firestore `userRoles` له سند څخه د سرور-اړخ واک ارزونه ساتل شوې.
- د Super Admin، Admin، Section Admin، Uploader رولونو او اجازو منطق انتقال شوی.
- د وروستي فعال Super Admin د بندېدو مخنیوی ساتل شوی.
- د درسونو forward/approve/reject او د R2 رسنیو د تایید/رد حالتونه Worker ته انتقال شوي.
- Firebase deployment اوس یوازې Firestore Rules خپروي؛ Functions او Firebase Storage نه Deploy کوي.
- موجود R2 bucket او `MY_BUCKET` binding ساتل شوي.


## 2026-11-26 – د Super Admin او Deploy اصلاحات
- د تایید شوي مالک UID لپاره د Cloudflare Worker خوندي `/bootstrap/superadmin` لاره اضافه شوه.
- د اپ تنظیماتو کې د مالک حساب لپاره د Super Admin فعالولو تڼۍ اضافه شوه.
- GitHub Actions فایلونه `.github/workflows/` ته انتقال شول.
- د Expo مالک او EAS Project ID د کارن له تایید شوو پروژوي معلوماتو سره برابر شول.
- د Gradle/Expo config plugin لپاره مستقیم dependency ثبت شو او د ورک player artwork فایل reference لرې شو.
