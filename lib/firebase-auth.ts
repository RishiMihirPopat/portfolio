import { getAuth, type Auth } from 'firebase/auth';
import { getApp, isFirebaseConfigured } from './firebase';

let _auth: Auth | null = null;

export function isFirebaseAuthConfigured(): boolean {
  return Boolean(
    isFirebaseConfigured() && process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  );
}

export function getFirebaseAuth(): Auth | null {
  const appInstance = getApp();
  if (!appInstance) return null;
  if (!_auth) {
    _auth = getAuth(appInstance);
  }
  return _auth;
}
