# د میراث اسلام – Cloudflare بشپړ Backend

دا نسخه د Firebase SDK، Firebase Authentication، Firestore او Firebase Functions پر ځای Cloudflare Worker + D1 + R2 کاروي. د اپلیکیشن اصلي UI، کتابتون، تش فولډرونه، محلي AsyncStorage او افلاین فیچرونه ساتل شوي دي.

## یو ځل Cloudflare چمتو کول

1. د پروژې د `worker` فولډر ته لاړ شئ (`cd worker`)، بیا د Cloudflare حساب کې D1 Database جوړ کړئ:
   `npx wrangler d1 create mirath-islam-db`
2. د دې کمانډ په نتیجه کې database_id ترلاسه کېږي. `worker/wrangler.toml` کې د `REPLACE_WITH_D1_DATABASE_ID` پر ځای یې ولیکئ.
3. لا هم د `worker` فولډر دننه، د D1 schema تطبیق کړئ:
   `npx wrangler d1 execute mirath-islam-db --remote --file=./schema.sql`
4. د Worker لپاره قوي تصادفي راز جوړ او ثبت کړئ:
   `npx wrangler secret put AUTH_SECRET`
   لږ تر لږه ۳۲ تصادفي توري وکاروئ.
5. د لومړي ستر اډمین ایمیل ثبت کړئ:
   `npx wrangler secret put BOOTSTRAP_ADMIN_EMAIL`
   هماغه ایمیل ولیکئ چې لومړی به د اپ له تنظیماتو څخه حساب جوړوي.
6. Worker خپور کړئ:
   `npx wrangler deploy`

موجود R2 bucket باید `islamic-university-files` نوم ولري او Worker ته د `MY_BUCKET` په binding کې وصل وي.

## لومړی Super Admin

- اپ نصب/چالان کړئ، د «رسمي زده کړې» برخې له لارې د `BOOTSTRAP_ADMIN_EMAIL` ایمیل او لږ تر لږه ۸ توري پاسورډ حساب جوړ کړئ. بیا Settings ته لاړ شئ او په هماغه حساب ننوتل وکړئ.
- بیا په هماغه حساب ننوتل وکړئ او د «زما حساب د ستر اډمین په توګه فعال کړه» تڼۍ ووهئ.
- Worker ایمیل له `BOOTSTRAP_ADMIN_EMAIL` سره پرتله کوي؛ بل کارن ځان Super Admin نشي ټاکلی.
- وروسته ستر اډمین د نورو حسابونو رولونه او د اپلوډ/کتنې واکونه ټاکي.

## موبایل اپ

- `cloudflareClient.js` د Worker URL کاروي. اوسنی Worker URL په فایل کې له مخکې ثبت دی.
- د اپ د dependency نصبولو لپاره د پروژې ریښه کې `npm install` اجرا کړئ، بیا EAS build وکړئ.
- د Cloudflare ډیټابېس نوی دی؛ پخواني Firebase کارنان یا محتوا نه انتقالېږي. د دې پروژې د اړتیا له مخې پخوانۍ آنلاین Firebase ډیټا نشته.

## امنیت او چلند

- پاسورډونه د PBKDF2-SHA256 له لارې hash کېږي؛ اصلي پاسورډ نه ساتل کېږي.
- Session د Worker د `AUTH_SECRET` په وسیله لاسلیک کېږي.
- عام کارن یوازې خپاره شوي درسونه، کورسونه او عام تنظیمات لوستلای شي.
- Pending درسونه، د کارن رولونه، مدیریت او اپلوډ یوازې د اړوند صلاحیت لرونکو حسابونو لپاره دي.
- د R2 فایلونه د اپلوډ مالک یا اډمین پورته/پاکولای شي؛ خپاره شوي فایلونه عام لوستل کېدای شي.
- د ایمیل تایید اتومات نه دی فعال، ځکه SMTP/Email provider نه دی نښلول شوی. حساب د پاسورډ له لارې فعالېږي.

## د تشخیص لاره

`https://islamic-university-storage.saeed764saeed.workers.dev/health`

باید `status: online`، `d1: true`، `r2: true`، `authSecret: true` وښيي. که D1 false وي، `wrangler.toml` binding/database_id سم کړئ؛ که authSecret false وي، `wrangler secret put AUTH_SECRET` اجرا کړئ.
