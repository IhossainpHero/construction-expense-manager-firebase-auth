# Construction Expense Manager

MERN + Next.js house construction accounting app with Firebase Google authentication and admin approval.

## Access model
- Anyone can sign in with Google.
- New users are stored as Pending and see only the approval screen.
- `imran.hossainp952@gmail.com` is automatically the first Admin.
- Admin Panel shows all signed-in users.
- When Admin clicks **Approve & Give Admin Access**, that user receives `admin` role and full app access.
- Backend APIs verify Firebase ID tokens, so hiding the UI alone is not the security layer.

## Firebase setup
1. Create/select a Firebase project.
2. Authentication -> Sign-in method -> enable Google.
3. Add your local/dev and production domains under Authentication -> Settings -> Authorized domains.
4. Create a Web App and copy its config into `frontend/.env.local`.
5. Create a Firebase Admin SDK service account and put its values in `backend/.env`. Never commit the private key.

### frontend/.env.local
Copy `frontend/.env.local.example`.

### backend/.env
Copy `backend/.env.example` and fill Firebase Admin credentials.

## Run
```bash
cd backend
npm install
npm run dev

cd ../frontend
npm install
npm run dev
```

Open http://localhost:3000

## Important security note
The ZIP intentionally does not include any real MongoDB password/URI or Firebase private key. Put your existing MongoDB URI back into `backend/.env` and add Firebase Admin credentials there.

## Admin behavior
The hard-coded bootstrap admin email is `imran.hossainp952@gmail.com`. Do not change this unless you want another account to be the bootstrap administrator.

## Google sign-in behavior
A Google account can authenticate successfully, but until an admin approves it the user sees only the Pending Approval screen. No dashboard, parties, ledger, payments, or admin data is exposed. The backend also rejects protected API requests from pending users.
