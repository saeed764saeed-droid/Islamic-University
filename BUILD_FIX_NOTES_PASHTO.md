# د Android Build د خطا اصلاح

د EAS Build په راپور کې درې ستونزې وې، او په دې نسخه کې یې اصلاح شوې دي:

1. په `App.js` کې `HOME_FOLDER_OPTIONS` دوه ځله تعریف شوی و. د تنظیماتو د فولډرونو لېست اوس `HOME_DESIGN_FOLDER_OPTIONS` نوم لري، او د اصلي کورپاڼې `HOME_FOLDER_OPTIONS` له نوم سره ټکر نه کوي.
2. له `app.json` څخه ناسم `expo.android.label` لرې شو. د اپلیکیشن نوم د `expo.name` له لارې ټاکل شوی دی.
3. د `@expo/config-plugins` مستقیم dependency له `package.json` او د lockfile له root dependencies څخه لرې شو؛ په `app.config.js` کې یې import اوس `expo/config-plugins` دی.
4. د `android.versionCode` ارزښت هم له `app.json` څخه لرې شو، ځکه EAS د `appVersionSource: remote` کاروي.

## ترسره شوې محلي کتنې
- `app.json` او `package.json` د JSON په توګه سم لوستل کېږي.
- `app.config.js` د Node.js syntax check تېره کړه.
- `App.js` د TypeScript JSX parser له لارې د syntax له پلوه وکتل شو.
- د HOME_FOLDER_OPTIONS د تکراري تعریف ستونزه حل شوه.

## مهم
دا ZIP په EAS کې لا نه دی Build شوی. د GitHub له لارې یې پورته کړئ او بیا د EAS Build اجرا کړئ. که نوې خطا راشي، د نوي Build د بشپړ خطا متن راولېږئ.
