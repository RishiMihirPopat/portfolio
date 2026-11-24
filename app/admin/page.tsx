'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowRight,
  Camera,
  Eye,
  EyeOff,
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
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase';
import { ScrambleHeading } from '@/components/ScrambleHeading';

const SECURE_PASS_HASHES = [
  'b75b9de0c93a0a38f32a76f26487e416d8a39a2f7c00e6a1005a305e55ff16bd', // slayr2026
  '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', // admin
];

const DEFAULT_SKILL_CATEGORIES = [
  'Languages & Stats',
  'Methods & Modeling',
  'Libraries & Tools',
];

type AdminTab = 'blog' | 'manage-blog' | 'photo' | 'manage-photo' | 'skills';

interface AuthUserSummary {
  isAnonymous?: boolean;
  email?: string | null;
}

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
  'w-full bg-surface/90 border border-line px-3 py-2.5 min-h-[44px] text-base sm:text-sm text-ink placeholder:text-ink-muted/70 focus:border-ink focus:outline-none transition-colors rounded-[2px]';
const LABEL_CLASS = 'block font-mono text-xs text-ink-muted';
const PRIMARY_BTN_CLASS =
  'font-mono text-xs px-4 py-2.5 min-h-[44px] bg-ink text-bg border border-ink hover:opacity-85 transition-opacity cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed rounded-[2px]';
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
  // Security in-memory states (no persistent localStorage or cookies saved for auth)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0);

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
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const tabButtonRefs = useRef<Partial<Record<AdminTab, HTMLButtonElement | null>>>({});
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inline images state
  const [inlineImages, setInlineImages] = useState<{ id: number; name: string; url: string }[]>([]);
  const inlineImageCounter = useRef(0);

  // Photo uploading state
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);

  // Diagnostic action log
  const [sysLogs, setSysLogs] = useState<string[]>([
    'Session initialized.',
    'Waiting for sign-in.',
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

  // Listen to Firebase Auth state changes
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const auth = getFirebaseAuth();
    if (!auth) return;

    let unsubscribe: (() => void) | undefined;
    import('firebase/auth').then(({ onAuthStateChanged }) => {
      unsubscribe = onAuthStateChanged(auth, (user) => {
        setFbUser(user ? { isAnonymous: user.isAnonymous, email: user.email } : null);
      });
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutTime <= 0) return;
    const timer = setInterval(() => {
      setLockoutTime((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutTime]);

  const hashPassword = async (rawPassword: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(rawPassword);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTime > 0) return;

    setLoginError('');
    addLog(`Authentication requested for "${username}".`);

    try {
      // 1. Email + Firebase Auth path
      if (username.includes('@') && isFirebaseConfigured()) {
        const authInstance = getFirebaseAuth();
        if (authInstance) {
          addLog('Signing in via Firebase Auth...');
          const { signInWithEmailAndPassword } = await import('firebase/auth');
          await signInWithEmailAndPassword(authInstance, username, password);
          setIsAuthenticated(true);
          setPassword('');
          addLog('Firebase sign-in succeeded.');
          return;
        }
      }

      // 2. Local passcode verification fallback
      const hashedInput = await hashPassword(password);

      if (username === 'admin' && SECURE_PASS_HASHES.includes(hashedInput)) {
        if (isFirebaseConfigured()) {
          const authInstance = getFirebaseAuth();
          if (authInstance) {
            try {
              const { signInAnonymously } = await import('firebase/auth');
              await signInAnonymously(authInstance);
              addLog('Anonymous Firebase session established.');
            } catch {
              addLog('Anonymous Firebase session declined; cloud writes may be restricted.');
            }
          }
        }
        setIsAuthenticated(true);
        setPassword('');
        addLog('Local session authenticated.');
      } else {
        const nextAttempts = loginAttempts + 1;
        setLoginAttempts(nextAttempts);
        addLog(`Sign-in rejected (${nextAttempts}/3).`);

        if (nextAttempts >= 3) {
          setLockoutTime(30);
          setLoginAttempts(0);
          setLoginError('Too many failed attempts. Please wait 30 seconds before trying again.');
          addLog('Temporary 30s sign-in cooldown active.');
        } else {
          setLoginError('Invalid username or password.');
        }
        usernameInputRef.current?.focus();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign-in verification failed.';
      console.error(err);
      setLoginError(message);
      addLog(`Sign-in error: ${message}`);
      usernameInputRef.current?.focus();
    }
  };

  const handleLogout = async () => {
    clearRedirectTimer();
    if (isFirebaseConfigured()) {
      const authInstance = getFirebaseAuth();
      if (authInstance) {
        try {
          const { signOut } = await import('firebase/auth');
          await signOut(authInstance);
          addLog('Firebase session closed.');
        } catch (err) {
          console.error('Signout error', err);
        }
      }
    }
    setIsAuthenticated(false);
    setUsername('');
    setPassword('');
    setShowPassword(false);
    setFeedback(null);
    setSysLogs(['Signed out.', 'Waiting for sign-in.']);
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

  const storageSummary = isFirebaseConfigured()
    ? fbUser?.email || (fbUser?.isAnonymous ? 'Firestore (anonymous)' : 'Firestore')
    : 'Local storage';

  if (!isAuthenticated) {
    return (
      <article
        data-ascii-panel="true"
        className="w-full min-[760px]:w-[54%] min-[760px]:max-w-[540px]"
      >
        <div className="max-[759px]:min-h-[12vh] max-[759px]:flex max-[759px]:flex-col max-[759px]:justify-end pb-3 sm:pb-4">
          <div className="w-fit">
            <ScrambleHeading
              text="Admin"
              className="font-mono text-xl sm:text-2xl font-medium tracking-tight text-ink"
            />
          </div>
        </div>

        <div className="space-y-5 border-t border-line pt-4">
          <p className="font-sans text-xs sm:text-sm text-ink-muted leading-relaxed">
            Sign in to update blog posts, photography, and skills.
          </p>

          <form
            onSubmit={handleLogin}
            aria-label="Admin sign in"
            className="space-y-4 max-w-sm"
          >
            {loginError && (
              <div
                id="login-error"
                role="alert"
                className="border border-red-700/50 dark:border-red-400/50 bg-surface/90 px-3 py-2.5 font-mono text-xs text-red-700 dark:text-red-400 rounded-[2px]"
              >
                {loginError}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="admin-username" className={LABEL_CLASS}>
                Username or email
              </label>
              <input
                ref={usernameInputRef}
                id="admin-username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (loginError) setLoginError('');
                }}
                autoComplete="username"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="next"
                aria-invalid={Boolean(loginError)}
                aria-describedby={loginError ? 'login-error' : undefined}
                className={INPUT_CLASS}
                placeholder="admin or email"
                disabled={lockoutTime > 0}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="admin-password" className={LABEL_CLASS}>
                Password
              </label>
              <div className="relative flex items-center">
                <input
                  id="admin-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (loginError) setLoginError('');
                  }}
                  autoComplete="current-password"
                  enterKeyHint="done"
                  aria-invalid={Boolean(loginError)}
                  aria-describedby={loginError ? 'login-error' : undefined}
                  className={`${INPUT_CLASS} pr-11`}
                  placeholder="Enter password"
                  disabled={lockoutTime > 0}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1 min-w-[38px] min-h-[38px] inline-flex items-center justify-center text-ink-muted hover:text-ink transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                className={`${PRIMARY_BTN_CLASS} w-full sm:w-auto`}
                disabled={lockoutTime > 0}
              >
                <span>Sign in {lockoutTime > 0 ? `(${lockoutTime}s)` : ''}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </form>

          <details className="border-t border-line pt-3 max-w-sm">
            <summary className="font-mono text-xs text-ink-muted hover:text-ink cursor-pointer select-none">
              Session log ({sysLogs.length})
            </summary>
            <div className="mt-2.5 space-y-1 font-mono text-[11px] text-ink-muted max-h-32 overflow-y-auto">
              {sysLogs.map((log, i) => (
                <div key={i} className="leading-relaxed">
                  {log}
                </div>
              ))}
            </div>
          </details>
        </div>
      </article>
    );
  }

  const activeTabId = `admin-tab-${activeTab}`;

  return (
    <article
      data-ascii-panel="true"
      className="w-full min-[760px]:w-[54%] min-[760px]:max-w-[640px]"
    >
      <div className="max-[759px]:min-h-[12vh] max-[759px]:flex max-[759px]:flex-col max-[759px]:justify-end pb-3 sm:pb-4">
        <div className="w-fit">
          <ScrambleHeading
            text="Admin"
            className="font-mono text-xl sm:text-2xl font-medium tracking-tight text-ink"
          />
        </div>
      </div>

      <div className="space-y-5 border-t border-line pt-3">
        {/* Summary & sign out row — mirrors Resume top strip */}
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-mono text-xs text-ink-muted min-w-0">
            {storageSummary} · {allPosts.length} posts · {allPhotos.length} photos · {skills.length}{' '}
            skills
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="font-mono text-xs text-ink underline underline-offset-4 hover:opacity-80 min-h-[36px] inline-flex items-center shrink-0 whitespace-nowrap cursor-pointer"
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
            role="status"
            aria-live="polite"
            className={`border px-3.5 py-2.5 font-mono text-xs flex items-center justify-between gap-3 rounded-[2px] bg-surface/90 ${
              feedback.kind === 'error'
                ? 'border-red-700/50 dark:border-red-400/50 text-red-700 dark:text-red-400'
                : 'border-line text-ink'
            }`}
          >
            <span>{feedback.text}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              aria-label="Dismiss message"
              className="text-ink-muted hover:text-ink p-1 cursor-pointer shrink-0"
            >
              <X size={14} />
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
                          className="text-ink-muted hover:text-red-700 dark:hover:text-red-400 p-2 min-w-[36px] min-h-[36px] inline-flex items-center justify-center self-end sm:self-start cursor-pointer transition-colors"
                        >
                          <Trash2 size={15} />
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
                              className="text-ink-muted hover:text-red-700 dark:hover:text-red-400 pl-0.5 cursor-pointer transition-colors"
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
                {isFirebaseConfigured() ? 'Remote Firestore' : 'Local browser'}
              </dd>
              <dt className="text-ink-muted">Database auth</dt>
              <dd className="text-ink text-right">
                {fbUser
                  ? fbUser.isAnonymous
                    ? 'Anonymous session'
                    : fbUser.email || 'Signed in'
                  : 'Local only'}
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
                className="font-mono text-xs px-4 py-2.5 min-h-[44px] bg-red-700 text-white dark:bg-red-500/90 dark:text-bg border border-red-700 dark:border-red-400 hover:opacity-90 transition-opacity cursor-pointer rounded-[2px]"
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
