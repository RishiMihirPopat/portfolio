'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
  useReducedMotion,
  type Variants,
} from 'motion/react';
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import ReactMarkdown from 'react-markdown';
import { extractDataImages, createImgRenderer } from '@/lib/markdown';
import {
  savePost,
  savePhotos,
  fetchAllSkills,
  saveSkill,
  deleteSkill,
  fetchAllPosts,
  fetchAllPhotos,
  fetchAllCollections,
  saveCollection,
  updateCollection,
  deleteCollection,
  renameCollectionAcrossPhotos,
  fetchHiddenRepos,
  saveHiddenRepos,
  deletePost,
  deletePhoto,
  updatePost,
  updatePhoto,
} from '@/lib/storage';
import { Skill, Post, Photo, PhotoCollection, Repo, mockRepos } from '@/lib/data';
import { useGithubRepos } from '@/hooks/useGithubRepos';
import {
  getFirebaseAuth,
  isFirebaseAuthConfigured,
  isFirebaseConfigured,
} from '@/lib/firebase';
import {
  formatFirebaseAuthError,
  isAuthorizedAdminUser,
} from '@/lib/adminAuth';
import {
  extractPhotoExif,
  formatExposureSummary,
  type PhotoExifMetadata,
} from '@/lib/exif';
import { AdminLoginView, AdminAuthStatus } from '@/components/AdminLoginView';
import {
  ACCORDION_TRANSITION,
  CALM_EASE,
  CollapsibleLog,
  GLIDE_SPRING,
  PANEL_VIEW_VARIANTS,
  SECTION_ITEM_VARIANTS,
  TACTILE_SPRING,
  WAVE_EXIT_EASE,
} from '@/components/CollapsibleLog';
import { ScrambleHeading } from '@/components/ScrambleHeading';

const DEFAULT_SKILL_CATEGORIES = [
  'Languages & Stats',
  'Methods & Modeling',
  'Libraries & Tools',
];

type AdminTab =
  | 'blog'
  | 'manage-blog'
  | 'photo'
  | 'manage-photo'
  | 'collections'
  | 'projects'
  | 'skills';

const TAB_ORDER: AdminTab[] = [
  'blog',
  'manage-blog',
  'photo',
  'manage-photo',
  'collections',
  'projects',
  'skills',
];

const TAB_PANEL_VARIANTS: Variants = {
  enter: (dir: number) => ({
    opacity: 0,
    x: dir * 14,
    filter: 'blur(1.5px)',
  }),
  center: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.24,
      ease: CALM_EASE,
    },
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir * -14,
    filter: 'blur(1.5px)',
    transition: {
      duration: 0.16,
      ease: WAVE_EXIT_EASE,
    },
  }),
};

interface AuthUserSummary {
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface PendingDeleteTarget {
  kind: 'post' | 'photo' | 'collection';
  id: string;
  title: string;
}

interface StatusFeedback {
  kind: 'success' | 'error';
  text: string;
}

interface CompressedImage {
  url: string;
  width: number;
  height: number;
}

interface PendingPhoto extends PhotoExifMetadata {
  id: string;
  url: string;
  title: string;
  description: string;
  width: number;
  height: number;
}

const INPUT_CLASS =
  'w-full bg-surface/90 border border-line px-3 py-2.5 min-h-[44px] text-base sm:text-sm text-ink placeholder:text-ink-muted/70 focus:border-ink focus:outline-none transition-colors rounded-[2px]';
const LABEL_CLASS = 'block font-mono text-xs text-ink-muted';
const PRIMARY_BTN_CLASS =
  'font-mono text-xs px-4 py-2.5 min-h-[44px] bg-ink text-bg border border-ink hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed rounded-[2px]';
const SECONDARY_BTN_CLASS =
  'font-mono text-xs px-3.5 py-2 min-h-[44px] bg-surface/85 text-ink border border-line hover:border-ink transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed rounded-[2px]';
const INLINE_ACTION_CLASS =
  'font-mono text-xs text-ink-nav hover:text-ink underline underline-offset-4 cursor-pointer min-h-[36px] inline-flex items-center';
const DANGER_INLINE_CLASS =
  'font-mono text-xs text-red-700 dark:text-red-400 hover:underline underline-offset-4 cursor-pointer min-h-[36px] inline-flex items-center';

function summarizePostContent(raw: string): string {
  const firstParagraph = raw
    .replace(/[#*`]/g, '')
    .split(/\n\s*\n/)[0]
    ?.trim();
  return firstParagraph || raw.replace(/[#*`]/g, '').slice(0, 140);
}

function createGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

interface ModalDialogProps {
  onClose: () => void;
  titleId: string;
  title: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

function ModalDialog({
  onClose,
  titleId,
  title,
  maxWidthClass = 'max-w-lg',
  children,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      dialog.showModal();
    }
    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="fixed inset-0 m-0 p-0 w-screen h-dvh max-w-none max-h-none bg-transparent border-0 text-ink overflow-hidden backdrop:bg-transparent backdrop:backdrop-blur-none"
    >
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: CALM_EASE }}
        onClick={onClose}
        className="fixed inset-0 bg-black/58 backdrop-blur-[3px]"
      />
      <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0, transition: GLIDE_SPRING }}
          exit={{
            opacity: 0,
            scale: 0.97,
            y: 6,
            transition: { duration: 0.18, ease: CALM_EASE },
          }}
          className={`pointer-events-auto w-full ${maxWidthClass} max-h-[85vh] bg-bg/95 border border-line text-ink rounded-[2px] shadow-2xl overflow-hidden flex flex-col`}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-line shrink-0">
            <h2
              id={titleId}
              className="font-mono text-xs uppercase tracking-wider text-ink-muted truncate pr-4"
            >
              {title}
            </h2>
            <motion.button
              type="button"
              onClick={onClose}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
              transition={TACTILE_SPRING}
              className="text-ink-muted hover:text-ink transition-colors p-1.5 min-w-[36px] min-h-[36px] inline-flex items-center justify-center cursor-pointer"
              aria-label="Close dialog"
            >
              <X size={16} />
            </motion.button>
          </div>
          <div className="p-6 overflow-y-auto text-ink text-sm leading-relaxed">
            {children}
          </div>
        </motion.div>
      </div>
    </dialog>
  );
}

export default function Admin() {
  const prefersReducedMotion = useReducedMotion();

  // Firebase Google Auth state (restricted to authorized admin email)
  const [authStatus, setAuthStatus] = useState<AdminAuthStatus>(() =>
    isFirebaseAuthConfigured() ? 'checking' : 'unconfigured'
  );
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginNotice, setLoginNotice] = useState('');

  const isAuthenticated = authStatus === 'signed-in';

  // Tab state + directional tracking for motion slide
  const [activeTab, setActiveTab] = useState<AdminTab>('blog');
  const [tabDirection, setTabDirection] = useState<number>(1);

  // Management lists and editing states
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [allCollections, setAllCollections] = useState<PhotoCollection[]>([]);
  const [hiddenRepos, setHiddenRepos] = useState<string[]>([]);
  const [customHiddenRepoName, setCustomHiddenRepoName] = useState('');
  const { repos: liveRepos } = useGithubRepos();
  const [photoFilterCollection, setPhotoFilterCollection] = useState<string>('__all__');
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [editPhotoTitle, setEditPhotoTitle] = useState('');
  const [editPhotoDescription, setEditPhotoDescription] = useState('');
  const [editPhotoMeta, setEditPhotoMeta] = useState<PhotoExifMetadata>({});
  const [newColName, setNewColName] = useState('');
  const [newColDescription, setNewColDescription] = useState('');
  const [newColHidden, setNewColHidden] = useState(false);
  const [editingCollection, setEditingCollection] = useState<PhotoCollection | null>(null);
  const [editColName, setEditColName] = useState('');
  const [editColDescription, setEditColDescription] = useState('');
  const [editColCoverPhotoId, setEditColCoverPhotoId] = useState('');
  const [editColHidden, setEditColHidden] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteTarget | null>(null);
  const [fbUser, setFbUser] = useState<AuthUserSummary | null>(null);

  // Skills state
  const [skills, setSkills] = useState<Skill[]>([]);
  const [newSkillLabel, setNewSkillLabel] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState(DEFAULT_SKILL_CATEGORIES[0]);

  // Blog / upload form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [feedback, setFeedback] = useState<StatusFeedback | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [isDraggingPhotos, setIsDraggingPhotos] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inlineImageRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const selectPhotosButtonRef = useRef<HTMLButtonElement>(null);
  const tabButtonRefs = useRef<Partial<Record<AdminTab, HTMLButtonElement | null>>>({});
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waveReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingWaveFadeInRef = useRef(false);
  const interactiveSignInRef = useRef(false);
  const lastAuthEventRef = useRef<string | null>(null);

  // Inline images state
  const [inlineImages, setInlineImages] = useState<{ id: number; name: string; url: string }[]>([]);
  const inlineImageCounter = useRef(0);

  // Photo uploading state
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [batchCollection, setBatchCollection] = useState('');

  // Diagnostic action log
  const [sysLogs, setSysLogs] = useState<string[]>(() => [
    'Session initialized.',
    isFirebaseAuthConfigured()
      ? 'Checking Google authentication state...'
      : 'Firebase Authentication is not configured.',
  ]);

  const addLog = useCallback((msg: string) => {
    setSysLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const clearRedirectTimer = useCallback(() => {
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
  }, []);

  const releaseWaveFadeIn = useCallback(() => {
    if (waveReleaseTimerRef.current) {
      clearTimeout(waveReleaseTimerRef.current);
      waveReleaseTimerRef.current = null;
    }
    if (pendingWaveFadeInRef.current) {
      pendingWaveFadeInRef.current = false;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ascii-page-fade-in'));
      }
    }
  }, []);

  const startWaveViewTransition = useCallback(() => {
    if (prefersReducedMotion || typeof window === 'undefined') return;
    pendingWaveFadeInRef.current = true;
    window.dispatchEvent(new CustomEvent('ascii-wave-wash'));
    if (waveReleaseTimerRef.current) clearTimeout(waveReleaseTimerRef.current);
    waveReleaseTimerRef.current = setTimeout(() => {
      releaseWaveFadeIn();
    }, 580);
  }, [prefersReducedMotion, releaseWaveFadeIn]);

  useEffect(() => {
    return () => {
      clearRedirectTimer();
      releaseWaveFadeIn();
    };
  }, [clearRedirectTimer, releaseWaveFadeIn]);

  // Listen to Firebase Auth state changes and settle any redirect sign-in
  useEffect(() => {
    if (!isFirebaseAuthConfigured()) return;
    const auth = getFirebaseAuth();
    if (!auth) return;

    const REDIRECT_FLAG = 'admin_google_redirect_pending';
    let hasPendingRedirect = false;
    try {
      hasPendingRedirect = window.sessionStorage.getItem(REDIRECT_FLAG) === '1';
    } catch {
      hasPendingRedirect = false;
    }

    let cancelled = false;
    let redirectSettled = !hasPendingRedirect;
    let authStateSeen = false;
    let latestUser: User | null = null;
    let redirectFallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const clearRedirectFlag = () => {
      try {
        window.sessionStorage.removeItem(REDIRECT_FLAG);
      } catch {
        // Ignore storage restrictions
      }
    };

    const applyAuthState = async (user: User | null) => {
      if (cancelled) return;

      if (!user) {
        lastAuthEventRef.current = null;
        setFbUser(null);
        if (redirectSettled && authStateSeen) {
          setAuthStatus('signed-out');
        }
        return;
      }

      if (isAuthorizedAdminUser(user)) {
        clearRedirectFlag();
        const eventKey = `ok:${user.uid}`;
        if (interactiveSignInRef.current) {
          interactiveSignInRef.current = false;
          startWaveViewTransition();
        }
        setFbUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
        });
        setAuthStatus('signed-in');
        setIsSigningIn(false);
        setLoginError('');
        setLoginNotice('');
        if (lastAuthEventRef.current !== eventKey) {
          lastAuthEventRef.current = eventKey;
          addLog(`Signed in with Google as ${user.email}.`);
        }
        return;
      }

      // Immediately reject unauthorized Google accounts or legacy anonymous sessions
      clearRedirectFlag();
      interactiveSignInRef.current = false;
      const eventKey = `denied:${user.uid}`;
      const shouldReport = lastAuthEventRef.current !== eventKey;
      lastAuthEventRef.current = eventKey;

      const wasAnonymous = user.isAnonymous;
      const rejectedEmail = user.email;
      setFbUser(null);
      setIsSigningIn(false);

      try {
        await signOut(auth);
      } catch (err) {
        console.error('Failed to sign out unauthorized user', err);
      }

      if (cancelled) return;

      if (shouldReport) {
        if (wasAnonymous) {
          addLog('Cleared legacy anonymous session.');
        } else {
          const accountLabel = rejectedEmail || 'This account';
          setLoginError(
            `Access denied. ${accountLabel} is not authorized to manage this site.`
          );
          setLoginNotice('');
          addLog(`Rejected unauthorized sign-in attempt (${accountLabel}).`);
        }
      }

      setAuthStatus('signed-out');
    };

    if (hasPendingRedirect) {
      interactiveSignInRef.current = true;
      redirectFallbackTimer = setTimeout(() => {
        if (cancelled) return;
        redirectSettled = true;
        clearRedirectFlag();
        if (authStateSeen && !latestUser) {
          interactiveSignInRef.current = false;
          setAuthStatus('signed-out');
        }
      }, 4000);
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      authStateSeen = true;
      latestUser = user;
      void applyAuthState(user);
    });

    getRedirectResult(auth)
      .then(async (redirectResult) => {
        if (cancelled) return;
        redirectSettled = true;
        clearRedirectFlag();
        if (redirectFallbackTimer) {
          clearTimeout(redirectFallbackTimer);
          redirectFallbackTimer = null;
        }
        if (redirectResult?.user) {
          latestUser = redirectResult.user;
          await applyAuthState(redirectResult.user);
        } else if (authStateSeen && !latestUser) {
          setAuthStatus('signed-out');
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        redirectSettled = true;
        interactiveSignInRef.current = false;
        clearRedirectFlag();
        if (redirectFallbackTimer) {
          clearTimeout(redirectFallbackTimer);
          redirectFallbackTimer = null;
        }
        const formatted = formatFirebaseAuthError(err);
        if (formatted.isCancelled) {
          setLoginNotice(formatted.message);
        } else {
          setLoginError(formatted.message);
        }
        addLog(`Google sign-in redirect error: ${formatted.message}`);
        if (authStateSeen && !latestUser) {
          setAuthStatus('signed-out');
        }
      });

    return () => {
      cancelled = true;
      if (redirectFallbackTimer) clearTimeout(redirectFallbackTimer);
      unsubscribe();
    };
  }, [addLog, startWaveViewTransition]);

  const handleGoogleSignIn = async () => {
    if (isSigningIn || !isFirebaseAuthConfigured()) return;

    const authInstance = getFirebaseAuth();
    if (!authInstance) {
      setLoginError('Firebase Auth could not be initialized.');
      return;
    }

    const provider = createGoogleProvider();
    interactiveSignInRef.current = true;
    setIsSigningIn(true);
    setLoginError('');
    setLoginNotice('');
    addLog('Opening Google sign-in...');

    try {
      // Call signInWithPopup synchronously within the click gesture so popups open with zero delay
      await signInWithPopup(authInstance, provider);
      setIsSigningIn(false);
    } catch (popupErr: unknown) {
      const formatted = formatFirebaseAuthError(popupErr);
      if (formatted.shouldFallbackToRedirect) {
        addLog(formatted.message);
        setLoginNotice(formatted.message);
        try {
          window.sessionStorage.setItem('admin_google_redirect_pending', '1');
        } catch {
          // Ignore storage restrictions
        }
        await signInWithRedirect(authInstance, provider);
        return;
      }
      interactiveSignInRef.current = false;
      if (formatted.isCancelled) {
        setLoginNotice(formatted.message);
        addLog(formatted.message);
      } else {
        setLoginError(formatted.message);
        addLog(`Google sign-in error: ${formatted.message}`);
      }
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    clearRedirectTimer();
    setEditingPostId(null);
    setEditingPhoto(null);
    setPendingDelete(null);
    setFeedback(null);
    setLoginError('');
    setLoginNotice('');

    startWaveViewTransition();

    if (isFirebaseAuthConfigured()) {
      const authInstance = getFirebaseAuth();
      if (authInstance) {
        try {
          await signOut(authInstance);
        } catch (err) {
          console.error('Signout error', err);
        }
      }
    }

    lastAuthEventRef.current = null;
    setFbUser(null);
    setAuthStatus(isFirebaseAuthConfigured() ? 'signed-out' : 'unconfigured');
    setSysLogs(['Signed out.', 'Waiting for Google sign-in.']);
  };

  const loadPostsAndPhotos = useCallback(async () => {
    try {
      const [postsData, photosData, collectionsData, hiddenReposData] = await Promise.all([
        fetchAllPosts(),
        fetchAllPhotos(),
        fetchAllCollections(),
        fetchHiddenRepos(),
      ]);
      setAllPosts(postsData);
      setAllPhotos(photosData);
      setAllCollections(collectionsData);
      setHiddenRepos(hiddenReposData);
      addLog(
        `Synced ${postsData.length} posts, ${photosData.length} photos, ${collectionsData.length} collections, and ${hiddenReposData.length} hidden repo(s).`
      );
    } catch (err) {
      console.error('Failed to load posts/photos', err);
      addLog('Failed to load posts, photos, or collections.');
    }
  }, [addLog]);

  useEffect(() => {
    if (!isAuthenticated) return;
    Promise.resolve().then(async () => {
      const loadedSkills = fetchAllSkills();
      setSkills(loadedSkills);
      addLog(`Loaded ${loadedSkills.length} skills.`);
      await loadPostsAndPhotos();
    });
  }, [isAuthenticated, addLog, loadPostsAndPhotos]);

  const switchTab = (nextTab: AdminTab, clearFeedback = true) => {
    clearRedirectTimer();
    const prevIdx = TAB_ORDER.indexOf(activeTab);
    const nextIdx = TAB_ORDER.indexOf(nextTab);
    if (prevIdx !== -1 && nextIdx !== -1 && prevIdx !== nextIdx) {
      setTabDirection(nextIdx > prevIdx ? 1 : -1);
    }
    setActiveTab(nextTab);
    if (clearFeedback) setFeedback(null);
    requestAnimationFrame(() => {
      tabButtonRefs.current[nextTab]?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'smooth',
      });
    });
  };

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillLabel.trim()) return;
    try {
      const added = saveSkill({
        label: newSkillLabel.trim(),
        category: newSkillCategory,
      });
      setSkills((prev) => [...prev, added]);
      setNewSkillLabel('');
      addLog(`Added skill "${added.label}" under ${added.category}.`);
      setFeedback({ kind: 'success', text: `Added "${added.label}" to ${added.category}.` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add skill';
      setFeedback({ kind: 'error', text: message });
      addLog(`Error adding skill: ${message}`);
    }
  };

  const handleDeleteSkill = (label: string) => {
    try {
      deleteSkill(label);
      setSkills((prev) => prev.filter((s) => s.label.toLowerCase() !== label.toLowerCase()));
      addLog(`Removed skill "${label}".`);
      setFeedback({ kind: 'success', text: `Removed "${label}".` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to remove skill';
      setFeedback({ kind: 'error', text: message });
    }
  };

  const handleEditPost = (post: Post) => {
    setEditingPostId(post.id);
    setTitle(post.title);
    setContent(post.content);
    setImageUrl(post.imageUrl || '');
    setInlineImages([]);
    setIsPreview(false);
    switchTab('blog');
    addLog(`Loaded post "${post.title}" for editing.`);
  };

  const handleEditPhoto = (photo: Photo) => {
    setEditingPhoto(photo);
    setEditPhotoTitle(photo.title);
    setEditPhotoDescription(photo.description || '');
    setEditPhotoMeta({
      camera: photo.camera || '',
      lens: photo.lens || '',
      focalLength: photo.focalLength || '',
      aperture: photo.aperture || '',
      shutterSpeed: photo.shutterSpeed || '',
      iso: photo.iso || '',
      takenAt: photo.takenAt || '',
      location: photo.location || '',
      collection: photo.collection || '',
    });
    addLog(`Editing metadata for "${photo.title}".`);
  };

  const handleSavePhotoMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPhoto) return;
    try {
      addLog(`Updating photo "${editPhotoTitle}"...`);
      await updatePhoto(editingPhoto.id, {
        title: editPhotoTitle,
        description: editPhotoDescription,
        camera: editPhotoMeta.camera?.trim() || '',
        lens: editPhotoMeta.lens?.trim() || '',
        focalLength: editPhotoMeta.focalLength?.trim() || '',
        aperture: editPhotoMeta.aperture?.trim() || '',
        shutterSpeed: editPhotoMeta.shutterSpeed?.trim() || '',
        iso: editPhotoMeta.iso?.trim() || '',
        location: editPhotoMeta.location?.trim() || '',
        collection: editPhotoMeta.collection?.trim() || '',
      });
      addLog(`Updated photo "${editPhotoTitle}".`);
      setFeedback({ kind: 'success', text: `Updated "${editPhotoTitle}".` });
      setEditingPhoto(null);
      await loadPostsAndPhotos();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update photo';
      console.error(err);
      setFeedback({ kind: 'error', text: message });
      addLog(`Error updating photo: ${message}`);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);

    try {
      if (target.kind === 'post') {
        addLog(`Deleting post "${target.title}"...`);
        await deletePost(target.id);
        addLog(`Deleted post "${target.title}".`);
        setFeedback({ kind: 'success', text: `Deleted "${target.title}".` });
      } else if (target.kind === 'collection') {
        addLog(`Removing collection "${target.title}"...`);
        await deleteCollection(target.id);
        const unassigned = await renameCollectionAcrossPhotos(target.title, '');
        addLog(
          `Removed collection "${target.title}" (${unassigned} photo(s) moved to uncategorized).`
        );
        setFeedback({
          kind: 'success',
          text:
            unassigned > 0
              ? `Removed "${target.title}" and kept ${unassigned} photo${unassigned === 1 ? '' : 's'} as uncategorized.`
              : `Removed collection "${target.title}".`,
        });
      } else {
        addLog(`Deleting photo "${target.title}"...`);
        await deletePhoto(target.id);
        addLog(`Deleted photo "${target.title}".`);
        setFeedback({ kind: 'success', text: `Deleted "${target.title}".` });
      }
      await loadPostsAndPhotos();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      console.error(err);
      setFeedback({ kind: 'error', text: message });
      addLog(`Error deleting ${target.kind}: ${message}`);
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newColName.trim();
    if (!cleanName) return;
    if (allCollections.some((c) => c.name.toLowerCase() === cleanName.toLowerCase())) {
      setFeedback({ kind: 'error', text: `Collection "${cleanName}" already exists.` });
      return;
    }
    try {
      const nextOrder =
        allCollections.length > 0
          ? Math.max(...allCollections.map((c) => c.order ?? 0)) + 1
          : 0;
      await saveCollection({
        name: cleanName,
        description: newColDescription.trim() || undefined,
        order: nextOrder,
        hidden: newColHidden,
      });
      setNewColName('');
      setNewColDescription('');
      setNewColHidden(false);
      addLog(`Created collection "${cleanName}".`);
      setFeedback({ kind: 'success', text: `Created collection "${cleanName}".` });
      await loadPostsAndPhotos();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create collection';
      console.error(err);
      setFeedback({ kind: 'error', text: message });
      addLog(`Error creating collection: ${message}`);
    }
  };

  const handleRegisterAdHocCollection = async (name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    try {
      const nextOrder =
        allCollections.length > 0
          ? Math.max(...allCollections.map((c) => c.order ?? 0)) + 1
          : 0;
      await saveCollection({
        name: cleanName,
        order: nextOrder,
        hidden: false,
      });
      addLog(`Registered collection "${cleanName}" for settings.`);
      setFeedback({ kind: 'success', text: `Saved "${cleanName}" to managed collections.` });
      await loadPostsAndPhotos();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save collection';
      setFeedback({ kind: 'error', text: message });
    }
  };

  const handleEditCollection = (col: PhotoCollection) => {
    setEditingCollection(col);
    setEditColName(col.name);
    setEditColDescription(col.description || '');
    setEditColCoverPhotoId(col.coverPhotoId || '');
    setEditColHidden(Boolean(col.hidden));
    addLog(`Editing collection settings for "${col.name}".`);
  };

  const handleSaveCollectionSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCollection) return;
    const cleanName = editColName.trim();
    if (!cleanName) {
      setFeedback({ kind: 'error', text: 'Collection name is required.' });
      return;
    }
    const duplicate = allCollections.some(
      (c) =>
        c.id !== editingCollection.id &&
        c.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      setFeedback({ kind: 'error', text: `Another collection is already named "${cleanName}".` });
      return;
    }

    try {
      const oldName = editingCollection.name;
      await updateCollection(editingCollection.id, {
        name: cleanName,
        description: editColDescription.trim(),
        coverPhotoId: editColCoverPhotoId.trim(),
        hidden: editColHidden,
      });

      let migrated = 0;
      if (oldName.trim() !== cleanName) {
        migrated = await renameCollectionAcrossPhotos(oldName, cleanName);
      }

      addLog(
        migrated > 0
          ? `Updated collection "${cleanName}" and renamed ${migrated} photo(s).`
          : `Updated collection "${cleanName}".`
      );
      setFeedback({
        kind: 'success',
        text:
          migrated > 0
            ? `Updated "${cleanName}" (${migrated} photo${migrated === 1 ? '' : 's'} updated).`
            : `Updated collection "${cleanName}".`,
      });
      setEditingCollection(null);
      await loadPostsAndPhotos();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update collection';
      console.error(err);
      setFeedback({ kind: 'error', text: message });
      addLog(`Error updating collection: ${message}`);
    }
  };

  const handleToggleCollectionVisibility = async (col: PhotoCollection) => {
    const nextHidden = !col.hidden;
    try {
      await updateCollection(col.id, { hidden: nextHidden });
      addLog(`${nextHidden ? 'Hid' : 'Published'} collection "${col.name}".`);
      setFeedback({
        kind: 'success',
        text: nextHidden
          ? `"${col.name}" is now hidden from the public gallery.`
          : `"${col.name}" is now visible in the public gallery.`,
      });
      await loadPostsAndPhotos();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update visibility';
      setFeedback({ kind: 'error', text: message });
    }
  };

  const handleReorderCollection = async (index: number, delta: -1 | 1) => {
    const targetIdx = index + delta;
    if (targetIdx < 0 || targetIdx >= allCollections.length) return;

    const reordered = [...allCollections];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);

    // Optimistic local reorder
    const normalized = reordered.map((c, idx) => ({ ...c, order: idx }));
    setAllCollections(normalized);

    try {
      await Promise.all(
        normalized.map((c) => updateCollection(c.id, { order: c.order }))
      );
      addLog(`Moved collection "${moved.name}" ${delta < 0 ? 'up' : 'down'}.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reorder collections';
      setFeedback({ kind: 'error', text: message });
      await loadPostsAndPhotos();
    }
  };

  const handleToggleRepoVisibility = async (repoName: string, displayLabel?: string) => {
    const key = repoName.trim().toLowerCase();
    if (!key) return;
    const isCurrentlyHidden = hiddenRepos.includes(key);
    const nextList = isCurrentlyHidden
      ? hiddenRepos.filter((name) => name !== key)
      : [...hiddenRepos, key];

    setHiddenRepos(nextList);
    try {
      const saved = await saveHiddenRepos(nextList);
      setHiddenRepos(saved);
      const label = displayLabel || repoName;
      addLog(`${isCurrentlyHidden ? 'Shown' : 'Hidden'} project "${label}" on /projects.`);
      setFeedback({
        kind: 'success',
        text: isCurrentlyHidden
          ? `"${label}" is now visible on /projects.`
          : `"${label}" is now hidden from /projects.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update project visibility';
      console.error(err);
      setFeedback({ kind: 'error', text: message });
      await loadPostsAndPhotos();
    }
  };

  const handleAddCustomHiddenRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customHiddenRepoName
      .trim()
      .replace(/^https?:\/\/github\.com\/[^/]+\//i, '')
      .replace(/\/.*$/, '')
      .trim()
      .toLowerCase();
    if (!cleaned) return;
    if (hiddenRepos.includes(cleaned)) {
      setFeedback({ kind: 'error', text: `"${cleaned}" is already hidden.` });
      return;
    }
    const nextList = [...hiddenRepos, cleaned];
    setHiddenRepos(nextList);
    setCustomHiddenRepoName('');
    try {
      const saved = await saveHiddenRepos(nextList);
      setHiddenRepos(saved);
      addLog(`Hidden GitHub repo "${cleaned}" on /projects.`);
      setFeedback({ kind: 'success', text: `Hidden "${cleaned}" from /projects.` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to hide repository';
      setFeedback({ kind: 'error', text: message });
      await loadPostsAndPhotos();
    }
  };

  /** Resizes and compresses an image file, returning its data URL and canvas dimensions. */
  const compressImageWithDimensions = (
    file: File,
    maxSize: number,
    quality: number
  ): Promise<CompressedImage> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
      reader.onload = (event) => {
        const img = new Image();
        img.onerror = () => reject(new Error(`Invalid image file: ${file.name}`));
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width;
          let h = img.height;
          if (w <= 0 || h <= 0) {
            reject(new Error(`Invalid image dimensions: ${file.name}`));
            return;
          }
          if (w > h) {
            if (w > maxSize) {
              h *= maxSize / w;
              w = maxSize;
            }
          } else if (h > maxSize) {
            w *= maxSize / h;
            h = maxSize;
          }
          const width = Math.max(1, Math.round(w));
          const height = Math.max(1, Math.round(h));
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
          let dataUrl = canvas.toDataURL('image/webp', quality);
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
          resolve({ url: dataUrl, width, height });
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const compressImage = async (file: File, maxSize: number, quality: number): Promise<string> => {
    const { url } = await compressImageWithDimensions(file, maxSize, quality);
    return url;
  };

  const stagePhotoFiles = async (files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      setFeedback({ kind: 'error', text: 'Please select valid image files.' });
      return;
    }

    for (const file of imageFiles) {
      try {
        addLog(`Preparing photo: ${file.name}`);
        const [{ url, width, height }, exif] = await Promise.all([
          compressImageWithDimensions(file, 1600, 0.82),
          extractPhotoExif(file),
        ]);
        setPendingPhotos((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            url,
            title: file.name.replace(/\.[^/.]+$/, ''),
            description: '',
            width,
            height,
            ...exif,
          },
        ]);
        const summary = [exif.camera, formatExposureSummary(exif)]
          .filter(Boolean)
          .join(' · ');
        addLog(
          summary
            ? `Staged "${file.name}" (EXIF: ${summary}).`
            : `Staged "${file.name}".`
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Could not process image.';
        setFeedback({ kind: 'error', text: message });
        addLog(`Image error: ${message}`);
      }
    }
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    isPhotoTab = false
  ) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (isPhotoTab) {
      await stagePhotoFiles(files);
    } else {
      const file = files[0];
      try {
        addLog(`Compressing cover image: ${file.name}`);
        const dataUrl = await compressImage(file, 800, 0.8);
        setImageUrl(dataUrl);
        addLog('Cover image ready.');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Could not process cover image.';
        setFeedback({ kind: 'error', text: message });
      }
    }

    if (e.target) e.target.value = '';
  };

  const handleInlineImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.replace(/\.[^/.]+$/, '');
    try {
      addLog(`Processing inline image: ${file.name}`);
      const dataUrl = await compressImage(file, 1200, 0.8);
      const id = ++inlineImageCounter.current;
      setInlineImages((prev) => [...prev, { id, name, url: dataUrl }]);
      const tag = `\n![${name}](inline:${id})\n`;
      const ta = textareaRef.current;
      if (ta) {
        const start = ta.selectionStart;
        const before = content.slice(0, start);
        const after = content.slice(ta.selectionEnd);
        setContent(before + tag + after);
      } else {
        setContent((prev) => prev + tag);
      }
      addLog(`Inserted inline image (${name}).`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not process inline image.';
      setFeedback({ kind: 'error', text: message });
    }
    if (e.target) e.target.value = '';
  };

  const resolveInlineImages = (text: string) => {
    return text.replace(/\(inline:(\d+)\)/g, (match, idStr) => {
      const img = inlineImages.find((i) => i.id === parseInt(idStr, 10));
      return img ? `(${img.url})` : match;
    });
  };

  const renderPreviewContent = (text: string) => {
    const resolved = resolveInlineImages(text);
    const { processed, images } = extractDataImages(resolved);
    return (
      <ReactMarkdown components={{ img: createImgRenderer(images) }}>
        {processed}
      </ReactMarkdown>
    );
  };

  const handlePublishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) return;
    clearRedirectTimer();

    setIsPublishing(true);
    setFeedback(null);
    addLog(editingPostId ? 'Updating post...' : 'Publishing post...');

    try {
      if (!title.trim() || !content.trim()) {
        throw new Error('Title and body content are required.');
      }
      const finalContent = resolveInlineImages(content);

      if (editingPostId) {
        await updatePost(editingPostId, {
          title: title.trim(),
          content: finalContent,
          imageUrl: imageUrl.trim() || undefined,
        });
        setFeedback({ kind: 'success', text: `Updated "${title.trim()}".` });
        addLog(`Updated post "${title.trim()}".`);
        setEditingPostId(null);
      } else {
        await savePost({
          title: title.trim(),
          content: finalContent,
          imageUrl: imageUrl.trim() || undefined,
        });
        setFeedback({ kind: 'success', text: `Published "${title.trim()}".` });
        addLog(`Published post "${title.trim()}".`);
      }

      setTitle('');
      setContent('');
      setImageUrl('');
      setInlineImages([]);
      setIsPreview(false);
      await loadPostsAndPhotos();
      redirectTimerRef.current = setTimeout(() => {
        switchTab('manage-blog', false);
      }, 900);
    } catch (error: unknown) {
      console.error('Publish post error', error);
      const errText = error instanceof Error ? error.message : 'Unknown error while saving.';
      setFeedback({ kind: 'error', text: errText });
      addLog(`Error saving post: ${errText}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePublishPhotos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) return;
    clearRedirectTimer();

    if (pendingPhotos.length === 0) {
      setFeedback({ kind: 'error', text: 'Select at least one photo to upload.' });
      selectPhotosButtonRef.current?.focus();
      return;
    }
    if (pendingPhotos.some((p) => !p.title.trim())) {
      setFeedback({ kind: 'error', text: 'Every staged photo must have a title.' });
      return;
    }

    setIsPublishing(true);
    setFeedback(null);
    addLog(`Uploading ${pendingPhotos.length} photo(s)...`);

    try {
      await savePhotos(
        pendingPhotos.map((p) => ({
          title: p.title.trim(),
          description: p.description.trim(),
          url: p.url,
          width: p.width,
          height: p.height,
          camera: p.camera?.trim() || undefined,
          lens: p.lens?.trim() || undefined,
          focalLength: p.focalLength?.trim() || undefined,
          aperture: p.aperture?.trim() || undefined,
          shutterSpeed: p.shutterSpeed?.trim() || undefined,
          iso: p.iso?.trim() || undefined,
          takenAt: p.takenAt?.trim() || undefined,
          location: p.location?.trim() || undefined,
          collection: p.collection?.trim() || undefined,
        }))
      );

      const uploadedCount = pendingPhotos.length;
      setFeedback({
        kind: 'success',
        text: `Published ${uploadedCount} photograph${uploadedCount === 1 ? '' : 's'}.`,
      });
      addLog(`Published ${uploadedCount} photograph(s).`);
      setPendingPhotos([]);
      setBatchCollection('');
      await loadPostsAndPhotos();
      redirectTimerRef.current = setTimeout(() => {
        switchTab('manage-photo', false);
      }, 900);
    } catch (error: unknown) {
      console.error('Publish photos error', error);
      const errText = error instanceof Error ? error.message : 'Unknown error while uploading.';
      setFeedback({ kind: 'error', text: errText });
      addLog(`Error uploading photos: ${errText}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const existingCollections = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of allCollections) {
      const name = c.name.trim();
      if (name && !map.has(name.toLowerCase())) map.set(name.toLowerCase(), name);
    }
    for (const p of allPhotos) {
      const name = p.collection?.trim();
      if (name && !map.has(name.toLowerCase())) map.set(name.toLowerCase(), name);
    }
    for (const p of pendingPhotos) {
      const name = p.collection?.trim();
      if (name && !map.has(name.toLowerCase())) map.set(name.toLowerCase(), name);
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [allCollections, allPhotos, pendingPhotos]);

  const photoCountByCollection = useMemo(() => {
    const counts = new Map<string, number>();
    let uncategorized = 0;
    for (const p of allPhotos) {
      const name = p.collection?.trim().toLowerCase();
      if (name) {
        counts.set(name, (counts.get(name) || 0) + 1);
      } else {
        uncategorized += 1;
      }
    }
    return { counts, uncategorized };
  }, [allPhotos]);

  const adHocCollectionNames = useMemo(() => {
    const managed = new Set(allCollections.map((c) => c.name.trim().toLowerCase()));
    const extras = new Map<string, string>();
    for (const p of allPhotos) {
      const name = p.collection?.trim();
      if (name && !managed.has(name.toLowerCase()) && !extras.has(name.toLowerCase())) {
        extras.set(name.toLowerCase(), name);
      }
    }
    return Array.from(extras.values()).sort((a, b) => a.localeCompare(b));
  }, [allCollections, allPhotos]);

  const filteredAdminPhotos = useMemo(() => {
    if (photoFilterCollection === '__all__') return allPhotos;
    if (photoFilterCollection === '__uncategorized__') {
      return allPhotos.filter((p) => !p.collection?.trim());
    }
    const target = photoFilterCollection.toLowerCase();
    return allPhotos.filter((p) => (p.collection?.trim() || '').toLowerCase() === target);
  }, [allPhotos, photoFilterCollection]);

  const allAdminProjects = useMemo<(Repo & { source: 'featured' | 'github' })[]>(() => {
    const seededNames = new Set(mockRepos.map((r) => r.name.toLowerCase()));
    const featured = mockRepos.map((r) => ({ ...r, source: 'featured' as const }));
    const github = liveRepos
      .filter((r) => !seededNames.has(r.name.toLowerCase()))
      .map((r) => ({ ...r, source: 'github' as const }));
    return [...featured, ...github];
  }, [liveRepos]);

  const extraHiddenRepoNames = useMemo(() => {
    const known = new Set(allAdminProjects.map((r) => r.name.toLowerCase()));
    return hiddenRepos.filter((name) => !known.has(name.toLowerCase()));
  }, [allAdminProjects, hiddenRepos]);

  const skillCategories = useMemo(() => {
    const ordered = [...DEFAULT_SKILL_CATEGORIES];
    for (const s of skills) {
      if (s.category && !ordered.includes(s.category)) {
        ordered.push(s.category);
      }
    }
    return ordered;
  }, [skills]);

  const tabs = useMemo<{ id: AdminTab; label: string }[]>(
    () => [
      { id: 'blog', label: editingPostId ? 'Edit post' : 'Write' },
      { id: 'manage-blog', label: `Posts (${allPosts.length})` },
      { id: 'photo', label: 'Upload' },
      { id: 'manage-photo', label: `Photos (${allPhotos.length})` },
      { id: 'collections', label: `Collections (${allCollections.length})` },
      {
        id: 'projects',
        label:
          hiddenRepos.length > 0
            ? `Projects (${allAdminProjects.length - hiddenRepos.filter((n) => allAdminProjects.some((p) => p.name.toLowerCase() === n)).length}/${allAdminProjects.length})`
            : `Projects (${allAdminProjects.length})`,
      },
      { id: 'skills', label: `Skills (${skills.length})` },
    ],
    [
      editingPostId,
      allPosts.length,
      allPhotos.length,
      allCollections.length,
      allAdminProjects,
      hiddenRepos,
      skills.length,
    ]
  );

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const idx = tabs.findIndex((t) => t.id === activeTab);
    if (idx === -1) return;

    let nextIdx = -1;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = tabs.length - 1;

    if (nextIdx !== -1) {
      e.preventDefault();
      const nextId = tabs[nextIdx].id;
      switchTab(nextId);
      tabButtonRefs.current[nextId]?.focus();
    }
  };

  const storageSummary =
    fbUser?.email || (isFirebaseConfigured() ? 'Firestore' : 'Local storage');
  const activeTabId = `admin-tab-${activeTab}`;
  const publishPostLabel = isPublishing
    ? 'Saving...'
    : editingPostId
    ? 'Save changes'
    : 'Publish post';

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" onExitComplete={releaseWaveFadeIn}>
        {authStatus !== 'signed-in' ? (
          <AdminLoginView
            key="admin-login-view"
            authStatus={authStatus}
            isSigningIn={isSigningIn}
            error={loginError}
            notice={loginNotice}
            sysLogs={sysLogs}
            onGoogleSignIn={handleGoogleSignIn}
            onDismissError={() => setLoginError('')}
          />
        ) : (
          <motion.article
            key="admin-dashboard-view"
            data-ascii-panel="true"
            variants={PANEL_VIEW_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            className="w-full min-[760px]:w-1/2 min-[760px]:max-w-[640px]"
          >
            <datalist id="photo-collections-list">
              {existingCollections.map((col) => (
                <option key={col} value={col} />
              ))}
            </datalist>

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

            <div className="space-y-5 border-t border-line pt-3">
              {/* Summary & sign out row — mirrors Resume top strip */}
              <motion.div
                variants={SECTION_ITEM_VARIANTS}
                className="flex items-baseline justify-between gap-4"
              >
                <p className="font-mono text-xs text-ink-muted min-w-0 truncate">
                  {storageSummary} · {allPosts.length} posts · {allPhotos.length} photos ·{' '}
                  {allCollections.length} collections · {skills.length} skills
                </p>
                <motion.button
                  type="button"
                  onClick={handleLogout}
                  whileHover={{ y: -0.5 }}
                  whileTap={{ scale: 0.97 }}
                  transition={TACTILE_SPRING}
                  className="font-mono text-xs text-ink underline underline-offset-4 hover:opacity-80 min-h-[36px] inline-flex items-center shrink-0 whitespace-nowrap cursor-pointer"
                >
                  Sign out
                </motion.button>
              </motion.div>

              {/* Single-row accessible tablist with Framer Motion sliding underline */}
              <motion.div variants={SECTION_ITEM_VARIANTS}>
                <LayoutGroup id="admin-section-tabs">
                  <div
                    role="tablist"
                    aria-label="Admin sections"
                    onKeyDown={handleTabKeyDown}
                    className="flex items-center gap-3 sm:gap-5 border-t border-b border-line overflow-x-auto flex-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {tabs.map((tab) => {
                      const isSelected = activeTab === tab.id;
                      return (
                        <motion.button
                          key={tab.id}
                          ref={(el) => {
                            tabButtonRefs.current[tab.id] = el;
                          }}
                          type="button"
                          role="tab"
                          id={`admin-tab-${tab.id}`}
                          aria-selected={isSelected}
                          tabIndex={isSelected ? 0 : -1}
                          whileTap={{ scale: 0.97 }}
                          transition={TACTILE_SPRING}
                          onClick={() => {
                            if (tab.id === 'blog' && activeTab !== 'blog') {
                              setEditingPostId(null);
                            }
                            switchTab(tab.id);
                          }}
                          className={`relative py-3 font-mono text-[11px] sm:text-xs font-normal whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                            isSelected ? 'text-ink' : 'text-ink-muted hover:text-ink'
                          }`}
                        >
                          <span className="relative z-10">{tab.label}</span>
                          {isSelected && (
                            <motion.span
                              layoutId="admin-active-tab-underline"
                              transition={GLIDE_SPRING}
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-ink"
                            />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </LayoutGroup>
              </motion.div>

              {/* Animated status feedback banner */}
              <AnimatePresence initial={false}>
                {feedback && (
                  <motion.div
                    key={`${feedback.kind}-${feedback.text}`}
                    role="status"
                    aria-live="polite"
                    initial={{ height: 0, opacity: 0, y: -4 }}
                    animate={{ height: 'auto', opacity: 1, y: 0 }}
                    exit={{ height: 0, opacity: 0, y: -4 }}
                    transition={ACCORDION_TRANSITION}
                    className="overflow-hidden"
                  >
                    <div
                      className={`border px-3.5 py-2.5 font-mono text-xs flex items-center justify-between gap-3 rounded-[2px] bg-surface/90 ${
                        feedback.kind === 'error'
                          ? 'border-red-700/50 dark:border-red-400/50 text-red-700 dark:text-red-400'
                          : 'border-line text-ink'
                      }`}
                    >
                      <span>{feedback.text}</span>
                      <motion.button
                        type="button"
                        onClick={() => setFeedback(null)}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.9 }}
                        transition={TACTILE_SPRING}
                        aria-label="Dismiss message"
                        className="text-ink-muted hover:text-ink p-1 cursor-pointer shrink-0"
                      >
                        <X size={14} />
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Directional Framer Motion active tab panel */}
              <motion.div variants={SECTION_ITEM_VARIANTS} className="overflow-x-clip">
                <AnimatePresence mode="wait" initial={false} custom={tabDirection}>
                  <motion.div
                    key={activeTab}
                    custom={tabDirection}
                    variants={TAB_PANEL_VARIANTS}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    role="tabpanel"
                    aria-labelledby={activeTabId}
                    className="space-y-5"
                  >
                    {activeTab === 'blog' && (
                      <form
                        onSubmit={handlePublishPost}
                        aria-label="Blog post editor"
                        className="space-y-5"
                      >
                        <AnimatePresence initial={false}>
                          {editingPostId && (
                            <motion.div
                              key="editing-post-banner"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={ACCORDION_TRANSITION}
                              className="overflow-hidden"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-line">
                                <span className="font-mono text-xs text-ink-muted">
                                  Editing existing post
                                </span>
                                <motion.button
                                  type="button"
                                  whileTap={{ scale: 0.97 }}
                                  transition={TACTILE_SPRING}
                                  onClick={() => {
                                    setEditingPostId(null);
                                    setTitle('');
                                    setContent('');
                                    setImageUrl('');
                                    setInlineImages([]);
                                    setIsPreview(false);
                                    addLog('Cancelled post edit.');
                                    switchTab('manage-blog');
                                  }}
                                  className={DANGER_INLINE_CLASS}
                                >
                                  Cancel edit
                                </motion.button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="space-y-1.5">
                          <label htmlFor="post-title" className={LABEL_CLASS}>
                            Title
                          </label>
                          <input
                            id="post-title"
                            name="title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className={INPUT_CLASS}
                            placeholder="Notes on..."
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label htmlFor="post-cover" className={LABEL_CLASS}>
                            Cover image (optional)
                          </label>
                          <div className="flex flex-col sm:flex-row gap-2.5">
                            <input
                              id="post-cover"
                              name="coverImage"
                              type="url"
                              value={imageUrl}
                              onChange={(e) => setImageUrl(e.target.value)}
                              className={`${INPUT_CLASS} flex-1 font-mono`}
                              placeholder="https://... or choose a file"
                            />
                            <input
                              type="file"
                              accept="image/*"
                              ref={fileInputRef}
                              onChange={(e) => handleImageUpload(e, false)}
                              className="hidden"
                            />
                            <motion.button
                              type="button"
                              whileHover={{ y: -1 }}
                              whileTap={{ scale: 0.98 }}
                              transition={TACTILE_SPRING}
                              onClick={() => fileInputRef.current?.click()}
                              className={SECONDARY_BTN_CLASS}
                            >
                              <Camera size={14} />
                              <span>Choose file</span>
                            </motion.button>
                          </div>

                          <AnimatePresence initial={false}>
                            {imageUrl && (
                              <motion.div
                                key="cover-preview"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={ACCORDION_TRANSITION}
                                className="overflow-hidden"
                              >
                                <div className="flex items-center justify-between gap-3 pt-2 border-t border-line mt-2">
                                  <div className="flex items-center gap-3 min-w-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={imageUrl}
                                      alt="Cover preview"
                                      className="w-12 h-9 object-cover border border-line shrink-0"
                                    />
                                    <span className="font-mono text-xs text-ink-muted truncate">
                                      {imageUrl.startsWith('data:image')
                                        ? 'Compressed cover image attached'
                                        : imageUrl}
                                    </span>
                                  </div>
                                  <motion.button
                                    type="button"
                                    whileTap={{ scale: 0.96 }}
                                    onClick={() => setImageUrl('')}
                                    className={INLINE_ACTION_CLASS}
                                  >
                                    Remove
                                  </motion.button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label htmlFor="post-body" className={LABEL_CLASS}>
                              Body (Markdown)
                            </label>
                            <div className="flex items-center gap-3">
                              <AnimatePresence initial={false}>
                                {!isPreview && (
                                  <motion.div
                                    key="insert-inline-photo"
                                    initial={{ opacity: 0, x: 6 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 6 }}
                                    transition={{ duration: 0.16, ease: CALM_EASE }}
                                    className="inline-flex items-center"
                                  >
                                    <input
                                      type="file"
                                      accept="image/*"
                                      ref={inlineImageRef}
                                      onChange={handleInlineImage}
                                      className="hidden"
                                    />
                                    <motion.button
                                      type="button"
                                      whileTap={{ scale: 0.97 }}
                                      onClick={() => inlineImageRef.current?.click()}
                                      className={INLINE_ACTION_CLASS}
                                    >
                                      <ImagePlus size={13} className="mr-1" />
                                      Insert photo
                                    </motion.button>
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              <LayoutGroup id="admin-markdown-mode">
                                <div className="inline-flex p-0.5 border border-line bg-surface/85 rounded-[2px]">
                                  {(['edit', 'preview'] as const).map((mode) => {
                                    const selected = mode === 'preview' ? isPreview : !isPreview;
                                    return (
                                      <button
                                        key={mode}
                                        type="button"
                                        aria-pressed={selected}
                                        onClick={() => setIsPreview(mode === 'preview')}
                                        className={`relative px-2.5 py-1 font-mono text-xs transition-colors cursor-pointer rounded-[1px] ${
                                          selected ? 'text-bg' : 'text-ink-muted hover:text-ink'
                                        }`}
                                      >
                                        {selected && (
                                          <motion.span
                                            layoutId="admin-markdown-mode-pill"
                                            transition={GLIDE_SPRING}
                                            aria-hidden="true"
                                            className="absolute inset-0 bg-ink rounded-[1px]"
                                          />
                                        )}
                                        <span className="relative z-10">
                                          {mode === 'edit' ? 'Edit' : 'Preview'}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </LayoutGroup>
                            </div>
                          </div>

                          <AnimatePresence initial={false}>
                            {!isPreview && inlineImages.length > 0 && (
                              <motion.div
                                key="inline-images-tray"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={ACCORDION_TRANSITION}
                                className="overflow-hidden"
                              >
                                <div className="flex flex-wrap gap-3 p-3 border border-line bg-surface/80 rounded-[2px]">
                                  <AnimatePresence initial={false} mode="popLayout">
                                    {inlineImages.map((img) => (
                                      <motion.div
                                        key={img.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.88 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.85 }}
                                        transition={TACTILE_SPRING}
                                        className="relative group"
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={img.url}
                                          alt={img.name}
                                          className="w-16 h-16 object-cover border border-line"
                                        />
                                        <motion.button
                                          type="button"
                                          whileHover={{ scale: 1.1 }}
                                          whileTap={{ scale: 0.9 }}
                                          onClick={() => {
                                            setInlineImages((prev) =>
                                              prev.filter((i) => i.id !== img.id)
                                            );
                                            addLog(`Removed inline image "${img.name}".`);
                                          }}
                                          aria-label={`Remove inline image ${img.name}`}
                                          className="absolute -top-2 -right-2 w-5 h-5 bg-bg border border-line text-ink hover:border-ink rounded-full text-xs flex items-center justify-center cursor-pointer"
                                        >
                                          ×
                                        </motion.button>
                                        <p className="font-mono text-[11px] text-ink-muted truncate w-16 mt-1 text-center">
                                          inline:{img.id}
                                        </p>
                                      </motion.div>
                                    ))}
                                  </AnimatePresence>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <AnimatePresence mode="wait" initial={false}>
                            {isPreview ? (
                              <motion.div
                                key="markdown-preview"
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.16, ease: CALM_EASE }}
                                className="w-full min-h-[220px] bg-surface/90 border border-line p-4 sm:p-5 rounded-[2px] prose prose-sm prose-neutral max-w-none font-sans prose-headings:font-medium prose-headings:text-ink prose-p:text-ink/90 prose-p:leading-relaxed prose-li:text-ink/90 prose-code:font-mono prose-code:text-xs dark:prose-invert"
                              >
                                {content ? (
                                  renderPreviewContent(content)
                                ) : (
                                  <p className="text-ink-muted italic text-sm">
                                    Nothing to preview yet.
                                  </p>
                                )}
                              </motion.div>
                            ) : (
                              <motion.div
                                key="markdown-editor"
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.16, ease: CALM_EASE }}
                              >
                                <textarea
                                  ref={textareaRef}
                                  id="post-body"
                                  name="content"
                                  value={content}
                                  onChange={(e) => setContent(e.target.value)}
                                  rows={9}
                                  className={`${INPUT_CLASS} font-mono text-xs sm:text-sm leading-relaxed min-h-[220px] resize-y`}
                                  placeholder="Write in Markdown..."
                                  required
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <div className="pt-2 flex justify-end">
                          <motion.button
                            type="submit"
                            disabled={isPublishing}
                            whileHover={!isPublishing ? { y: -1 } : undefined}
                            whileTap={!isPublishing ? { scale: 0.98 } : undefined}
                            transition={TACTILE_SPRING}
                            className={PRIMARY_BTN_CLASS}
                          >
                            {isPublishing && (
                              <motion.span
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 0.85, ease: 'linear' }}
                                className="inline-flex"
                              >
                                <Loader2 size={14} />
                              </motion.span>
                            )}
                            <AnimatePresence mode="wait" initial={false}>
                              <motion.span
                                key={publishPostLabel}
                                initial={{ opacity: 0, y: 3 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -3 }}
                                transition={{ duration: 0.15, ease: CALM_EASE }}
                              >
                                {publishPostLabel}
                              </motion.span>
                            </AnimatePresence>
                          </motion.button>
                        </div>
                      </form>
                    )}

                    {activeTab === 'manage-blog' && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                          <p className="font-sans text-xs sm:text-sm text-ink-muted">
                            Published notes on the blog feed.
                          </p>
                          <motion.button
                            type="button"
                            whileHover={{ y: -0.5 }}
                            whileTap={{ scale: 0.97 }}
                            transition={TACTILE_SPRING}
                            onClick={() => {
                              setEditingPostId(null);
                              setTitle('');
                              setContent('');
                              setImageUrl('');
                              setInlineImages([]);
                              setIsPreview(false);
                              switchTab('blog');
                            }}
                            className="font-mono text-xs text-ink underline underline-offset-4 hover:opacity-80 inline-flex items-center gap-1 cursor-pointer min-h-[36px]"
                          >
                            <Plus size={13} />
                            <span>New post</span>
                          </motion.button>
                        </div>

                        <div className="divide-y divide-line border-t border-line">
                          {allPosts.length === 0 ? (
                            <motion.p
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="font-sans text-sm text-ink-muted py-6"
                            >
                              No blog posts published yet.
                            </motion.p>
                          ) : (
                            <AnimatePresence initial={false} mode="popLayout">
                              {allPosts.map((post) => (
                                <motion.div
                                  key={post.id}
                                  layout
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.98 }}
                                  transition={{ duration: 0.2, ease: CALM_EASE }}
                                  className="py-3.5 space-y-1.5"
                                >
                                  <div className="flex items-baseline justify-between gap-4">
                                    <h2 className="font-mono text-sm font-normal text-ink">
                                      {post.title}
                                    </h2>
                                    {post.createdAt && (
                                      <span className="font-mono text-xs text-ink-muted shrink-0">
                                        {new Date(post.createdAt).toLocaleDateString('en-US', {
                                          year: 'numeric',
                                          month: 'short',
                                          day: '2-digit',
                                        })}
                                      </span>
                                    )}
                                  </div>
                                  <p className="font-sans text-xs sm:text-sm text-ink-muted leading-relaxed line-clamp-2">
                                    {summarizePostContent(post.content)}
                                  </p>
                                  <div className="flex items-center gap-4 pt-0.5">
                                    <motion.button
                                      type="button"
                                      whileTap={{ scale: 0.96 }}
                                      onClick={() => handleEditPost(post)}
                                      className={INLINE_ACTION_CLASS}
                                    >
                                      Edit
                                    </motion.button>
                                    <motion.button
                                      type="button"
                                      whileTap={{ scale: 0.96 }}
                                      onClick={() =>
                                        setPendingDelete({
                                          kind: 'post',
                                          id: post.id,
                                          title: post.title,
                                        })
                                      }
                                      className={DANGER_INLINE_CLASS}
                                    >
                                      Delete
                                    </motion.button>
                                  </div>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          )}
                        </div>
                      </div>
                    )}

                    {activeTab === 'photo' && (
                      <form
                        onSubmit={handlePublishPhotos}
                        aria-label="Photo uploader"
                        className="space-y-5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-sans text-xs sm:text-sm text-ink-muted">
                            Stage photographs with titles and captions before publishing.
                          </p>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            ref={photoInputRef}
                            onChange={(e) => handleImageUpload(e, true)}
                            className="hidden"
                          />
                          <motion.button
                            ref={selectPhotosButtonRef}
                            type="button"
                            whileHover={{ y: -1 }}
                            whileTap={{ scale: 0.98 }}
                            transition={TACTILE_SPRING}
                            onClick={() => photoInputRef.current?.click()}
                            className={SECONDARY_BTN_CLASS}
                          >
                            <Camera size={14} />
                            <span>Select files</span>
                          </motion.button>
                        </div>

                        {pendingPhotos.length > 0 && (
                          <div className="flex flex-col sm:flex-row sm:items-end gap-2.5 border border-line bg-surface/60 p-3 rounded-[2px]">
                            <div className="flex-1 space-y-1">
                              <label htmlFor="batch-photo-collection" className={LABEL_CLASS}>
                                Batch collection ({pendingPhotos.length} staged)
                              </label>
                              <input
                                id="batch-photo-collection"
                                type="text"
                                list="photo-collections-list"
                                value={batchCollection}
                                onChange={(e) => setBatchCollection(e.target.value)}
                                className={`${INPUT_CLASS} font-mono text-xs min-h-[38px] py-1.5`}
                                placeholder="e.g. Coast, Monsoon, Japan 2026..."
                              />
                            </div>
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                const trimmed = batchCollection.trim();
                                setPendingPhotos((prev) =>
                                  prev.map((p) => ({ ...p, collection: trimmed }))
                                );
                                addLog(
                                  trimmed
                                    ? `Assigned collection "${trimmed}" to ${pendingPhotos.length} staged photo(s).`
                                    : `Cleared collection on ${pendingPhotos.length} staged photo(s).`
                                );
                              }}
                              className={`${SECONDARY_BTN_CLASS} min-h-[38px] py-1.5 shrink-0`}
                            >
                              Apply to all
                            </motion.button>
                          </div>
                        )}

                        <motion.div
                          layout
                          animate={{ scale: isDraggingPhotos ? 1.008 : 1 }}
                          transition={TACTILE_SPRING}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDraggingPhotos(true);
                          }}
                          onDragLeave={() => setIsDraggingPhotos(false)}
                          onDrop={async (e) => {
                            e.preventDefault();
                            setIsDraggingPhotos(false);
                            const dropped = Array.from(e.dataTransfer.files || []);
                            if (dropped.length) await stagePhotoFiles(dropped);
                          }}
                          className={`border border-dashed transition-colors rounded-[2px] overflow-hidden ${
                            isDraggingPhotos ? 'border-ink bg-surface/90' : 'border-line'
                          }`}
                        >
                          <AnimatePresence mode="wait" initial={false}>
                            {pendingPhotos.length === 0 ? (
                              <motion.div
                                key="empty-dropzone"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.16, ease: CALM_EASE }}
                                className="py-10 px-4 text-center space-y-1"
                              >
                                <p className="font-mono text-xs text-ink">
                                  Drop images here or choose files above.
                                </p>
                                <p className="font-sans text-xs text-ink-muted">
                                  Images are automatically resized and compressed before saving.
                                </p>
                              </motion.div>
                            ) : (
                              <motion.div
                                key="staged-list"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="divide-y divide-line"
                              >
                                <AnimatePresence initial={false}>
                                  {pendingPhotos.map((photo, index) => (
                                    <motion.div
                                      key={photo.id}
                                      layout
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, height: 0 }}
                                      transition={{ duration: 0.22, ease: CALM_EASE }}
                                      className="overflow-hidden"
                                    >
                                      <div className="p-4 flex flex-col sm:flex-row gap-4 items-start">
                                        <div className="w-full sm:w-24 h-24 shrink-0 border border-line overflow-hidden bg-surface">
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img
                                            src={photo.url}
                                            alt={photo.title || 'Staged photograph preview'}
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                        <div className="flex-1 w-full space-y-2.5">
                                          <div className="space-y-1">
                                            <label
                                              htmlFor={`staged-title-${photo.id}`}
                                              className={LABEL_CLASS}
                                            >
                                              Title
                                            </label>
                                            <input
                                              id={`staged-title-${photo.id}`}
                                              type="text"
                                              value={photo.title}
                                              onChange={(e) => {
                                                const next = [...pendingPhotos];
                                                next[index] = {
                                                  ...next[index],
                                                  title: e.target.value,
                                                };
                                                setPendingPhotos(next);
                                              }}
                                              className={INPUT_CLASS}
                                              placeholder="Photograph title"
                                              required
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <label
                                              htmlFor={`staged-desc-${photo.id}`}
                                              className={LABEL_CLASS}
                                            >
                                              Caption (optional)
                                            </label>
                                            <textarea
                                              id={`staged-desc-${photo.id}`}
                                              value={photo.description}
                                              onChange={(e) => {
                                                const next = [...pendingPhotos];
                                                next[index] = {
                                                  ...next[index],
                                                  description: e.target.value,
                                                };
                                                setPendingPhotos(next);
                                              }}
                                              rows={2}
                                              className={`${INPUT_CLASS} font-sans resize-y`}
                                              placeholder="Location, camera notes, or context..."
                                            />
                                          </div>
                                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                                            {(
                                              [
                                                ['collection', 'Collection', 'Coast'],
                                                ['camera', 'Camera', 'Fujifilm X100V'],
                                                ['lens', 'Lens', '23mm f/2'],
                                                ['location', 'Location', 'Manipal, IN'],
                                                ['focalLength', 'Focal', '35mm'],
                                                ['aperture', 'Aperture', 'f/2.8'],
                                                ['shutterSpeed', 'Shutter', '1/500s'],
                                                ['iso', 'ISO', 'ISO 400'],
                                              ] as const
                                            ).map(([field, label, placeholder]) => (
                                              <div key={field} className="space-y-1">
                                                <label
                                                  htmlFor={`staged-${field}-${photo.id}`}
                                                  className={LABEL_CLASS}
                                                >
                                                  {label}
                                                </label>
                                                <input
                                                  id={`staged-${field}-${photo.id}`}
                                                  type="text"
                                                  list={field === 'collection' ? 'photo-collections-list' : undefined}
                                                  value={photo[field] || ''}
                                                  onChange={(e) => {
                                                    const next = [...pendingPhotos];
                                                    next[index] = {
                                                      ...next[index],
                                                      [field]: e.target.value,
                                                    };
                                                    setPendingPhotos(next);
                                                  }}
                                                  className={`${INPUT_CLASS} font-mono text-xs min-h-[38px] py-1.5`}
                                                  placeholder={placeholder}
                                                />
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                        <motion.button
                                          type="button"
                                          whileHover={{ scale: 1.08 }}
                                          whileTap={{ scale: 0.9 }}
                                          transition={TACTILE_SPRING}
                                          onClick={() => {
                                            setPendingPhotos((prev) =>
                                              prev.filter((p) => p.id !== photo.id)
                                            );
                                            addLog(`Removed staged photo "${photo.title}".`);
                                          }}
                                          aria-label={`Remove ${photo.title || 'staged photo'}`}
                                          className="text-ink-muted hover:text-red-700 dark:hover:text-red-400 p-2 min-w-[36px] min-h-[36px] inline-flex items-center justify-center self-end sm:self-start cursor-pointer transition-colors"
                                        >
                                          <Trash2 size={15} />
                                        </motion.button>
                                      </div>
                                    </motion.div>
                                  ))}
                                </AnimatePresence>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>

                        <div className="pt-1 flex justify-end">
                          <motion.button
                            type="submit"
                            disabled={isPublishing}
                            whileHover={!isPublishing ? { y: -1 } : undefined}
                            whileTap={!isPublishing ? { scale: 0.98 } : undefined}
                            transition={TACTILE_SPRING}
                            className={PRIMARY_BTN_CLASS}
                          >
                            {isPublishing && (
                              <motion.span
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 0.85, ease: 'linear' }}
                                className="inline-flex"
                              >
                                <Loader2 size={14} />
                              </motion.span>
                            )}
                            <span>{isPublishing ? 'Uploading...' : 'Publish photos'}</span>
                          </motion.button>
                        </div>
                      </form>
                    )}

                    {activeTab === 'manage-photo' && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                          <p className="font-sans text-xs sm:text-sm text-ink-muted">
                            Archived photographs shown in the photography gallery.
                          </p>
                          <div className="flex items-center gap-4">
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.97 }}
                              onClick={() => switchTab('collections')}
                              className="font-mono text-xs text-ink-muted hover:text-ink underline underline-offset-4 cursor-pointer min-h-[36px]"
                            >
                              Collections settings
                            </motion.button>
                            <motion.button
                              type="button"
                              whileHover={{ y: -0.5 }}
                              whileTap={{ scale: 0.97 }}
                              transition={TACTILE_SPRING}
                              onClick={() => switchTab('photo')}
                              className="font-mono text-xs text-ink underline underline-offset-4 hover:opacity-80 inline-flex items-center gap-1 cursor-pointer min-h-[36px]"
                            >
                              <Plus size={13} />
                              <span>Upload photos</span>
                            </motion.button>
                          </div>
                        </div>

                        {allPhotos.length > 0 && existingCollections.length > 0 && (
                          <div
                            role="group"
                            aria-label="Filter photos by collection"
                            className="flex items-center gap-3 overflow-x-auto pb-1 font-mono text-[11px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                          >
                            {[
                              { id: '__all__', label: `All (${allPhotos.length})` },
                              ...existingCollections.map((name) => ({
                                id: name,
                                label: `${name} (${photoCountByCollection.counts.get(name.toLowerCase()) || 0})`,
                              })),
                              ...(photoCountByCollection.uncategorized > 0
                                ? [
                                    {
                                      id: '__uncategorized__',
                                      label: `Uncategorized (${photoCountByCollection.uncategorized})`,
                                    },
                                  ]
                                : []),
                            ].map((item) => {
                              const isActive = photoFilterCollection === item.id;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => setPhotoFilterCollection(item.id)}
                                  className={`whitespace-nowrap pb-1 border-b transition-colors cursor-pointer ${
                                    isActive
                                      ? 'text-ink border-ink'
                                      : 'text-ink-muted border-transparent hover:text-ink'
                                  }`}
                                >
                                  {item.label}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        <div className="divide-y divide-line border-t border-line">
                          {filteredAdminPhotos.length === 0 ? (
                            <motion.p
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="font-sans text-sm text-ink-muted py-6"
                            >
                              {allPhotos.length === 0
                                ? 'No photographs archived yet.'
                                : 'No photographs in this collection.'}
                            </motion.p>
                          ) : (
                            <AnimatePresence initial={false} mode="popLayout">
                              {filteredAdminPhotos.map((photo) => (
                                <motion.div
                                  key={photo.id}
                                  layout
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.98 }}
                                  transition={{ duration: 0.2, ease: CALM_EASE }}
                                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                >
                                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                                    <div className="w-14 h-14 shrink-0 border border-line overflow-hidden bg-surface">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={photo.url}
                                        alt={photo.title}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div className="min-w-0 space-y-0.5">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <h2 className="font-mono text-sm font-normal text-ink truncate">
                                          {photo.title}
                                        </h2>
                                        {photo.collection && (
                                          <span className="font-mono text-[10px] text-ink-muted border border-line px-1.5 py-0.5 rounded-[2px] shrink-0">
                                            {photo.collection}
                                          </span>
                                        )}
                                      </div>
                                      {photo.description && (
                                        <p className="font-sans text-xs sm:text-sm text-ink-muted truncate">
                                          {photo.description}
                                        </p>
                                      )}
                                      {photo.createdAt && (
                                        <p className="font-mono text-xs text-ink-muted">
                                          {new Date(photo.createdAt).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: '2-digit',
                                          })}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4 shrink-0">
                                    <motion.button
                                      type="button"
                                      whileTap={{ scale: 0.96 }}
                                      onClick={() => handleEditPhoto(photo)}
                                      className={INLINE_ACTION_CLASS}
                                    >
                                      Edit
                                    </motion.button>
                                    <motion.button
                                      type="button"
                                      whileTap={{ scale: 0.96 }}
                                      onClick={() =>
                                        setPendingDelete({
                                          kind: 'photo',
                                          id: photo.id,
                                          title: photo.title,
                                        })
                                      }
                                      className={DANGER_INLINE_CLASS}
                                    >
                                      Delete
                                    </motion.button>
                                  </div>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          )}
                        </div>
                      </div>
                    )}

                    {activeTab === 'collections' && (
                      <div className="space-y-6">
                        <p className="font-sans text-xs sm:text-sm text-ink-muted">
                          Control collection order, descriptions, cover frames, and gallery
                          visibility for the horizontal scroller on{' '}
                          <span className="font-mono text-ink">/photography</span>.
                        </p>

                        {/* Create new collection form */}
                        <form
                          onSubmit={handleCreateCollection}
                          aria-label="Create photo collection"
                          className="space-y-3 border border-line bg-surface/60 p-3.5 rounded-[2px]"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <label htmlFor="new-col-name" className={LABEL_CLASS}>
                                Collection name
                              </label>
                              <input
                                id="new-col-name"
                                type="text"
                                value={newColName}
                                onChange={(e) => setNewColName(e.target.value)}
                                className={INPUT_CLASS}
                                placeholder="e.g. Coast, Japan 2026"
                                required
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label htmlFor="new-col-desc" className={LABEL_CLASS}>
                                Description (optional)
                              </label>
                              <input
                                id="new-col-desc"
                                type="text"
                                value={newColDescription}
                                onChange={(e) => setNewColDescription(e.target.value)}
                                className={INPUT_CLASS}
                                placeholder="Short note shown below the scroller..."
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                            <label className="inline-flex items-center gap-2 font-mono text-xs text-ink-muted cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={newColHidden}
                                onChange={(e) => setNewColHidden(e.target.checked)}
                                className="accent-current cursor-pointer"
                              />
                              <span>Start hidden (draft)</span>
                            </label>
                            <motion.button
                              type="submit"
                              whileHover={{ y: -1 }}
                              whileTap={{ scale: 0.98 }}
                              transition={TACTILE_SPRING}
                              className={PRIMARY_BTN_CLASS}
                            >
                              <Plus size={13} />
                              <span>Create collection</span>
                            </motion.button>
                          </div>
                        </form>

                        {/* Managed collections list */}
                        <div className="divide-y divide-line border-t border-line">
                          {allCollections.length === 0 ? (
                            <p className="font-sans text-sm text-ink-muted py-6">
                              No managed collections yet. Create one above to control scroller
                              order, cover frames, and visibility.
                            </p>
                          ) : (
                            <AnimatePresence initial={false} mode="popLayout">
                              {allCollections.map((col, idx) => {
                                const colPhotos = allPhotos.filter(
                                  (p) =>
                                    (p.collection || '').trim().toLowerCase() ===
                                    col.name.trim().toLowerCase()
                                );
                                const coverPhoto =
                                  (col.coverPhotoId &&
                                    colPhotos.find((p) => p.id === col.coverPhotoId)) ||
                                  colPhotos[0];

                                return (
                                  <motion.div
                                    key={col.id}
                                    layout
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    transition={{ duration: 0.2, ease: CALM_EASE }}
                                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                  >
                                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                                      <div className="w-12 h-12 shrink-0 border border-line overflow-hidden bg-surface flex items-center justify-center">
                                        {coverPhoto?.url ? (
                                          /* eslint-disable-next-line @next/next/no-img-element */
                                          <img
                                            src={coverPhoto.url}
                                            alt={col.name}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <span className="font-mono text-[10px] text-ink-muted">
                                            —
                                          </span>
                                        )}
                                      </div>

                                      <div className="min-w-0 space-y-0.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <h2 className="font-mono text-sm font-normal text-ink truncate">
                                            {String(idx + 1).padStart(2, '0')} · {col.name}
                                          </h2>
                                          <span className="font-mono text-[10px] text-ink-muted">
                                            {colPhotos.length}{' '}
                                            {colPhotos.length === 1 ? 'frame' : 'frames'}
                                          </span>
                                          {col.hidden && (
                                            <span className="font-mono text-[10px] text-ink-muted border border-line px-1.5 py-0.5 rounded-[2px]">
                                              hidden
                                            </span>
                                          )}
                                        </div>
                                        {col.description && (
                                          <p className="font-sans text-xs text-ink-muted line-clamp-2">
                                            {col.description}
                                          </p>
                                        )}
                                        <p className="font-mono text-[11px] text-ink-muted/80">
                                          cover:{' '}
                                          {col.coverPhotoId && coverPhoto
                                            ? coverPhoto.title
                                            : coverPhoto
                                            ? 'auto (latest)'
                                            : 'none'}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0 flex-wrap">
                                      <div className="inline-flex items-center gap-1 border border-line rounded-[2px] px-1">
                                        <button
                                          type="button"
                                          disabled={idx === 0}
                                          onClick={() => handleReorderCollection(idx, -1)}
                                          aria-label={`Move ${col.name} earlier`}
                                          title="Move earlier in scroller"
                                          className="p-1.5 text-ink-muted hover:text-ink disabled:opacity-25 cursor-pointer disabled:cursor-default transition-opacity"
                                        >
                                          <ArrowUp size={13} />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={idx === allCollections.length - 1}
                                          onClick={() => handleReorderCollection(idx, 1)}
                                          aria-label={`Move ${col.name} later`}
                                          title="Move later in scroller"
                                          className="p-1.5 text-ink-muted hover:text-ink disabled:opacity-25 cursor-pointer disabled:cursor-default transition-opacity"
                                        >
                                          <ArrowDown size={13} />
                                        </button>
                                      </div>

                                      <motion.button
                                        type="button"
                                        whileTap={{ scale: 0.96 }}
                                        onClick={() => handleToggleCollectionVisibility(col)}
                                        className="font-mono text-xs text-ink-muted hover:text-ink inline-flex items-center gap-1 cursor-pointer min-h-[36px]"
                                        title={
                                          col.hidden
                                            ? 'Show in public gallery'
                                            : 'Hide from public gallery'
                                        }
                                      >
                                        {col.hidden ? <Eye size={13} /> : <EyeOff size={13} />}
                                        <span>{col.hidden ? 'Show' : 'Hide'}</span>
                                      </motion.button>

                                      <motion.button
                                        type="button"
                                        whileTap={{ scale: 0.96 }}
                                        onClick={() => handleEditCollection(col)}
                                        className={INLINE_ACTION_CLASS}
                                      >
                                        Settings
                                      </motion.button>

                                      <motion.button
                                        type="button"
                                        whileTap={{ scale: 0.96 }}
                                        onClick={() =>
                                          setPendingDelete({
                                            kind: 'collection',
                                            id: col.id,
                                            title: col.name,
                                          })
                                        }
                                        className={DANGER_INLINE_CLASS}
                                      >
                                        Remove
                                      </motion.button>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </AnimatePresence>
                          )}
                        </div>

                        {/* Unregistered collection tags found on photos */}
                        {adHocCollectionNames.length > 0 && (
                          <div className="border-t border-line pt-4 space-y-2.5">
                            <div className="space-y-0.5">
                              <h2 className="font-mono text-xs text-ink">
                                Unmanaged tags on photos ({adHocCollectionNames.length})
                              </h2>
                              <p className="font-sans text-xs text-ink-muted">
                                These collections exist on uploaded photos without saved settings.
                                Promote them to customize order, cover, or description.
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {adHocCollectionNames.map((name) => {
                                const count =
                                  photoCountByCollection.counts.get(name.toLowerCase()) || 0;
                                return (
                                  <button
                                    key={name}
                                    type="button"
                                    onClick={() => handleRegisterAdHocCollection(name)}
                                    className="font-mono text-xs border border-line bg-surface/80 px-2.5 py-1.5 rounded-[2px] text-ink hover:border-ink transition-colors inline-flex items-center gap-2 cursor-pointer"
                                  >
                                    <span>
                                      {name} ({count})
                                    </span>
                                    <span className="text-ink-muted">+ manage</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'projects' && (
                      <div className="space-y-6">
                        <p className="font-sans text-xs sm:text-sm text-ink-muted">
                          Hide or show GitHub and featured projects listed on{' '}
                          <span className="font-mono text-ink">/projects</span>.
                        </p>

                        {/* Pre-hide any GitHub repository by exact slug or URL */}
                        <form
                          onSubmit={handleAddCustomHiddenRepo}
                          aria-label="Hide GitHub repository by name"
                          className="flex flex-wrap items-end gap-3 border border-line bg-surface/60 p-3.5 rounded-[2px]"
                        >
                          <div className="flex-1 min-w-[200px] space-y-1.5">
                            <label htmlFor="hide-repo-name" className={LABEL_CLASS}>
                              Hide GitHub repo by name (or URL)
                            </label>
                            <input
                              id="hide-repo-name"
                              type="text"
                              value={customHiddenRepoName}
                              onChange={(e) => setCustomHiddenRepoName(e.target.value)}
                              className={`${INPUT_CLASS} font-mono text-xs`}
                              placeholder="e.g. portfolio or dotfiles"
                            />
                          </div>
                          <div className="shrink-0">
                            <motion.button
                              type="submit"
                              whileHover={{ y: -1 }}
                              whileTap={{ scale: 0.98 }}
                              transition={TACTILE_SPRING}
                              className={SECONDARY_BTN_CLASS}
                            >
                              <EyeOff size={13} />
                              <span>Hide repo</span>
                            </motion.button>
                          </div>
                        </form>

                        {/* Loaded projects list */}
                        <div className="divide-y divide-line border-t border-line">
                          {allAdminProjects.map((repo) => {
                            const isHidden = hiddenRepos.includes(repo.name.toLowerCase());
                            return (
                              <motion.div
                                key={`${repo.source}-${repo.id}-${repo.name}`}
                                layout
                                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                              >
                                <div
                                  className={`min-w-0 flex-1 space-y-1 transition-opacity ${
                                    isHidden ? 'opacity-55' : 'opacity-100'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h2 className="font-mono text-sm font-normal text-ink truncate">
                                      {repo.title || repo.name}
                                    </h2>
                                    <span className="font-mono text-[10px] text-ink-muted border border-line px-1.5 py-0.5 rounded-[2px] shrink-0">
                                      {repo.source}
                                    </span>
                                    {isHidden && (
                                      <span className="font-mono text-[10px] text-ink border border-ink/50 px-1.5 py-0.5 rounded-[2px] shrink-0">
                                        hidden
                                      </span>
                                    )}
                                  </div>
                                  <p className="font-mono text-[11px] text-ink-muted truncate">
                                    {repo.name}
                                    {repo.language ? ` · ${repo.language}` : ''}
                                  </p>
                                  {repo.description && (
                                    <p className="font-sans text-xs text-ink-muted line-clamp-2">
                                      {repo.description}
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                  <motion.button
                                    type="button"
                                    whileTap={{ scale: 0.96 }}
                                    onClick={() =>
                                      handleToggleRepoVisibility(
                                        repo.name,
                                        repo.title || repo.name
                                      )
                                    }
                                    className="font-mono text-xs border border-line bg-surface/85 px-3 py-1.5 rounded-[2px] text-ink hover:border-ink transition-colors inline-flex items-center gap-1.5 cursor-pointer min-h-[36px]"
                                  >
                                    {isHidden ? <Eye size={13} /> : <EyeOff size={13} />}
                                    <span>{isHidden ? 'Show' : 'Hide'}</span>
                                  </motion.button>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>

                        {/* Extra hidden repo names not currently in the synced list */}
                        {extraHiddenRepoNames.length > 0 && (
                          <div className="border-t border-line pt-4 space-y-2.5">
                            <h2 className="font-mono text-xs text-ink-muted">
                              Other hidden repo names ({extraHiddenRepoNames.length})
                            </h2>
                            <div className="flex flex-wrap gap-2">
                              {extraHiddenRepoNames.map((repoName) => (
                                <span
                                  key={repoName}
                                  className="inline-flex items-center gap-2 border border-line bg-surface/85 px-2.5 py-1 font-mono text-xs text-ink rounded-[2px]"
                                >
                                  <span>{repoName}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleRepoVisibility(repoName)}
                                    aria-label={`Unhide ${repoName}`}
                                    className="text-ink-muted hover:text-ink underline underline-offset-2 cursor-pointer text-[11px]"
                                  >
                                    show
                                  </button>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'skills' && (
                      <div className="space-y-6">
                        <form
                          onSubmit={handleAddSkill}
                          aria-label="Add skill"
                          className="flex flex-wrap items-end gap-3"
                        >
                          <div className="flex-1 min-w-[200px] space-y-1.5">
                            <label htmlFor="skill-label" className={LABEL_CLASS}>
                              Skill
                            </label>
                            <input
                              id="skill-label"
                              name="skillLabel"
                              type="text"
                              value={newSkillLabel}
                              onChange={(e) => setNewSkillLabel(e.target.value)}
                              className={INPUT_CLASS}
                              placeholder="e.g. Stan"
                              required
                            />
                          </div>
                          <div className="flex-1 min-w-[200px] space-y-1.5">
                            <label htmlFor="skill-category" className={LABEL_CLASS}>
                              Category
                            </label>
                            <select
                              id="skill-category"
                              name="skillCategory"
                              value={newSkillCategory}
                              onChange={(e) => setNewSkillCategory(e.target.value)}
                              className={`${INPUT_CLASS} cursor-pointer`}
                            >
                              {skillCategories.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="shrink-0">
                            <motion.button
                              type="submit"
                              whileHover={{ y: -1 }}
                              whileTap={{ scale: 0.98 }}
                              transition={TACTILE_SPRING}
                              className={PRIMARY_BTN_CLASS}
                            >
                              Add skill
                            </motion.button>
                          </div>
                        </form>

                        <LayoutGroup id="admin-skills-groups">
                          <div className="divide-y divide-line border-t border-line">
                            {skillCategories.map((cat) => {
                              const catSkills = skills.filter((s) => s.category === cat);
                              return (
                                <section key={cat} className="py-3.5 space-y-2.5">
                                  <h2 className="font-mono text-xs text-ink-muted">{cat}</h2>
                                  <div className="flex flex-wrap gap-2">
                                    <AnimatePresence initial={false} mode="popLayout">
                                      {catSkills.map((skill) => (
                                        <motion.span
                                          key={skill.label}
                                          layout
                                          initial={{ opacity: 0, scale: 0.88 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          exit={{ opacity: 0, scale: 0.84 }}
                                          transition={TACTILE_SPRING}
                                          className="inline-flex items-center gap-1.5 border border-line bg-surface/85 px-2.5 py-1 font-mono text-xs text-ink rounded-[2px]"
                                        >
                                          <span>{skill.label}</span>
                                          <motion.button
                                            type="button"
                                            whileHover={{ scale: 1.15 }}
                                            whileTap={{ scale: 0.88 }}
                                            onClick={() => handleDeleteSkill(skill.label)}
                                            aria-label={`Remove ${skill.label}`}
                                            className="text-ink-muted hover:text-red-700 dark:hover:text-red-400 pl-0.5 cursor-pointer transition-colors"
                                          >
                                            ×
                                          </motion.button>
                                        </motion.span>
                                      ))}
                                    </AnimatePresence>
                                    {catSkills.length === 0 && (
                                      <span className="font-sans text-xs text-ink-muted">
                                        No skills in this category.
                                      </span>
                                    )}
                                  </div>
                                </section>
                              );
                            })}
                          </div>
                        </LayoutGroup>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </motion.div>

              {/* Smooth Framer Motion collapsible diagnostics & activity log */}
              <motion.div variants={SECTION_ITEM_VARIANTS} layout="position">
                <CollapsibleLog
                  id="admin-dashboard-diagnostics"
                  label="Diagnostics & activity log"
                  logs={sysLogs}
                  maxHeightClass="max-h-40"
                >
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] border-b border-line pb-3">
                    <dt className="text-ink-muted">Storage</dt>
                    <dd className="text-ink text-right">
                      {isFirebaseConfigured() ? 'Remote Firestore' : 'Local browser'}
                    </dd>
                    <dt className="text-ink-muted">Google account</dt>
                    <dd className="text-ink text-right truncate">
                      {fbUser?.email || 'Signed in'}
                    </dd>
                    <dt className="text-ink-muted">Staged photos</dt>
                    <dd className="text-ink text-right">{pendingPhotos.length}</dd>
                  </dl>
                </CollapsibleLog>
              </motion.div>
            </div>

            {/* Edit photo metadata modal (Framer Motion spring enter/exit) */}
            <AnimatePresence>
              {editingPhoto && (
                <ModalDialog
                  key="edit-photo-modal"
                  onClose={() => setEditingPhoto(null)}
                  titleId="edit-photo-dialog-title"
                  title="Edit photograph"
                >
                  <div className="space-y-4">
                    <div className="w-full h-40 border border-line overflow-hidden bg-surface flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={editingPhoto.url}
                        alt={editingPhoto.title}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <form onSubmit={handleSavePhotoMetadata} className="space-y-4">
                      <div className="space-y-1.5">
                        <label htmlFor="edit-photo-title" className={LABEL_CLASS}>
                          Title
                        </label>
                        <input
                          id="edit-photo-title"
                          type="text"
                          value={editPhotoTitle}
                          onChange={(e) => setEditPhotoTitle(e.target.value)}
                          className={INPUT_CLASS}
                          autoFocus
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="edit-photo-desc" className={LABEL_CLASS}>
                          Description
                        </label>
                        <textarea
                          id="edit-photo-desc"
                          value={editPhotoDescription}
                          onChange={(e) => setEditPhotoDescription(e.target.value)}
                          rows={3}
                          className={`${INPUT_CLASS} resize-y`}
                          placeholder="Optional caption or notes..."
                        />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                        {(
                          [
                            ['collection', 'Collection', 'Coast'],
                            ['camera', 'Camera', 'Fujifilm X100V'],
                            ['lens', 'Lens', '23mm f/2'],
                            ['location', 'Location', 'Manipal, IN'],
                            ['focalLength', 'Focal', '35mm'],
                            ['aperture', 'Aperture', 'f/2.8'],
                            ['shutterSpeed', 'Shutter', '1/500s'],
                            ['iso', 'ISO', 'ISO 400'],
                          ] as const
                        ).map(([field, label, placeholder]) => (
                          <div key={field} className="space-y-1">
                            <label htmlFor={`edit-photo-${field}`} className={LABEL_CLASS}>
                              {label}
                            </label>
                            <input
                              id={`edit-photo-${field}`}
                              type="text"
                              list={field === 'collection' ? 'photo-collections-list' : undefined}
                              value={editPhotoMeta[field] || ''}
                              onChange={(e) =>
                                setEditPhotoMeta((prev) => ({
                                  ...prev,
                                  [field]: e.target.value,
                                }))
                              }
                              className={`${INPUT_CLASS} font-mono text-xs min-h-[38px] py-1.5`}
                              placeholder={placeholder}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="pt-2 flex justify-end gap-3">
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setEditingPhoto(null)}
                          className={SECONDARY_BTN_CLASS}
                        >
                          Cancel
                        </motion.button>
                        <motion.button
                          type="submit"
                          whileHover={{ y: -1 }}
                          whileTap={{ scale: 0.98 }}
                          transition={TACTILE_SPRING}
                          className={PRIMARY_BTN_CLASS}
                        >
                          Save changes
                        </motion.button>
                      </div>
                    </form>
                  </div>
                </ModalDialog>
              )}
            </AnimatePresence>

            {/* Edit collection settings modal (Framer Motion spring enter/exit) */}
            <AnimatePresence>
              {editingCollection && (
                <ModalDialog
                  key="edit-collection-modal"
                  onClose={() => setEditingCollection(null)}
                  titleId="edit-collection-dialog-title"
                  title="Collection settings"
                >
                  <form onSubmit={handleSaveCollectionSettings} className="space-y-4">
                    <div className="space-y-1.5">
                      <label htmlFor="edit-col-name" className={LABEL_CLASS}>
                        Name (renaming updates all photos in this collection)
                      </label>
                      <input
                        id="edit-col-name"
                        type="text"
                        value={editColName}
                        onChange={(e) => setEditColName(e.target.value)}
                        className={INPUT_CLASS}
                        autoFocus
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="edit-col-desc" className={LABEL_CLASS}>
                        Description
                      </label>
                      <textarea
                        id="edit-col-desc"
                        value={editColDescription}
                        onChange={(e) => setEditColDescription(e.target.value)}
                        rows={2}
                        className={`${INPUT_CLASS} resize-y`}
                        placeholder="Optional subtitle shown when visitors view this collection..."
                      />
                    </div>

                    {/* Visual cover frame picker */}
                    {(() => {
                      const matchingPhotos = allPhotos.filter(
                        (p) =>
                          (p.collection || '').trim().toLowerCase() ===
                          editingCollection.name.trim().toLowerCase()
                      );
                      return (
                        <div className="space-y-2">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className={LABEL_CLASS}>Cover thumbnail</span>
                            <button
                              type="button"
                              onClick={() => setEditColCoverPhotoId('')}
                              className={`font-mono text-[11px] cursor-pointer ${
                                !editColCoverPhotoId
                                  ? 'text-ink underline underline-offset-4'
                                  : 'text-ink-muted hover:text-ink'
                              }`}
                            >
                              Auto (latest)
                            </button>
                          </div>
                          {matchingPhotos.length === 0 ? (
                            <p className="font-sans text-xs text-ink-muted">
                              Assign photographs to this collection to pick a custom cover frame.
                            </p>
                          ) : (
                            <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-36 overflow-y-auto pr-1">
                              {matchingPhotos.map((p) => {
                                const isPicked = editColCoverPhotoId === p.id;
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => setEditColCoverPhotoId(p.id)}
                                    title={p.title}
                                    className={`relative aspect-square border overflow-hidden rounded-[2px] cursor-pointer transition-all ${
                                      isPicked
                                        ? 'border-ink ring-1 ring-ink'
                                        : 'border-line opacity-75 hover:opacity-100'
                                    }`}
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={p.url}
                                      alt={p.title}
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <label className="flex items-center gap-2.5 pt-1 font-mono text-xs text-ink cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={editColHidden}
                        onChange={(e) => setEditColHidden(e.target.checked)}
                        className="accent-current cursor-pointer"
                      />
                      <span>Hide this collection and its photos from /photography</span>
                    </label>

                    <div className="pt-2 flex justify-end gap-3">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setEditingCollection(null)}
                        className={SECONDARY_BTN_CLASS}
                      >
                        Cancel
                      </motion.button>
                      <motion.button
                        type="submit"
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        transition={TACTILE_SPRING}
                        className={PRIMARY_BTN_CLASS}
                      >
                        Save settings
                      </motion.button>
                    </div>
                  </form>
                </ModalDialog>
              )}
            </AnimatePresence>

            {/* Delete confirmation modal (Framer Motion spring enter/exit) */}
            <AnimatePresence>
              {pendingDelete && (
                <ModalDialog
                  key="confirm-delete-modal"
                  onClose={() => setPendingDelete(null)}
                  titleId="confirm-delete-title"
                  title={
                    pendingDelete.kind === 'post'
                      ? 'Delete post'
                      : pendingDelete.kind === 'collection'
                      ? 'Remove collection'
                      : 'Delete photograph'
                  }
                  maxWidthClass="max-w-md"
                >
                  <div className="space-y-5">
                    <p className="font-sans text-sm text-ink leading-relaxed">
                      {pendingDelete.kind === 'collection' ? (
                        <>
                          Remove collection{' '}
                          <span className="font-mono">{pendingDelete.title}</span>? Your
                          photographs will stay safe in the archive as uncategorized.
                        </>
                      ) : (
                        <>
                          Delete <span className="font-mono">{pendingDelete.title}</span>? This
                          cannot be undone.
                        </>
                      )}
                    </p>
                    <div className="flex justify-end gap-3">
                      <motion.button
                        type="button"
                        autoFocus
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setPendingDelete(null)}
                        className={SECONDARY_BTN_CLASS}
                      >
                        Cancel
                      </motion.button>
                      <motion.button
                        type="button"
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        transition={TACTILE_SPRING}
                        onClick={handleConfirmDelete}
                        className="font-mono text-xs px-4 py-2.5 min-h-[44px] bg-red-700 text-white dark:bg-red-500/90 dark:text-bg border border-red-700 dark:border-red-400 hover:opacity-90 transition-opacity cursor-pointer rounded-[2px]"
                      >
                        {pendingDelete.kind === 'collection' ? 'Remove' : 'Delete'}
                      </motion.button>
                    </div>
                  </div>
                </ModalDialog>
              )}
            </AnimatePresence>
          </motion.article>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
