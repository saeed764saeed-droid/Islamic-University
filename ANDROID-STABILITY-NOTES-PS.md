# د Android د ثبات د جوړولو یادښت

- په `app.json` کې `newArchEnabled` د `false` په توګه ټاکل شوی، څو د دې پروژې د ځینو Native ماډیولونو (PDF، ZIP او Blob util) لپاره د نوي React Native Architecture احتمالي ناسازګاري کمه شي.
- د اپ اصلي `App.js`، Cloudflare Worker، D1/R2 تنظیمات، د کتابتون ډاټا او د کارن د معلوماتو د ساتلو کلیدونه نه دي حذف یا بدل شوي.
- د `package.json` او `package-lock.json` د مستقیمو dependencies لېستونه سره برابر دي.
- دا د سرچینې احتیاطي اصلاح ده، نه د APK د بریالي اجرا تضمین. د دقیق crash علت یوازې د Android `FATAL EXCEPTION` / `Caused by` له ثبت څخه تثبیتېدای شي.

## د نوې APK جوړول
د پروژې په root کې:

```bash
npm ci
npx expo-doctor
 eas build --platform android --profile preview
```

که EAS د تایید یا ننوتلو غوښتنه وکړي، د خپل حساب له لارې یې بشپړ کړئ. د زړو محلي معلوماتو د ساتلو لپاره پخوانی اپ مه حذفوئ او App data مه پاکوئ.
