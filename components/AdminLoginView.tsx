'use client';

import Link from 'next/link';
import { ArrowRight, Loader2, X } from 'lucide-react';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import { ScrambleHeading } from '@/components/ScrambleHeading';
import { triggerWaveNavigation } from '@/lib/navigation';
import {
  ACCORDION_TRANSITION,
  CALM_EASE,
  CollapsibleLog,
  PANEL_VIEW_VARIANTS,
  SECTION_ITEM_VARIANTS,
  TACTILE_SPRING,
} from '@/components/CollapsibleLog';

export type AdminAuthStatus = 'checking' | 'signed-out' | 'signed-in' | 'unconfigured';

interface AdminLoginViewProps {
  authStatus: Exclude<AdminAuthStatus, 'signed-in'>;
  isSigningIn: boolean;
  error: string;
  notice: string;
  sysLogs: string[];
  onGoogleSignIn: () => void;
  onDismissError: () => void;
}

const GOOGLE_BTN_VARIANTS: Variants = {
  rest: { y: 0, scale: 1 },
  hover: { y: -1, scale: 1 },
  tap: { y: 0, scale: 0.985 },
};

const GOOGLE_ARROW_VARIANTS: Variants = {
  rest: { x: 0 },
  hover: { x: 3 },
  tap: { x: 1 },
};

const RETURN_ARROW_VARIANTS: Variants = {
  rest: { x: 0 },
  hover: { x: -3 },
};

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
    >
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
    </svg>
  );
}

function MotionSpinner() {
  return (
    <motion.span
      aria-hidden="true"
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.85, ease: 'linear' }}
      className="inline-flex items-center justify-center shrink-0"
    >
      <Loader2 size={14} />
    </motion.span>
  );
}

export function AdminLoginView({
  authStatus,
  isSigningIn,
  error,
  notice,
  sysLogs,
  onGoogleSignIn,
  onDismissError,
}: AdminLoginViewProps) {
  const statusLabel =
    authStatus === 'checking'
      ? 'checking session'
      : authStatus === 'unconfigured'
      ? 'auth unconfigured'
      : isSigningIn
      ? 'signing in'
      : 'google auth';

  const buttonPhase =
    authStatus === 'checking'
      ? 'checking'
      : isSigningIn
      ? 'signing-in'
      : 'ready';

  const isDisabled = authStatus !== 'signed-out' || isSigningIn;

  return (
    <motion.article
      data-ascii-panel="true"
      variants={PANEL_VIEW_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      className="w-full min-[760px]:w-1/2 min-[760px]:max-w-[50%]"
    >
      {/* Mobile scene breathing strip matching Projects / Photography / Blog / Resume */}
      <motion.div
        variants={SECTION_ITEM_VARIANTS}
        className="max-[759px]:min-h-[17vh] max-[759px]:flex max-[759px]:flex-col max-[759px]:justify-end pb-3 sm:pb-4"
      >
        <div className="w-fit">
          <ScrambleHeading
            text="Admin"
            className="font-mono text-xl sm:text-2xl font-medium tracking-tight text-ink"
          />
        </div>
      </motion.div>

      <div className="space-y-5">
        {/* Top summary & live status strip */}
        <motion.div
          variants={SECTION_ITEM_VARIANTS}
          layout="position"
          className="border-t border-line pt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
        >
          <p className="font-sans text-xs sm:text-sm text-ink-muted leading-relaxed">
            Manage blog posts, photography, and skills.
          </p>
          <span className="font-mono text-[11px] sm:text-xs text-ink-muted shrink-0 inline-flex items-center overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={statusLabel}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.16, ease: CALM_EASE }}
                className="inline-block"
              >
                {statusLabel}
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.div>

        {/* Main authentication block */}
        <motion.section
          variants={SECTION_ITEM_VARIANTS}
          layout="position"
          aria-label="Google sign in"
          className="border-t border-line pt-5 space-y-4"
        >
          <AnimatePresence initial={false}>
            {authStatus === 'unconfigured' && (
              <motion.div
                key="unconfigured-callout"
                role="status"
                initial={{ height: 0, opacity: 0, y: -4 }}
                animate={{ height: 'auto', opacity: 1, y: 0 }}
                exit={{ height: 0, opacity: 0, y: -4 }}
                transition={ACCORDION_TRANSITION}
                className="overflow-hidden"
              >
                <div className="border border-line bg-surface/85 px-4 py-3.5 rounded-[2px] space-y-1.5">
                  <p className="font-mono text-xs text-ink">
                    Firebase Authentication is not configured.
                  </p>
                  <p className="font-sans text-xs sm:text-sm text-ink-muted leading-relaxed">
                    Set{' '}
                    <code className="font-mono text-[11px] text-ink">
                      NEXT_PUBLIC_FIREBASE_API_KEY
                    </code>
                    ,{' '}
                    <code className="font-mono text-[11px] text-ink">
                      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
                    </code>
                    , and{' '}
                    <code className="font-mono text-[11px] text-ink">
                      NEXT_PUBLIC_FIREBASE_PROJECT_ID
                    </code>{' '}
                    to enable Google sign-in.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {error && (
              <motion.div
                key="error-callout"
                id="admin-login-error"
                role="alert"
                initial={{ height: 0, opacity: 0, y: -4 }}
                animate={{ height: 'auto', opacity: 1, y: 0 }}
                exit={{ height: 0, opacity: 0, y: -4 }}
                transition={ACCORDION_TRANSITION}
                className="overflow-hidden"
              >
                <div className="border border-danger/50 bg-surface/90 px-3.5 py-2 rounded-[2px] flex items-center justify-between gap-3">
                  <p className="font-mono text-xs text-danger leading-relaxed">
                    {error}
                  </p>
                  <motion.button
                    type="button"
                    onClick={onDismissError}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.9 }}
                    transition={TACTILE_SPRING}
                    aria-label="Dismiss sign-in error"
                    className="text-ink-muted hover:text-ink transition-colors min-w-[32px] min-h-[32px] -mr-1 inline-flex items-center justify-center cursor-pointer shrink-0"
                  >
                    <X size={14} />
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {!error && notice && (
              <motion.div
                key="notice-callout"
                role="status"
                aria-live="polite"
                initial={{ height: 0, opacity: 0, y: -4 }}
                animate={{ height: 'auto', opacity: 1, y: 0 }}
                exit={{ height: 0, opacity: 0, y: -4 }}
                transition={ACCORDION_TRANSITION}
                className="overflow-hidden"
              >
                <div className="border border-line bg-surface/85 px-3.5 py-2.5 rounded-[2px] font-mono text-xs text-ink-muted leading-relaxed">
                  {notice}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            layout="position"
            className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-0.5"
          >
            <motion.button
              id="admin-google-signin"
              type="button"
              onClick={onGoogleSignIn}
              disabled={isDisabled}
              aria-busy={buttonPhase !== 'ready'}
              aria-describedby={error ? 'admin-login-error' : undefined}
              variants={GOOGLE_BTN_VARIANTS}
              initial="rest"
              whileHover={!isDisabled ? 'hover' : undefined}
              whileTap={!isDisabled ? 'tap' : undefined}
              transition={TACTILE_SPRING}
              className="font-mono text-xs px-4 py-2.5 min-h-[46px] w-full sm:w-[264px] bg-ink text-bg border border-ink hover:opacity-92 transition-opacity cursor-pointer inline-flex items-center justify-between gap-4 whitespace-nowrap disabled:opacity-55 disabled:cursor-not-allowed rounded-[2px] overflow-hidden"
            >
              <AnimatePresence mode="wait" initial={false}>
                {buttonPhase === 'checking' ? (
                  <motion.span
                    key="checking"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.18, ease: CALM_EASE }}
                    className="inline-flex items-center gap-2.5 w-full"
                  >
                    <MotionSpinner />
                    <span>Checking session…</span>
                  </motion.span>
                ) : buttonPhase === 'signing-in' ? (
                  <motion.span
                    key="signing-in"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.18, ease: CALM_EASE }}
                    className="inline-flex items-center gap-2.5 w-full"
                  >
                    <MotionSpinner />
                    <span>Connecting to Google…</span>
                  </motion.span>
                ) : (
                  <motion.span
                    key="ready"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.18, ease: CALM_EASE }}
                    className="inline-flex items-center justify-between gap-4 w-full"
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <GoogleMark className="w-3.5 h-3.5 shrink-0" />
                      <span>Continue with Google</span>
                    </span>
                    <motion.span
                      variants={GOOGLE_ARROW_VARIANTS}
                      transition={TACTILE_SPRING}
                      className="inline-flex items-center shrink-0"
                    >
                      <ArrowRight size={14} aria-hidden="true" />
                    </motion.span>
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            <Link
              href="/"
              onClick={(e) => triggerWaveNavigation('/', e)}
              className="quiet-link font-mono text-xs min-h-[44px] inline-flex items-center"
            >
              <motion.span
                initial="rest"
                whileHover="hover"
                whileTap={{ scale: 0.97 }}
                transition={TACTILE_SPRING}
                className="inline-flex items-center gap-1.5"
              >
                <motion.span
                  variants={RETURN_ARROW_VARIANTS}
                  transition={TACTILE_SPRING}
                  aria-hidden="true"
                  className="inline-block"
                >
                  ←
                </motion.span>
                <span>return to site</span>
              </motion.span>
            </Link>
          </motion.div>
        </motion.section>

        {/* Access details */}
        <motion.dl
          variants={SECTION_ITEM_VARIANTS}
          layout="position"
          className="border-t border-line pt-3.5 space-y-3 sm:space-y-2 text-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-0.5 sm:gap-4">
            <dt className="font-mono text-[11px] text-ink-muted">Access</dt>
            <dd className="font-sans text-xs text-ink/90 sm:text-right">
              Restricted to the site owner&apos;s Google account
            </dd>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-0.5 sm:gap-4">
            <dt className="font-mono text-[11px] text-ink-muted">Authentication</dt>
            <dd className="font-sans text-xs text-ink/90 sm:text-right">
              Passwordless Google sign-in via Firebase Auth
            </dd>
          </div>
        </motion.dl>

        {/* Smooth Framer Motion collapsible session log */}
        <motion.div variants={SECTION_ITEM_VARIANTS} layout="position">
          <CollapsibleLog
            id="admin-login-session-log"
            label="Session log"
            logs={sysLogs}
            maxHeightClass="max-h-32"
          />
        </motion.div>
      </div>
    </motion.article>
  );
}
