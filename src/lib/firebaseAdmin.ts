import { initializeApp, getApps, getApp, cert } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

const canInitialize = !!(projectId && clientEmail && privateKey);

const app = canInitialize
  ? (getApps().length === 0 
      ? initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        })
      : getApp())
  : null;

const adminAuth = app ? getAuth(app) : null as unknown as Auth;

export { adminAuth, app };
