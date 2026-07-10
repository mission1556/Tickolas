# Tickolas Fresh Firebase

Tickolas e-ticketing workspace with Firebase Auth, Firestore, and a local trusted backend.

The frontend no longer creates confirmed ticket orders directly. Ticket purchase requests go through `server.js`, where Firebase Admin verifies the logged-in user, validates the event, creates the order, and updates the sold count in one transaction.

## Run Locally

```powershell
cd C:\Users\ASUS\Documents\Codex\2026-06-28\e-ticketing-website-when-a-company\tickolas-fresh-firebase
$env:DEV_PAYMENT_MODE="true"
$env:FIREBASE_SERVICE_ACCOUNT_PATH="C:\absolute\path\to\firebase-service-account.json"
node server.js
```

Open:

```text
http://localhost:3000
```

## Firebase Setup

1. Firebase Console -> Firestore Database -> Create database.
2. Firebase Console -> Authentication -> enable Email/Password.
3. Firestore Rules -> paste `firestore.rules` while testing locally.
4. Create a service account key for local backend testing, save it outside the public project folder, and set `FIREBASE_SERVICE_ACCOUNT_PATH`.
5. Run the local site.

The app uses your Firebase web config in `src/firebase.js`.

## Collections

- `organizations`
- `events`
- `orders`
- `users`

## Important

Use `firestore.rules` for local testing. Use `firestore.production.rules` only after the real payment backend is connected.

Before launch, rotate any Firebase service account key that was shared anywhere, keep private keys out of GitHub/Vercel frontend files, and put backend secrets in environment variables only.

## Payment Backend Plan

- Local testing: `POST /api/orders/dev-confirm` with `DEV_PAYMENT_MODE=true`.
- Real payment: `POST /api/payments/sslcommerz/initiate` will be connected after sandbox/live credentials are ready.
- Production rule: buyer should not directly create confirmed orders; the trusted backend verifies payment first, then writes the order.
