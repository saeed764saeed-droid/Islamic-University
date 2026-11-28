# د Cloudflare نسخې بدلونونه

- د اپلیکیشن Auth او Firestore عملیات د `cloudflareClient.js` له لارې Cloudflare Worker API ته واړول شول.
- کارن حسابونه او رولونه په Cloudflare D1 کې ساتل کېږي؛ پاسورډونه PBKDF2-SHA256 hash کېږي.
- د درسونو metadata، Pending/Review/Publish او رسمي زده کړو کورسونه د D1 له لارې اداره کېږي.
- د آډیو، PDF، ویډیو او پوښونو فایلونه په Cloudflare R2 کې ساتل کېږي.
- د Firebase SDK dependency، Firebase config، Firestore/Storage rules، Firebase Functions او Firebase deploy workflow لرې شول.
- د اصلي App.js UI او محلي AsyncStorage کلیدونه ساتل شوي؛ د موبایل آفلاین فایلونو سیستم نه دی حذف شوی.
- د Super Admin لومړنی حساب د `BOOTSTRAP_ADMIN_EMAIL` Worker secret له لارې محدود شوی.

د Worker/D1 حقیقي deploy او Android EAS build باید د Cloudflare او Expo حسابونو له لارې ترسره شي؛ محلي syntax کتنه د دې deploy بدیل نه دی.
