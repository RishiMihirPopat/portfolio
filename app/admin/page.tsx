'use client';

import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useSyncExternalStore,
} from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Camera,
  ImagePlus,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
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
  deletePost,
  deletePhoto,
  updatePost,
  updatePhoto,
} from '@/lib/storage';
import { Skill, Post, Photo } from '@/lib/data';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  AdminSessionUser,
  formatFirebaseAuthError,
  isLocalDevHost,
  signInAdminWithGoogle,
  signOutAdmin,
  subscribeAdminAuth,
} from '@/lib/admin-auth';
import { ScrambleHeading } from '@/components/ScrambleHeading';

const DEFAULT_SKILL_CATEGORIES = [
  'Languages & Stats',
  'Methods & Modeling',
  'Libraries & Tools',
];

type AdminTab = 'blog' | 'manage-blog' | 'photo' | 'manage-photo' | 'skills';
type AuthStatus = 'checking' | 'signed-out' | 'authenticated';

const subscribeNoop = () => () => {};
const getServerFalse = () => false;

interface PendingDeleteTarget {
  kind: 'post' | 'photo';
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

interface PendingPhoto {
  id: string;
  url: string;
  title: string;
  description: string;
  width: number;
  height: number;
}

const INPUT_CLASS =
  'w-full bg-surface/90 border border-line px-3 py-2.5 min-h-[44px] text-base sm:text-sm text-ink placeholder:text-ink-muted/70 focus:border-ink transition-colors rounded-[2px]';
const LABEL_CLASS = 'block font-mono text-xs text-ink-muted';
const PRIMARY_BTN_CLASS =
  'font-mono text-xs px-4 py-2.5 min-h-[44px] bg-ink text-bg border border-ink hover:opacity-85 motion-safe:active:scale-[0.99] transition-[opacity,transform,box-shadow] duration-150 ease-out cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 rounded-[2px]';
const SECONDARY_BTN_CLASS =
  'font-mono text-xs px-3.5 py-2 min-h-[44px] bg-surface/85 text-ink border border-line hover:border-ink motion-safe:active:scale-[0.99] transition-[border-color,transform] duration-150 ease-out cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 rounded-[2px]';
const INLINE_ACTION_CLASS =
  'font-mono text-xs text-ink-nav hover:text-ink underline underline-offset-4 cursor-pointer min-h-[36px] inline-flex items-center';
const DANGER_INLINE_CLASS =
  'font-mono text-xs text-red-400 [.light_&]:text-red-700 hover:underline underline-offset-4 cursor-pointer min-h-[36px] inline-flex items-center';

function GoogleMark() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className="w-4 h-4 shrink-0"
    >
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}

function summarizePostContent(raw: string): string {
  const firstParagraph = raw
    .replace(/[#*`]/g, '')
    .split(/\n\s*\n/)[0]
    ?.trim();
  return firstParagraph || raw.replace(/[#*`]/g, '').slice(0, 140);
}

interface ModalDialogProps {
  open: boolean;
  onClose: () => void;
  titleId: string;
  title: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

function ModalDialog({
  open,
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
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Progressive enhancement light-dismiss fallback for browsers lacking closedby="any"
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open || 'closedBy' in HTMLDialogElement.prototype) return;

    let pressedOutside = false;
    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      );
    };

    const onPointerDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) {
        dialog.close();
      }
      pressedOutside = false;
    };

    dialog.addEventListener('pointerdown', onPointerDown);
    dialog.addEventListener('pointerup', onPointerUp);
    return () => {
      dialog.removeEventListener('pointerdown', onPointerDown);
      dialog.removeEventListener('pointerup', onPointerUp);
    };
  }, [open]);

  const handleClose = () => {
    if (dialogRef.current) {
      dialogRef.current.returnValue = '';
    }
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={handleClose}
      {...({ closedby: 'any' } as Record<string, string>)}
      className={`p-0 m-auto w-[calc(100%-2rem)] ${maxWidthClass} max-h-[85vh] bg-bg/95 border border-line text-ink shadow-2xl overflow-hidden`}
    >
      <div className="flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line shrink-0">
          <h2 id={titleId} className="font-mono text-xs uppercase tracking-wider text-ink-muted truncate pr-4">
            {title}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-ink-muted hover:text-ink transition-colors p-1.5 min-w-[36px] min-h-[36px] inline-flex items-center justify-center cursor-pointer"
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto text-ink text-sm leading-relaxed">
          {children}
        </div>
      </div>
    </dialog>
  );
}

export default function Admin() {
  const firebaseConfigured = isFirebaseConfigured();
  const canUseLocalPreview = useSyncExternalStore(
    subscribeNoop,
    isLocalDevHost,
    getServerFalse
  );

  // Google OAuth session state (restricted to the authorized owner account)
  const [authStatus, setAuthStatus] = useState<AuthStatus>(() =>
    firebaseConfigured ? 'checking' : 'signed-out'
  );
  const [adminUser, setAdminUser] = useState<AdminSessionUser | null>(null);
  const [isLocalDevSession, setIsLocalDevSession] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  const isAuthenticated = authStatus === 'authenticated';

  // Tab state
  const [activeTab, setActiveTab] = useState<AdminTab>('blog');

  // Management lists and editing states
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [editPhotoTitle, setEditPhotoTitle] = useState('');
  const [editPhotoDescription, setEditPhotoDescription] = useState('');
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteTarget | null>(null);

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
  const lastAuthenticatedUidRef = useRef<string | null>(null);
  const isLocalDevSessionRef = useRef(false);

  // Inline images state
  const [inlineImages, setInlineImages] = useState<{ id: number; name: string; url: string }[]>([]);
  const inlineImageCounter = useRef(0);

  // Photo uploading state
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);

  // Diagnostic action log
  const [sysLogs, setSysLogs] = useState<string[]>([
    'Session initialized.',
    'Waiting for Google sign-in.',
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
    return () => clearRedirectTimer();
  }, [clearRedirectTimer]);

  // Subscribe to Firebase Google Auth state changes
  useEffect(() => {
    return subscribeAdminAuth({
      onAuthorized: (user) => {
        isLocalDevSessionRef.current = false;
        setAdminUser(user);
        setIsLocalDevSession(false);
        setLoginError('');
        setAuthStatus('authenticated');
        if (lastAuthenticatedUidRef.current !== user.uid) {
          lastAuthenticatedUidRef.current = user.uid;
          addLog(`Signed in with Google as ${user.email}.`);
        }
      },
      onSignedOut: () => {
        lastAuthenticatedUidRef.current = null;
        setAdminUser(null);
        setAuthStatus((prev) => (isLocalDevSessionRef.current ? prev : 'signed-out'));
      },
      onUnauthorized: (email) => {
        lastAuthenticatedUidRef.current = null;
        isLocalDevSessionRef.current = false;
        setAdminUser(null);
        setIsLocalDevSession(false);
        setAuthStatus('signed-out');
        setLoginError(
          `Access denied for ${email}. Only the site owner's Google account is authorized.`
        );
        addLog(`Rejected unauthorized account (${email}).`);
      },
    });
  }, [addLog]);

  const handleGoogleSignIn = async () => {
    if (isSigningIn || !firebaseConfigured) return;
    setLoginError('');
    setIsSigningIn(true);
    addLog('Google sign-in requested.');

    try {
      const user = await signInAdminWithGoogle();
      isLocalDevSessionRef.current = false;
      setAdminUser(user);
      setIsLocalDevSession(false);
      setAuthStatus('authenticated');
      if (lastAuthenticatedUidRef.current !== user.uid) {
        lastAuthenticatedUidRef.current = user.uid;
        addLog(`Signed in with Google as ${user.email}.`);
      }
    } catch (err: unknown) {
      const message = formatFirebaseAuthError(err);
      lastAuthenticatedUidRef.current = null;
      setAdminUser(null);
      setAuthStatus('signed-out');
      setLoginError(message);
      addLog(`Sign-in error: ${message}`);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleEnterLocalPreview = () => {
    if (firebaseConfigured || !isLocalDevHost()) return;
    setLoginError('');
    setAdminUser(null);
    isLocalDevSessionRef.current = true;
    setIsLocalDevSession(true);
    setAuthStatus('authenticated');
    addLog('Opened local browser preview session.');
  };

  const handleLogout = async () => {
    clearRedirectTimer();
    try {
      await signOutAdmin();
    } catch (err) {
      console.error('Sign out error', err);
    }
    lastAuthenticatedUidRef.current = null;
    isLocalDevSessionRef.current = false;
    setAdminUser(null);
    setIsLocalDevSession(false);
    setAuthStatus('signed-out');
    setLoginError('');
    setFeedback(null);
    setSysLogs(['Signed out.', 'Waiting for Google sign-in.']);
  };

  const loadPostsAndPhotos = useCallback(async () => {
    try {
      const [postsData, photosData] = await Promise.all([
        fetchAllPosts(),
        fetchAllPhotos(),
      ]);
      setAllPosts(postsData);
      setAllPhotos(photosData);
      addLog(`Synced ${postsData.length} posts and ${photosData.length} photos.`);
    } catch (err) {
      console.error('Failed to load posts/photos', err);
      addLog('Failed to load posts or photos.');
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
    setActiveTab(nextTab);
    if (clearFeedback) setFeedback(null);
    requestAnimationFrame(() => {
      tabButtonRefs.current[nextTab]?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
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
        const { url, width, height } = await compressImageWithDimensions(file, 1600, 0.82);
        setPendingPhotos((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            url,
            title: file.name.replace(/\.[^/.]+$/, ''),
            description: '',
            width,
            height,
          },
        ]);
        addLog(`Staged "${file.name}".`);
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
      }, 1000);
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
        }))
      );

      const uploadedCount = pendingPhotos.length;
      setFeedback({
        kind: 'success',
        text: `Published ${uploadedCount} photograph${uploadedCount === 1 ? '' : 's'}.`,
      });
      addLog(`Published ${uploadedCount} photograph(s).`);
      setPendingPhotos([]);
      await loadPostsAndPhotos();
      redirectTimerRef.current = setTimeout(() => {
        switchTab('manage-photo', false);
      }, 1000);
    } catch (error: unknown) {
      console.error('Publish photos error', error);
      const errText = error instanceof Error ? error.message : 'Unknown error while uploading.';
      setFeedback({ kind: 'error', text: errText });
      addLog(`Error uploading photos: ${errText}`);
    } finally {
      setIsPublishing(false);
    }
  };

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
      { id: 'skills', label: `Skills (${skills.length})` },
    ],
    [editingPostId, allPosts.length, allPhotos.length, skills.length]
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

  const sessionIdentity = adminUser?.email || (isLocalDevSession ? 'Local browser preview' : 'Signed in');
  const authStatusLabel =
    authStatus === 'checking'
      ? 'Checking session'
      : firebaseConfigured
      ? 'Google OAuth'
      : canUseLocalPreview
      ? 'Local preview'
      : 'Auth unavailable';

  if (!isAuthenticated) {
    return (
      <article
        data-ascii-panel="true"
        className="w-full min-[760px]:w-1/2 min-[760px]:max-w-[50%]"
      >
        <div className="max-[759px]:min-h-[17vh] max-[759px]:flex max-[759px]:flex-col max-[759px]:justify-end pb-3 sm:pb-4">
          <div className="w-fit">
            <ScrambleHeading
              text="Admin"
              className="font-mono text-xl sm:text-2xl font-medium tracking-tight text-ink"
            />
          </div>
        </div>

        <div className="w-full space-y-5">
          {/* Quiet summary strip — mirrors Photography and Resume */}
          <div className="border-t border-line pt-3 flex items-baseline justify-between gap-4">
            <p className="font-sans text-xs sm:text-sm text-ink-muted [text-wrap:pretty]">
              Publishing console for blog, photography, and skills.
            </p>
            <span className="font-mono text-xs text-ink-muted shrink-0">
              {authStatusLabel}
            </span>
          </div>

          {/* Editorial sign-in card */}
          <div className="border border-line bg-surface/65 rounded-[2px] p-5 sm:p-6 space-y-5 max-w-md">
            {authStatus === 'checking' ? (
              <div
                role="status"
                aria-live="polite"
                className="py-4 flex items-center gap-3 font-mono text-xs text-ink-muted"
              >
                <span
                  aria-hidden="true"
                  className="inline-block w-2 h-2 rounded-full bg-ink-muted/70 motion-safe:animate-pulse shrink-0"
                />
                <span>Checking existing session…</span>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <h2 className="font-mono text-sm font-normal text-ink [text-wrap:balance]">
                    Sign in
                  </h2>
                  <p className="font-sans text-xs sm:text-sm text-ink-muted leading-relaxed [text-wrap:pretty]">
                    Use your authorized Google account to manage blog posts, photography, and
                    skills.
                  </p>
                </div>

                {loginError && (
                  <div
                    id="admin-signin-error"
                    role="alert"
                    className="border border-red-400/50 [.light_&]:border-red-700/50 bg-surface/90 px-3.5 py-2.5 flex items-start gap-2.5 rounded-[2px] text-red-400 [.light_&]:text-red-700"
                  >
                    <AlertCircle size={15} aria-hidden="true" className="shrink-0 mt-0.5" />
                    <p className="font-mono text-xs leading-relaxed break-words">{loginError}</p>
                  </div>
                )}

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isSigningIn || !firebaseConfigured}
                    aria-busy={isSigningIn}
                    aria-describedby={loginError ? 'admin-signin-error' : undefined}
                    className="w-full min-h-[44px] px-4 py-2.5 bg-ink text-bg border border-ink font-mono text-xs font-medium inline-flex items-center justify-center gap-2.5 rounded-[2px] cursor-pointer transition-[opacity,transform,box-shadow] duration-150 ease-out hover:opacity-90 hover:shadow-sm motion-safe:active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-[3px] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                  >
                    <GoogleMark />
                    <span>{isSigningIn ? 'Signing in…' : 'Continue with Google'}</span>
                  </button>

                  {!firebaseConfigured && (
                    <div className="space-y-3 border-t border-line pt-4">
                      <p className="font-sans text-xs text-ink-muted leading-relaxed [text-wrap:pretty]">
                        Firebase Authentication environment variables are not configured in this
                        build, so Google sign-in is unavailable.
                      </p>
                      {canUseLocalPreview && (
                        <button
                          type="button"
                          onClick={handleEnterLocalPreview}
                          className={`${SECONDARY_BTN_CLASS} w-full`}
                        >
                          Open local browser preview
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="border-t border-line pt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 font-mono text-xs text-ink-muted">
              <Link
                href="/"
                className="min-h-[44px] inline-flex items-center gap-1.5 text-ink-nav hover:text-ink hover:underline underline-offset-4 transition-colors"
              >
                <span aria-hidden="true">←</span>
                <span>Return to portfolio</span>
              </Link>
              <span className="shrink-0">Authorized owner only</span>
            </div>
          </div>
        </div>
      </article>
    );
  }

  const activeTabId = `admin-tab-${activeTab}`;

  return (
    <article
      data-ascii-panel="true"
      className="w-full min-[760px]:w-1/2 min-[760px]:max-w-[50%]"
    >
      <div className="max-[759px]:min-h-[17vh] max-[759px]:flex max-[759px]:flex-col max-[759px]:justify-end pb-3 sm:pb-4">
        <div className="w-fit">
          <ScrambleHeading
            text="Admin"
            className="font-mono text-xl sm:text-2xl font-medium tracking-tight text-ink"
          />
        </div>
      </div>

      <div className="space-y-5 border-t border-line pt-3">
        {/* Summary & sign out row — mirrors Resume top strip */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="font-mono text-xs text-ink-muted min-w-0 break-words">
            {sessionIdentity} · {allPosts.length} posts · {allPhotos.length} photos · {skills.length}{' '}
            skills
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="font-mono text-xs text-ink underline underline-offset-4 hover:opacity-80 min-h-[44px] inline-flex items-center shrink-0 whitespace-nowrap cursor-pointer"
          >
            Sign out
          </button>
        </div>

        {/* Single-row accessible tablist */}
        <div
          role="tablist"
          aria-label="Admin sections"
          onKeyDown={handleTabKeyDown}
          className="flex items-center gap-3 sm:gap-5 border-t border-b border-line overflow-x-auto flex-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabButtonRefs.current[tab.id] = el;
                }}
                type="button"
                role="tab"
                id={`admin-tab-${tab.id}`}
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => {
                  if (tab.id === 'blog' && activeTab !== 'blog') {
                    setEditingPostId(null);
                  }
                  switchTab(tab.id);
                }}
                className="relative py-3 font-mono text-[11px] sm:text-xs font-normal whitespace-nowrap shrink-0 cursor-pointer transition-colors text-ink-muted hover:text-ink aria-[selected=true]:text-ink aria-[selected=true]:after:content-[''] aria-[selected=true]:after:absolute aria-[selected=true]:after:inset-x-0 aria-[selected=true]:after:bottom-0 aria-[selected=true]:after:border-b-2 aria-[selected=true]:after:border-ink"
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Status feedback banner */}
        {feedback && (
          <div
            role={feedback.kind === 'error' ? 'alert' : 'status'}
            aria-live={feedback.kind === 'error' ? 'assertive' : 'polite'}
            className={`border px-3.5 py-2.5 font-mono text-xs flex items-center justify-between gap-3 rounded-[2px] bg-surface/90 ${
              feedback.kind === 'error'
                ? 'border-red-400/50 [.light_&]:border-red-700/50 text-red-400 [.light_&]:text-red-700'
                : 'border-line text-ink'
            }`}
          >
            <span className="inline-flex items-center gap-2 min-w-0">
              {feedback.kind === 'error' && (
                <AlertCircle size={14} aria-hidden="true" className="shrink-0" />
              )}
              <span className="break-words">{feedback.text}</span>
            </span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              aria-label="Dismiss message"
              className="text-ink-muted hover:text-ink p-1 cursor-pointer shrink-0"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Active tab panel */}
        <div
          role="tabpanel"
          aria-labelledby={activeTabId}
          className="space-y-5"
        >
          {activeTab === 'blog' && (
            <form onSubmit={handlePublishPost} aria-label="Blog post editor" className="space-y-5">
              {editingPostId && (
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-line">
                  <span className="font-mono text-xs text-ink-muted">
                    Editing existing post
                  </span>
                  <button
                    type="button"
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
                  </button>
                </div>
              )}

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
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={SECONDARY_BTN_CLASS}
                  >
                    <Camera size={14} />
                    <span>Choose file</span>
                  </button>
                </div>
                {imageUrl && (
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
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className={INLINE_ACTION_CLASS}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="post-body" className={LABEL_CLASS}>
                    Body (Markdown)
                  </label>
                  <div className="flex items-center gap-3">
                    {!isPreview && (
                      <>
                        <input
                          type="file"
                          accept="image/*"
                          ref={inlineImageRef}
                          onChange={handleInlineImage}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => inlineImageRef.current?.click()}
                          className={INLINE_ACTION_CLASS}
                        >
                          <ImagePlus size={13} className="mr-1" />
                          Insert photo
                        </button>
                      </>
                    )}
                    <div className="inline-flex border border-line rounded-[2px] overflow-hidden">
                      <button
                        type="button"
                        aria-pressed={!isPreview}
                        onClick={() => setIsPreview(false)}
                        className={`px-2.5 py-1 font-mono text-xs transition-colors cursor-pointer ${
                          !isPreview
                            ? 'bg-ink text-bg'
                            : 'bg-surface/85 text-ink-muted hover:text-ink'
                        }`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        aria-pressed={isPreview}
                        onClick={() => setIsPreview(true)}
                        className={`px-2.5 py-1 font-mono text-xs transition-colors cursor-pointer ${
                          isPreview
                            ? 'bg-ink text-bg'
                            : 'bg-surface/85 text-ink-muted hover:text-ink'
                        }`}
                      >
                        Preview
                      </button>
                    </div>
                  </div>
                </div>

                {!isPreview && inlineImages.length > 0 && (
                  <div className="flex flex-wrap gap-3 p-3 border border-line bg-surface/80 rounded-[2px]">
                    {inlineImages.map((img) => (
                      <div key={img.id} className="relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.url}
                          alt={img.name}
                          className="w-16 h-16 object-cover border border-line"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setInlineImages((prev) => prev.filter((i) => i.id !== img.id));
                            addLog(`Removed inline image "${img.name}".`);
                          }}
                          aria-label={`Remove inline image ${img.name}`}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-bg border border-line text-ink hover:border-ink rounded-full text-xs flex items-center justify-center cursor-pointer"
                        >
                          ×
                        </button>
                        <p className="font-mono text-[11px] text-ink-muted truncate w-16 mt-1 text-center">
                          inline:{img.id}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {isPreview ? (
                  <div className="w-full min-h-[220px] bg-surface/90 border border-line p-4 sm:p-5 rounded-[2px] prose prose-sm prose-neutral max-w-none font-sans prose-headings:font-medium prose-headings:text-ink prose-p:text-ink/90 prose-p:leading-relaxed prose-li:text-ink/90 prose-code:font-mono prose-code:text-xs dark:prose-invert">
                    {content ? (
                      renderPreviewContent(content)
                    ) : (
                      <p className="text-ink-muted italic text-sm">Nothing to preview yet.</p>
                    )}
                  </div>
                ) : (
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
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isPublishing}
                  className={PRIMARY_BTN_CLASS}
                >
                  {isPublishing
                    ? 'Saving...'
                    : editingPostId
                    ? 'Save changes'
                    : 'Publish post'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'manage-blog' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="font-sans text-xs sm:text-sm text-ink-muted">
                  Published notes on the blog feed.
                </p>
                <button
                  type="button"
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
                </button>
              </div>

              <div className="divide-y divide-line border-t border-line">
                {allPosts.length === 0 ? (
                  <p className="font-sans text-sm text-ink-muted py-6">
                    No blog posts published yet.
                  </p>
                ) : (
                  allPosts.map((post) => (
                    <div key={post.id} className="py-3.5 space-y-1.5">
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
                        <button
                          type="button"
                          onClick={() => handleEditPost(post)}
                          className={INLINE_ACTION_CLASS}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingDelete({ kind: 'post', id: post.id, title: post.title })
                          }
                          className={DANGER_INLINE_CLASS}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'photo' && (
            <form onSubmit={handlePublishPhotos} aria-label="Photo uploader" className="space-y-5">
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
                <button
                  ref={selectPhotosButtonRef}
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className={SECONDARY_BTN_CLASS}
                >
                  <Camera size={14} />
                  <span>Select files</span>
                </button>
              </div>

              <div
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
                className={`border border-dashed transition-colors rounded-[2px] ${
                  isDraggingPhotos ? 'border-ink bg-surface/90' : 'border-line'
                }`}
              >
                {pendingPhotos.length === 0 ? (
                  <div className="py-10 px-4 text-center space-y-1">
                    <p className="font-mono text-xs text-ink">
                      Drop images here or choose files above.
                    </p>
                    <p className="font-sans text-xs text-ink-muted">
                      Images are automatically resized and compressed before saving.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-line">
                    {pendingPhotos.map((photo, index) => (
                      <div
                        key={photo.id}
                        className="p-4 flex flex-col sm:flex-row gap-4 items-start"
                      >
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
                                next[index] = { ...next[index], title: e.target.value };
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
                                next[index] = { ...next[index], description: e.target.value };
                                setPendingPhotos(next);
                              }}
                              rows={2}
                              className={`${INPUT_CLASS} font-sans resize-y`}
                              placeholder="Location, camera notes, or context..."
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPendingPhotos((prev) => prev.filter((p) => p.id !== photo.id));
                            addLog(`Removed staged photo "${photo.title}".`);
                          }}
                          aria-label={`Remove ${photo.title || 'staged photo'}`}
                          className="text-ink-muted hover:text-red-400 [.light_&]:hover:text-red-700 p-2 min-w-[36px] min-h-[36px] inline-flex items-center justify-center self-end sm:self-start cursor-pointer transition-colors"
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-1 flex justify-end">
                <button
                  type="submit"
                  disabled={isPublishing}
                  className={PRIMARY_BTN_CLASS}
                >
                  {isPublishing ? 'Uploading...' : 'Publish photos'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'manage-photo' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="font-sans text-xs sm:text-sm text-ink-muted">
                  Archived photographs shown in the photography gallery.
                </p>
                <button
                  type="button"
                  onClick={() => switchTab('photo')}
                  className="font-mono text-xs text-ink underline underline-offset-4 hover:opacity-80 inline-flex items-center gap-1 cursor-pointer min-h-[36px]"
                >
                  <Plus size={13} />
                  <span>Upload photos</span>
                </button>
              </div>

              <div className="divide-y divide-line border-t border-line">
                {allPhotos.length === 0 ? (
                  <p className="font-sans text-sm text-ink-muted py-6">
                    No photographs archived yet.
                  </p>
                ) : (
                  allPhotos.map((photo) => (
                    <div
                      key={photo.id}
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
                          <h2 className="font-mono text-sm font-normal text-ink truncate">
                            {photo.title}
                          </h2>
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
                        <button
                          type="button"
                          onClick={() => handleEditPhoto(photo)}
                          className={INLINE_ACTION_CLASS}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingDelete({ kind: 'photo', id: photo.id, title: photo.title })
                          }
                          className={DANGER_INLINE_CLASS}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
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
                  <button type="submit" className={PRIMARY_BTN_CLASS}>
                    Add skill
                  </button>
                </div>
              </form>

              <div className="divide-y divide-line border-t border-line">
                {skillCategories.map((cat) => {
                  const catSkills = skills.filter((s) => s.category === cat);
                  return (
                    <section key={cat} className="py-3.5 space-y-2.5">
                      <h2 className="font-mono text-xs text-ink-muted">{cat}</h2>
                      <div className="flex flex-wrap gap-2">
                        {catSkills.map((skill) => (
                          <span
                            key={skill.label}
                            className="inline-flex items-center gap-1.5 border border-line bg-surface/85 px-2.5 py-1 font-mono text-xs text-ink rounded-[2px]"
                          >
                            <span>{skill.label}</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteSkill(skill.label)}
                              aria-label={`Remove ${skill.label}`}
                              className="text-ink-muted hover:text-red-400 [.light_&]:hover:text-red-700 pl-0.5 cursor-pointer transition-colors"
                            >
                              ×
                            </button>
                          </span>
                        ))}
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
            </div>
          )}
        </div>

        {/* Collapsible diagnostics & activity log */}
        <details className="border-t border-line pt-3">
          <summary className="font-mono text-xs text-ink-muted hover:text-ink cursor-pointer select-none">
            Diagnostics & activity log ({sysLogs.length})
          </summary>
          <div className="mt-3 space-y-3 font-mono text-xs">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] border-b border-line pb-3">
              <dt className="text-ink-muted">Storage</dt>
              <dd className="text-ink text-right">
                {firebaseConfigured ? 'Remote Firestore' : 'Local browser'}
              </dd>
              <dt className="text-ink-muted">Authentication</dt>
              <dd className="text-ink text-right">
                {adminUser
                  ? 'Google OAuth'
                  : isLocalDevSession
                  ? 'Local browser preview'
                  : 'Signed out'}
              </dd>
              <dt className="text-ink-muted">Account</dt>
              <dd className="text-ink text-right break-all">
                {adminUser?.email || 'Local browser preview'}
              </dd>
              <dt className="text-ink-muted">Staged photos</dt>
              <dd className="text-ink text-right">{pendingPhotos.length}</dd>
            </dl>
            <div className="space-y-1 text-[11px] text-ink-muted max-h-40 overflow-y-auto">
              {sysLogs.map((log, i) => (
                <div key={i} className="leading-relaxed">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </details>
      </div>

      {/* Edit photo metadata modal */}
      <ModalDialog
        open={Boolean(editingPhoto)}
        onClose={() => setEditingPhoto(null)}
        titleId="edit-photo-dialog-title"
        title="Edit photograph"
      >
        {editingPhoto && (
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
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingPhoto(null)}
                  className={SECONDARY_BTN_CLASS}
                >
                  Cancel
                </button>
                <button type="submit" className={PRIMARY_BTN_CLASS}>
                  Save changes
                </button>
              </div>
            </form>
          </div>
        )}
      </ModalDialog>

      {/* Delete confirmation modal */}
      <ModalDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        titleId="confirm-delete-title"
        title={`Delete ${pendingDelete?.kind === 'post' ? 'post' : 'photograph'}`}
        maxWidthClass="max-w-md"
      >
        {pendingDelete && (
          <div className="space-y-5">
            <p className="font-sans text-sm text-ink leading-relaxed">
              Delete <span className="font-mono">{pendingDelete.title}</span>? This cannot be
              undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => setPendingDelete(null)}
                className={SECONDARY_BTN_CLASS}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="font-mono text-xs px-4 py-2.5 min-h-[44px] bg-red-500/90 text-bg border border-red-400 [.light_&]:bg-red-700 [.light_&]:text-white [.light_&]:border-red-700 hover:opacity-90 motion-safe:active:scale-[0.99] transition-[opacity,transform] cursor-pointer rounded-[2px]"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </ModalDialog>
    </article>
  );
}
