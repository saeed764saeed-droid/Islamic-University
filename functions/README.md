# Legacy Firebase Functions (not deployed)

This directory is retained as a historical backup of the former callable-function implementation. The current app calls the Cloudflare Worker `/admin/*` endpoints instead. `firebase.json` and `.github/workflows/deploy-firebase.yml` intentionally do not deploy this directory. Do not run `firebase deploy --only functions`; that would require the Firebase Blaze plan and is not part of the current architecture.
