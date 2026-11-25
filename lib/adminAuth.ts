export const DEFAULT_ADMIN_EMAIL = 'kidemporer@gmail.com';

export interface AdminAuthCandidate {
  isAnonymous?: boolean;
  email?: string | null;
  emailVerified?: boolean;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getAllowedAdminEmails(rawEnv?: string): string[] {
  const source = rawEnv ?? process.env.NEXT_PUBLIC_ADMIN_EMAILS;
  if (!source) {
    return [DEFAULT_ADMIN_EMAIL];
  }
  const parsed = source
    .split(',')
    .map((entry) => normalizeEmail(entry))
    .filter(Boolean);
  return parsed.length > 0 ? Array.from(new Set(parsed)) : [DEFAULT_ADMIN_EMAIL];
}

export function isAllowedAdminEmail(
  email: string | null | undefined,
  rawEnv?: string
): boolean {
  if (!email) return false;
  return getAllowedAdminEmails(rawEnv).includes(normalizeEmail(email));
}

export function isAuthorizedAdminUser(
  user: AdminAuthCandidate | null | undefined,
  rawEnv?: string
): boolean {
  if (!user || user.isAnonymous) return false;
  if (!user.email || !user.emailVerified) return false;
  return isAllowedAdminEmail(user.email, rawEnv);
}

export interface FormattedAuthError {
  message: string;
  shouldFallbackToRedirect: boolean;
  isCancelled: boolean;
}

export function formatFirebaseAuthError(error: unknown): FormattedAuthError {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';

  switch (code) {
    case 'auth/popup-blocked':
    case 'auth/operation-not-supported-in-this-environment':
      return {
        message: 'Sign-in popup was blocked. Redirecting to Google...',
        shouldFallbackToRedirect: true,
        isCancelled: false,
      };
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return {
        message: 'Sign-in was cancelled before completion.',
        shouldFallbackToRedirect: false,
        isCancelled: true,
      };
    case 'auth/unauthorized-domain':
      return {
        message:
          'This domain is not authorized for Google sign-in. Add it in Firebase Console → Authentication → Settings → Authorized domains.',
        shouldFallbackToRedirect: false,
        isCancelled: false,
      };
    case 'auth/operation-not-allowed':
      return {
        message:
          'Google sign-in is not enabled in Firebase Authentication. Enable the Google provider in Firebase Console.',
        shouldFallbackToRedirect: false,
        isCancelled: false,
      };
    case 'auth/network-request-failed':
      return {
        message: 'Network error while contacting Google. Check your connection and try again.',
        shouldFallbackToRedirect: false,
        isCancelled: false,
      };
    case 'auth/account-exists-with-different-credential':
      return {
        message: 'An account already exists with this email using a different sign-in method.',
        shouldFallbackToRedirect: false,
        isCancelled: false,
      };
    default: {
      const fallback =
        error instanceof Error && error.message
          ? error.message
          : 'Google sign-in failed. Please try again.';
      return {
        message: fallback,
        shouldFallbackToRedirect: false,
        isCancelled: false,
      };
    }
  }
}
