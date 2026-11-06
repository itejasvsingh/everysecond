# daymark

A small, browser-based daily memory journal inspired by the idea of keeping one little piece of each day.

## Run it

From this folder, run `python3 -m http.server 4173` and open `http://localhost:4173`. No build step or external packages are required.

## Install and offline use

Serve the app over HTTPS (or localhost during development), then use the browser's install option to add daymark to your device. The service worker caches the app shell and sample artwork so it can open offline after the first visit. Saved moments and appearance preferences stay in that browser's local storage; no data is uploaded or synced.

## Firebase setup

The Firebase web configuration in `firebase-config.js` is client-side project identification, not a service-account credential. Do not add a service-account JSON or private key to this repository.

1. In Firebase Console for `daymark-a1257`, enable **Email/Password** in Authentication, create a **Firestore** database, and create the default **Cloud Storage** bucket.
2. Add the app's host to Authentication's authorized domains. `localhost` is for local development; `itejasvsingh.github.io` is included in `storage.cors.json` for GitHub Pages.
3. Install and authenticate the Firebase CLI, then run `firebase deploy --only firestore:rules,storage` from this folder to apply the per-user rules.
4. Install the Google Cloud CLI and configure authenticated access to the project. Apply the restricted CORS policy needed for authenticated, private photo reads:

   ```sh
   gcloud storage buckets update gs://daymark-a1257.firebasestorage.app --cors-file=storage.cors.json
   ```

5. Serve the app over HTTPS. Sign in or create an account from the **Sign in** button. Older moments in this browser are only moved to Firebase after you choose **Import these moments**.

Moments are stored under the signed-in user's Firestore path; photos are uploaded to that user's Storage path and read using Firebase-authenticated requests (not shareable download-token URLs). Offline saves are queued locally and uploaded when the app is online again. Firebase Storage availability and pricing depend on the project's plan.

## Keep your moments

Add a date, a short caption, and optionally a photo. While signed out, moments stay in this browser; signed-in moments sync to the private Firebase account. Appearance preferences remain local. Photos are resized before saving. The first visit shows clearly labeled sample moments to demonstrate the timeline.

## Repository

This project is plain HTML, CSS, and JavaScript. It has no runtime dependencies.
