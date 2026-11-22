# د بدلونونو یادښت – د Super Admin او اجازو نوې نسخه

- د Super Admin د اپلوډ او د معلوماتو د اصلاح واک په App، Firestore Rules او Storage Rules کې یو شان او بشپړ شو.
- د پخواني Super Admin سند لپاره د `active` د ساحې د نشتوالي compatibility ورزیاته شوه؛ څرګند `active: false` لا هم حساب بندوي.
- د هر حساب لپاره د ځانګړو permissions ملاتړ ورزیات شو: upload، createContent، editContent، deleteContent، publish، manageLibrary، editSettings، review او viewAudit.
- د رول اصلي واکونه د permissions Map له ځانګړو overrideونو سره یوځای تطبیقېږي.
- د غیرعمومي رولونو لپاره د علمي برخو او فولډرونو محدودیت د ټولو هغو رولونو لپاره فعال شو چې د اپلوډ اجازه ورته ټاکل کېږي.
- د رول/حساب اداره یوازې Super Admin ته محدوده شوه.
- د وروستي فعال Super Admin د بندولو او د هغه د رول د لرې کولو مخنیوی وساتل شو.
- د اجازو د بدلون معلومات audit log ته ورزیاتېږي.
- د لومړي Super Admin Bootstrap بیا اجرا ته اړتیا نشته.
