import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase';

export const ALLOWED_ADMIN_EMAIL = (
  (process.env.NEXT_PUBLIC_ADMIN_EMAIL || '').trim() || 'kidemporer@gmail.com'
).toLowerCase();

export interface AdminSessionUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
}

export interface AdminAuthHandlers {
  onAuthorized: (user: AdminSessionUser) => void;
  onSignedOut: () => void;
  onUnauthorized?: (email: string) => void;
}

const FIREBASE_AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/popup-closed-by-user': 'Sign-in was canceled before completing.',
  'auth/cancelled-popup-request': 'Another sign-in window is already open.',
  'auth/popup-blocked':
    'Pop-up was blocked by your browser. Allow pop-ups for this site and try again.',
  'auth/unauthorized-domain':
    'This domain is not authorized in Firebase Authentication settings.',
  'auth/operation-not-allowed':
    'Google sign-in is not enabled in Firebase Authentication.',
  'auth/network-request-failed':
    'Network error while contacting Google. Check your connection and try again.',
};

export function isAuthorizedAdminEmail(
  email: string | null | undefined,
  emailVerified?: boolean
): boolean {
  if (!email || !ALLOWED_ADMIN_EMAIL || emailVerified === false) {
    return false;
  }
  return email.trim().toLowerCase() === ALLOWED_ADMIN_EMAIL;
}

export function isLocalDevHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
}

export function formatFirebaseAuthError(err: unknown): string {
  const codeFromProp =
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as { code?: unknown }).code === 'string'
      ? (err as { code: string }).code
      : undefined;

  const rawMessage = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  const codeFromMessage = rawMessage.match(/(auth\/[a-z0-9-]+)/i)?.[1]?.toLowerCase();
  const code = (codeFromProp || codeFromMessage)?.toLowerCase();

  if (code && FIREBASE_AUTH_ERROR_MESSAGES[code]) {
    return FIREBASE_AUTH_ERROR_MESSAGES[code];
  }

  if (rawMessage.trim()) {
    const cleaned = rawMessage
      .replace(/^Firebase:\s*/i, '')
      .replace(/\s*\(auth\/[a-z0-9-]+\)\.?$/i, '')
      .trim();
    if (cleaned && cleaned.toLowerCase() !== 'error') {
      return cleaned;
    }
  }

  return 'Google sign-in failed. Please try again.';
}

export async function signInAdminWithGoogle(): Promise<AdminSessionUser> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase Authentication is not configured for this build.');
  }

  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Firebase Authentication could not be initialized.');
  }

  const { GoogleAuthProvider, signInWithPopup, signOut } = await import('firebase/auth');

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account',
    login_hint: ALLOWED_ADMIN_EMAIL,
  });

  const result = await signInWithPopup(auth, provider);
  const email = result.user.email?.trim() || '';

  if (!isAuthorizedAdminEmail(email, result.user.emailVerified)) {
    await signOut(auth).catch(() => {});
    throw new Error(
      `Access denied for ${email || 'this account'}. Only the site owner's Google account is authorized.`
    );
  }

  return {
    uid: result.user.uid,
    email,
    displayName: result.user.displayName ?? null,
    photoURL: result.user.photoURL ?? null,
  };
}

export function subscribeAdminAuth(handlers: AdminAuthHandlers): () => void {
  if (!isFirebaseConfigured()) {
    handlers.onSignedOut();
    return () => {};
  }

  const auth = getFirebaseAuth();
  if (!auth) {
    handlers.onSignedOut();
    return () => {};
  }

  let cancelled = false;
  let unsubscribe: (() => void) | null = null;

  import('firebase/auth')
    .then(({ onAuthStateChanged, signOut }) => {
      if (cancelled) return;
      unsubscribe = onAuthStateChanged(auth, (user) => {
        if (cancelled) return;
        if (!user) {
          handlers.onSignedOut();
          return;
        }

        const email = user.email?.trim() || '';
        if (isAuthorizedAdminEmail(email, user.emailVerified)) {
          handlers.onAuthorized({
            uid: user.uid,
            email,
            displayName: user.displayName ?? null,
            photoURL: user.photoURL ?? null,
          });
        } else {
          void signOut(auth).catch(() => {});
          handlers.onUnauthorized?.(email || 'unknown account');
        }
      });
    })
    .catch(() => {
      if (!cancelled) {
        handlers.onSignedOut();
      }
    });

  return () => {
    cancelled = true;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };
}

export async function signOutAdmin(): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const auth = getFirebaseAuth();
  if (!auth) return;
  const { signOut } = await import('firebase/auth');
  await signOut(auth);
}
