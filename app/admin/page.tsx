'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { X } from 'lucide-react';
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
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
import { Skill, Post, Photo, PhotoCollection, mockRepos } from '@/lib/data';
import { useGithubRepos } from '@/hooks/useGithubRepos';
import { isFirebaseConfigured } from '@/lib/firebase';
import { getFirebaseAuth, isFirebaseAuthConfigured } from '@/lib/firebase-auth';
import { formatFirebaseAuthError, isAuthorizedAdminUser } from '@/lib/adminAuth';
import {
  extractPhotoExif,
  formatExposureSummary,
  type PhotoExifMetadata,
} from '@/lib/exif';
import { compressImageWithDimensions } from '@/lib/image-processing';
import { AdminLoginView, type AdminAuthStatus } from '@/components/AdminLoginView';
import {
  ACCORDION_TRANSITION,
  CollapsibleLog,
  GLIDE_SPRING,
  PANEL_VIEW_VARIANTS,
  SECTION_ITEM_VARIANTS,
  TACTILE_SPRING,
} from '@/components/CollapsibleLog';
import { ScrambleHeading } from '@/components/ScrambleHeading';
import {
  DEFAULT_SKILL_CATEGORIES,
  TAB_ORDER,
  TAB_PANEL_VARIANTS,
  type AdminTab,
  type AuthUserSummary,
  type PendingDeleteTarget,
  type PendingPhoto,
  type StatusFeedback,
} from '@/components/admin/shared';
import { BlogComposerTab } from '@/components/admin/BlogComposerTab';
import { BlogManageTab } from '@/components/admin/BlogManageTab';
import { PhotoUploadTab } from '@/components/admin/PhotoUploadTab';
import { PhotoManageTab } from '@/components/admin/PhotoManageTab';
import { CollectionsTab } from '@/components/admin/CollectionsTab';
import { ProjectsTab, type AdminProjectItem } from '@/components/admin/ProjectsTab';
import { SkillsTab } from '@/components/admin/SkillsTab';
import { AdminModals } from '@/components/admin/AdminModals';

function createGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

export default function Admin() {
  // Firebase Google Auth state (restricted to authorized admin email)
  const [authStatus, setAuthStatus] = useState<AdminAuthStatus>(() =>
    isFirebaseAuthConfigured() ? 'checking' : 'unconfigured'
  );
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginNotice, setLoginNotice] = useState('');
  const [fbUser, setFbUser] = useState<AuthUserSummary | null>(null);

  const isAuthenticated = authStatus === 'signed-in';

  // Tab navigation state
  const [activeTab, setActiveTab] = useState<AdminTab>('blog');
  const [tabDirection, setTabDirection] = useState<number>(1);

  // Synced content collections
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [allCollections, setAllCollections] = useState<PhotoCollection[]>([]);
  const [hiddenRepos, setHiddenRepos] = useState<string[]>([]);
  const [customHiddenRepoName, setCustomHiddenRepoName] = useState('');
  const { repos: liveRepos } = useGithubRepos();
  const [photoFilterCollection, setPhotoFilterCollection] = useState<string>('__all__');

  // Edit & confirmation modal states
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

  // Skills state
  const [skills, setSkills] = useState<Skill[]>([]);
  const [newSkillLabel, setNewSkillLabel] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState(DEFAULT_SKILL_CATEGORIES[0]);

  // Blog & photo upload states
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [postTags, setPostTags] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [editorSessionKey, setEditorSessionKey] = useState('new-0');
  const [isPublishing, setIsPublishing] = useState(false);
  const [feedback, setFeedback] = useState<StatusFeedback | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [isDraggingPhotos, setIsDraggingPhotos] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [batchCollection, setBatchCollection] = useState('');

  const photoInputRef = useRef<HTMLInputElement>(null);
  const selectPhotosButtonRef = useRef<HTMLButtonElement>(null);
  const tabButtonRefs = useRef<Partial<Record<AdminTab, HTMLButtonElement | null>>>({});
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAuthEventRef = useRef<string | null>(null);

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

  useEffect(() => {
    return () => {
      clearRedirectTimer();
    };
  }, [clearRedirectTimer]);

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

      // Reject unauthorized Google accounts or legacy anonymous sessions
      clearRedirectFlag();
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
      redirectFallbackTimer = setTimeout(() => {
        if (cancelled) return;
        redirectSettled = true;
        clearRedirectFlag();
        if (authStateSeen && !latestUser) {
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
  }, [addLog]);

  const handleGoogleSignIn = async () => {
    if (isSigningIn || !isFirebaseAuthConfigured()) return;
    const authInstance = getFirebaseAuth();
    if (!authInstance) {
      setLoginError('Firebase Auth could not be initialized.');
      return;
    }

    const provider = createGoogleProvider();
    setIsSigningIn(true);
    setLoginError('');
    setLoginNotice('');
    addLog('Opening Google sign-in...');

    try {
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
    setEditingCollection(null);
    setPendingDelete(null);
    setFeedback(null);
    setLoginError('');
    setLoginNotice('');

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

  // --- CRUD Handlers ---

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillLabel.trim()) return;
    try {
      const added = saveSkill({ label: newSkillLabel.trim(), category: newSkillCategory });
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

  const resetBlogComposer = useCallback(() => {
    setEditingPostId(null);
    setTitle('');
    setSubtitle('');
    setPostTags([]);
    setContent('');
    setImageUrl('');
    setIsPreview(false);
    setEditorSessionKey(`new-${Date.now()}`);
  }, []);

  const handleEditPost = (post: Post) => {
    setEditingPostId(post.id);
    setTitle(post.title);
    setSubtitle(post.subtitle || '');
    setPostTags(post.tags || []);
    setContent(post.content);
    setImageUrl(post.imageUrl || '');
    setIsPreview(false);
    setEditorSessionKey(`edit-${post.id}-${Date.now()}`);
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
      await saveCollection({ name: cleanName, order: nextOrder, hidden: false });
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
          summary ? `Staged "${file.name}" (EXIF: ${summary}).` : `Staged "${file.name}".`
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Could not process image.';
        setFeedback({ kind: 'error', text: message });
        addLog(`Image error: ${message}`);
      }
    }
  };

  const handlePhotoFilesSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    await stagePhotoFiles(files);
    if (e.target) e.target.value = '';
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

      const payload = {
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        tags: postTags.length > 0 ? postTags : undefined,
        content,
        imageUrl: imageUrl.trim() || undefined,
      };

      if (editingPostId) {
        await updatePost(editingPostId, payload);
        setFeedback({ kind: 'success', text: `Updated "${title.trim()}".` });
        addLog(`Updated post "${title.trim()}".`);
      } else {
        await savePost(payload);
        setFeedback({ kind: 'success', text: `Published "${title.trim()}".` });
        addLog(`Published post "${title.trim()}".`);
      }

      resetBlogComposer();
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

  // --- Derived Views ---

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
      if (name) counts.set(name, (counts.get(name) || 0) + 1);
      else uncategorized += 1;
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

  const allAdminProjects = useMemo<AdminProjectItem[]>(() => {
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
      if (s.category && !ordered.includes(s.category)) ordered.push(s.category);
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

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
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
            className={`w-full transition-[max-width] duration-300 ${
              activeTab === 'blog'
                ? 'min-[760px]:max-w-[820px]'
                : 'min-[760px]:w-1/2 min-[760px]:max-w-[640px]'
            }`}
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
              {/* Summary & sign out row */}
              <motion.div
                variants={SECTION_ITEM_VARIANTS}
                className="flex items-baseline justify-between gap-4"
              >
                <p className="font-mono text-xs text-ink-muted min-w-0 truncate tabular-nums">
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

              {/* Single-row accessible tablist */}
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
                          aria-controls="admin-active-tabpanel"
                          tabIndex={isSelected ? 0 : -1}
                          whileTap={{ scale: 0.97 }}
                          transition={TACTILE_SPRING}
                          onClick={() => {
                            if (tab.id === 'blog' && activeTab !== 'blog') {
                              setEditingPostId(null);
                            }
                            switchTab(tab.id);
                          }}
                          className={`relative py-3 min-h-[44px] font-mono text-[11px] sm:text-xs font-normal whitespace-nowrap shrink-0 cursor-pointer transition-colors tabular-nums ${
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
                    role={feedback.kind === 'error' ? 'alert' : 'status'}
                    aria-live="polite"
                    initial={{ height: 0, opacity: 0, y: -4 }}
                    animate={{ height: 'auto', opacity: 1, y: 0 }}
                    exit={{ height: 0, opacity: 0, y: -4 }}
                    transition={ACCORDION_TRANSITION}
                    className="overflow-hidden"
                  >
                    <div
                      className={`border px-3.5 py-2 font-mono text-xs flex items-center justify-between gap-3 rounded-[2px] bg-surface/90 ${
                        feedback.kind === 'error'
                          ? 'border-danger/50 text-danger'
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
                        className="text-ink-muted hover:text-ink min-w-[32px] min-h-[32px] -mr-1 inline-flex items-center justify-center cursor-pointer shrink-0"
                      >
                        <X size={14} aria-hidden="true" />
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Directional active tab panel */}
              <motion.div variants={SECTION_ITEM_VARIANTS} className="overflow-x-clip">
                <AnimatePresence mode="wait" initial={false} custom={tabDirection}>
                  <motion.div
                    id="admin-active-tabpanel"
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
                      <BlogComposerTab
                        editingPostId={editingPostId}
                        editorSessionKey={editorSessionKey}
                        title={title}
                        subtitle={subtitle}
                        tags={postTags}
                        content={content}
                        imageUrl={imageUrl}
                        isPreview={isPreview}
                        isPublishing={isPublishing}
                        onTitleChange={setTitle}
                        onSubtitleChange={setSubtitle}
                        onTagsChange={setPostTags}
                        onContentChange={setContent}
                        onImageUrlChange={setImageUrl}
                        onPreviewChange={setIsPreview}
                        onCancelEdit={() => {
                          resetBlogComposer();
                          addLog('Cancelled post edit.');
                          switchTab('manage-blog');
                        }}
                        onLog={addLog}
                        onError={(msg) => setFeedback({ kind: 'error', text: msg })}
                        onSubmit={handlePublishPost}
                      />
                    )}

                    {activeTab === 'manage-blog' && (
                      <BlogManageTab
                        posts={allPosts}
                        onNewPost={() => {
                          resetBlogComposer();
                          switchTab('blog');
                        }}
                        onEditPost={handleEditPost}
                        onRequestDelete={(post) =>
                          setPendingDelete({ kind: 'post', id: post.id, title: post.title })
                        }
                      />
                    )}

                    {activeTab === 'photo' && (
                      <PhotoUploadTab
                        pendingPhotos={pendingPhotos}
                        batchCollection={batchCollection}
                        isDraggingPhotos={isDraggingPhotos}
                        isPublishing={isPublishing}
                        photoInputRef={photoInputRef}
                        selectPhotosButtonRef={selectPhotosButtonRef}
                        onBatchCollectionChange={setBatchCollection}
                        onApplyBatchCollection={() => {
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
                        onDraggingChange={setIsDraggingPhotos}
                        onFilesSelected={handlePhotoFilesSelected}
                        onDropFiles={(files) => {
                          void stagePhotoFiles(files);
                        }}
                        onUpdatePendingPhoto={(index, patch) => {
                          setPendingPhotos((prev) =>
                            prev.map((item, idx) =>
                              idx === index ? { ...item, ...patch } : item
                            )
                          );
                        }}
                        onRemovePendingPhoto={(photo) => {
                          setPendingPhotos((prev) => prev.filter((p) => p.id !== photo.id));
                          addLog(`Removed staged photo "${photo.title}".`);
                        }}
                        onSubmit={handlePublishPhotos}
                      />
                    )}

                    {activeTab === 'manage-photo' && (
                      <PhotoManageTab
                        allPhotos={allPhotos}
                        filteredPhotos={filteredAdminPhotos}
                        existingCollections={existingCollections}
                        photoCountByCollection={photoCountByCollection}
                        photoFilterCollection={photoFilterCollection}
                        onFilterCollectionChange={setPhotoFilterCollection}
                        onOpenCollectionsTab={() => switchTab('collections')}
                        onOpenUploadTab={() => switchTab('photo')}
                        onEditPhoto={handleEditPhoto}
                        onRequestDelete={(photo) =>
                          setPendingDelete({ kind: 'photo', id: photo.id, title: photo.title })
                        }
                      />
                    )}

                    {activeTab === 'collections' && (
                      <CollectionsTab
                        allCollections={allCollections}
                        allPhotos={allPhotos}
                        adHocCollectionNames={adHocCollectionNames}
                        photoCountByCollection={photoCountByCollection}
                        newColName={newColName}
                        newColDescription={newColDescription}
                        newColHidden={newColHidden}
                        onNewColNameChange={setNewColName}
                        onNewColDescriptionChange={setNewColDescription}
                        onNewColHiddenChange={setNewColHidden}
                        onCreateCollection={handleCreateCollection}
                        onReorderCollection={handleReorderCollection}
                        onToggleVisibility={handleToggleCollectionVisibility}
                        onEditCollection={handleEditCollection}
                        onRequestDelete={(col) =>
                          setPendingDelete({ kind: 'collection', id: col.id, title: col.name })
                        }
                        onRegisterAdHoc={handleRegisterAdHocCollection}
                      />
                    )}

                    {activeTab === 'projects' && (
                      <ProjectsTab
                        allAdminProjects={allAdminProjects}
                        hiddenRepos={hiddenRepos}
                        extraHiddenRepoNames={extraHiddenRepoNames}
                        customHiddenRepoName={customHiddenRepoName}
                        onCustomHiddenRepoNameChange={setCustomHiddenRepoName}
                        onAddCustomHiddenRepo={handleAddCustomHiddenRepo}
                        onToggleRepoVisibility={handleToggleRepoVisibility}
                      />
                    )}

                    {activeTab === 'skills' && (
                      <SkillsTab
                        skills={skills}
                        skillCategories={skillCategories}
                        newSkillLabel={newSkillLabel}
                        newSkillCategory={newSkillCategory}
                        onNewSkillLabelChange={setNewSkillLabel}
                        onNewSkillCategoryChange={setNewSkillCategory}
                        onAddSkill={handleAddSkill}
                        onDeleteSkill={handleDeleteSkill}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </motion.div>

              {/* Collapsible diagnostics & activity log */}
              <motion.div variants={SECTION_ITEM_VARIANTS} layout="position">
                <CollapsibleLog
                  id="admin-dashboard-diagnostics"
                  label="Diagnostics & activity log"
                  logs={sysLogs}
                  maxHeightClass="max-h-40"
                >
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] border-b border-line pb-3 tabular-nums">
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

            <AdminModals
              allPhotos={allPhotos}
              editingPhoto={editingPhoto}
              editPhotoTitle={editPhotoTitle}
              editPhotoDescription={editPhotoDescription}
              editPhotoMeta={editPhotoMeta}
              onEditPhotoTitleChange={setEditPhotoTitle}
              onEditPhotoDescriptionChange={setEditPhotoDescription}
              onEditPhotoMetaChange={(patch) =>
                setEditPhotoMeta((prev) => ({ ...prev, ...patch }))
              }
              onCloseEditPhoto={() => setEditingPhoto(null)}
              onSavePhotoMetadata={handleSavePhotoMetadata}
              editingCollection={editingCollection}
              editColName={editColName}
              editColDescription={editColDescription}
              editColCoverPhotoId={editColCoverPhotoId}
              editColHidden={editColHidden}
              onEditColNameChange={setEditColName}
              onEditColDescriptionChange={setEditColDescription}
              onEditColCoverPhotoIdChange={setEditColCoverPhotoId}
              onEditColHiddenChange={setEditColHidden}
              onCloseEditCollection={() => setEditingCollection(null)}
              onSaveCollectionSettings={handleSaveCollectionSettings}
              pendingDelete={pendingDelete}
              onClosePendingDelete={() => setPendingDelete(null)}
              onConfirmDelete={handleConfirmDelete}
            />
          </motion.article>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
