import type { Firestore } from 'firebase/firestore';
import { getApp, isFirebaseConfigured } from './firebase';
import {
  Post,
  Photo,
  PhotoCollection,
  Skill,
  cvSkills,
} from './data';

const isClient = typeof window !== 'undefined';

const POSTS_KEY = 'portfolio_posts_v3';
const PHOTOS_KEY = 'portfolio_photos_v2';
const COLLECTIONS_KEY = 'portfolio_collections_v1';
const HIDDEN_REPOS_KEY = 'portfolio_hidden_repos_v1';
const SKILLS_KEY = 'portfolio_skills_v2';

type FirestoreModule = typeof import('firebase/firestore');

let cachedFirestoreMod: FirestoreModule | null = null;
let cachedDb: Firestore | null = null;

async function getFirestoreClient(): Promise<{
  fs: FirestoreModule;
  db: Firestore;
}> {
  const appInstance = getApp();
  if (!appInstance) {
    throw new Error('Database not initialized');
  }
  if (!cachedFirestoreMod) {
    cachedFirestoreMod = await import('firebase/firestore');
  }
  if (!cachedDb) {
    cachedDb = cachedFirestoreMod.getFirestore(appInstance);
  }
  return { fs: cachedFirestoreMod, db: cachedDb };
}

// --- Local Storage fallback helpers for Posts and Photos ---
const getLocalStorageItems = <T>(key: string, fallback: T[]): T[] => {
  if (!isClient) return fallback;
  try {
    const item = localStorage.getItem(key);
    if (!item) {
      if (fallback.length > 0) {
        localStorage.setItem(key, JSON.stringify(fallback));
      }
      return fallback;
    }
    return JSON.parse(item);
  } catch (error) {
    console.error(`Failed to read ${key} from localstorage:`, error);
    return fallback;
  }
};

const saveLocalStorageItem = <T>(key: string, item: T): void => {
  if (!isClient) return;
  const all = getLocalStorageItems<T>(key, []);
  localStorage.setItem(key, JSON.stringify([item, ...all]));
};

// --- Firebase Update Methods ---

export const updatePost = async (id: string, post: Partial<Post>): Promise<void> => {
  if (!isFirebaseConfigured()) {
    if (!isClient) return;
    const all = getLocalStorageItems<Post>(POSTS_KEY, []);
    const updated = all.map((p) => (p.id === id ? { ...p, ...post } : p));
    localStorage.setItem(POSTS_KEY, JSON.stringify(updated));
    return;
  }
  const { fs, db } = await getFirestoreClient();
  const cleanPost = Object.fromEntries(
    Object.entries(post).filter(([, v]) => v !== undefined && v !== null)
  );
  const docRef = fs.doc(db, 'posts', id);
  await fs.updateDoc(docRef, cleanPost);
};

export const updatePhoto = async (id: string, photo: Partial<Photo>): Promise<void> => {
  if (!isFirebaseConfigured()) {
    if (!isClient) return;
    const all = getLocalStorageItems<Photo>(PHOTOS_KEY, []);
    const updated = all.map((p) => (p.id === id ? { ...p, ...photo } : p));
    localStorage.setItem(PHOTOS_KEY, JSON.stringify(updated));
    return;
  }
  const { fs, db } = await getFirestoreClient();
  const cleanPhoto = Object.fromEntries(
    Object.entries(photo).filter(([, v]) => v !== undefined && v !== null)
  );
  const docRef = fs.doc(db, 'photos', id);
  await fs.updateDoc(docRef, cleanPhoto);
};

// --- Firebase Firestore / LocalStorage CRUD for Posts ---

export const fetchAllPosts = async (): Promise<Post[]> => {
  if (!isFirebaseConfigured()) {
    return getLocalStorageItems<Post>(POSTS_KEY, []);
  }
  try {
    const { fs, db } = await getFirestoreClient();
    const q = fs.query(fs.collection(db, 'posts'), fs.orderBy('createdAt', 'desc'));
    const snapshot = await fs.getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data();
      const subtitle =
        typeof data.subtitle === 'string' && data.subtitle.trim().length > 0
          ? data.subtitle.trim()
          : undefined;
      const tags = Array.isArray(data.tags)
        ? data.tags
            .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
            .map((t) => t.trim())
        : undefined;
      return {
        id: d.id,
        title: data.title,
        subtitle,
        tags: tags && tags.length > 0 ? tags : undefined,
        content: data.content,
        imageUrl: data.imageUrl || undefined,
        createdAt:
          data.createdAt instanceof fs.Timestamp
            ? data.createdAt.toDate().toISOString()
            : data.createdAt,
      };
    });
  } catch (error) {
    console.error('Failed to fetch posts from Firebase, falling back to local storage:', error);
    return getLocalStorageItems<Post>(POSTS_KEY, []);
  }
};

export const savePost = async (post: Omit<Post, 'id' | 'createdAt'>): Promise<Post> => {
  if (!isFirebaseConfigured()) {
    const newPost: Post = {
      ...post,
      id: Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
    };
    saveLocalStorageItem(POSTS_KEY, newPost);
    return newPost;
  }
  const { fs, db } = await getFirestoreClient();
  const cleanPost = Object.fromEntries(
    Object.entries(post).filter(([, v]) => v !== undefined)
  );
  const docRef = await fs.addDoc(fs.collection(db, 'posts'), {
    ...cleanPost,
    createdAt: fs.Timestamp.now(),
  });
  return {
    ...post,
    id: docRef.id,
    createdAt: new Date().toISOString(),
  };
};

export const deletePost = async (id: string): Promise<void> => {
  if (!isFirebaseConfigured()) {
    if (!isClient) return;
    const all = getLocalStorageItems<Post>(POSTS_KEY, []);
    const updated = all.filter((p) => p.id !== id);
    localStorage.setItem(POSTS_KEY, JSON.stringify(updated));
    return;
  }
  const { fs, db } = await getFirestoreClient();
  await fs.deleteDoc(fs.doc(db, 'posts', id));
};

// --- Firebase Firestore / LocalStorage CRUD for Photos ---

export const fetchAllPhotos = async (): Promise<Photo[]> => {
  if (!isFirebaseConfigured()) {
    return getLocalStorageItems<Photo>(PHOTOS_KEY, []);
  }
  try {
    const { fs, db } = await getFirestoreClient();
    const q = fs.query(fs.collection(db, 'photos'), fs.orderBy('createdAt', 'desc'));
    const snapshot = await fs.getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data();
      const optStr = (v: unknown): string | undefined =>
        typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
      return {
        id: d.id,
        url: data.url,
        title: data.title,
        description: data.description || '',
        createdAt:
          data.createdAt instanceof fs.Timestamp
            ? data.createdAt.toDate().toISOString()
            : data.createdAt,
        width: typeof data.width === 'number' && data.width > 0 ? data.width : undefined,
        height: typeof data.height === 'number' && data.height > 0 ? data.height : undefined,
        camera: optStr(data.camera),
        lens: optStr(data.lens),
        focalLength: optStr(data.focalLength),
        aperture: optStr(data.aperture),
        shutterSpeed: optStr(data.shutterSpeed),
        iso: optStr(data.iso),
        takenAt: optStr(data.takenAt),
        location: optStr(data.location),
        collection: optStr(data.collection),
      };
    });
  } catch (error) {
    console.error('Failed to fetch photos from Firebase, falling back to local storage:', error);
    return getLocalStorageItems<Photo>(PHOTOS_KEY, []);
  }
};

export const savePhoto = async (photo: Omit<Photo, 'id' | 'createdAt'>): Promise<Photo> => {
  if (!isFirebaseConfigured()) {
    const newPhoto: Photo = {
      ...photo,
      id: Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
    };
    saveLocalStorageItem(PHOTOS_KEY, newPhoto);
    return newPhoto;
  }
  const { fs, db } = await getFirestoreClient();
  const cleanPhoto = Object.fromEntries(
    Object.entries(photo).filter(([, v]) => v !== undefined)
  );
  const docRef = await fs.addDoc(fs.collection(db, 'photos'), {
    ...cleanPhoto,
    createdAt: fs.Timestamp.now(),
  });
  return {
    ...photo,
    id: docRef.id,
    createdAt: new Date().toISOString(),
  };
};

export const savePhotos = async (
  newPhotos: Omit<Photo, 'id' | 'createdAt'>[]
): Promise<Photo[]> => {
  const results: Photo[] = [];
  for (const photo of newPhotos) {
    const saved = await savePhoto(photo);
    results.push(saved);
  }
  return results;
};

export const deletePhoto = async (id: string): Promise<void> => {
  if (!isFirebaseConfigured()) {
    if (!isClient) return;
    const all = getLocalStorageItems<Photo>(PHOTOS_KEY, []);
    const updated = all.filter((p) => p.id !== id);
    localStorage.setItem(PHOTOS_KEY, JSON.stringify(updated));
    return;
  }
  const { fs, db } = await getFirestoreClient();
  await fs.deleteDoc(fs.doc(db, 'photos', id));
};

// --- Firebase Firestore / LocalStorage CRUD for Photo Collections ---

function sortPhotoCollections(items: PhotoCollection[]): PhotoCollection[] {
  return [...items].sort((a, b) => {
    const orderDiff = (a.order ?? 0) - (b.order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name);
  });
}

export const fetchAllCollections = async (): Promise<PhotoCollection[]> => {
  if (!isFirebaseConfigured()) {
    return sortPhotoCollections(
      getLocalStorageItems<PhotoCollection>(COLLECTIONS_KEY, [])
    );
  }
  try {
    const { fs, db } = await getFirestoreClient();
    const snapshot = await fs.getDocs(fs.collection(db, 'photoCollections'));
    const list: PhotoCollection[] = snapshot.docs.map((d) => {
      const data = d.data();
      const optStr = (v: unknown): string | undefined =>
        typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
      return {
        id: d.id,
        name: typeof data.name === 'string' ? data.name.trim() : 'Untitled',
        description: optStr(data.description),
        coverPhotoId: optStr(data.coverPhotoId),
        order: typeof data.order === 'number' && Number.isFinite(data.order) ? data.order : 0,
        hidden: Boolean(data.hidden),
        createdAt:
          data.createdAt instanceof fs.Timestamp
            ? data.createdAt.toDate().toISOString()
            : typeof data.createdAt === 'string'
            ? data.createdAt
            : new Date().toISOString(),
      };
    });
    return sortPhotoCollections(list);
  } catch (error) {
    console.error('Failed to fetch photo collections from Firebase, falling back to local storage:', error);
    return sortPhotoCollections(
      getLocalStorageItems<PhotoCollection>(COLLECTIONS_KEY, [])
    );
  }
};

export const saveCollection = async (
  col: Omit<PhotoCollection, 'id' | 'createdAt'>
): Promise<PhotoCollection> => {
  const cleanName = col.name.trim();
  if (!cleanName) throw new Error('Collection name is required.');

  if (!isFirebaseConfigured()) {
    const all = getLocalStorageItems<PhotoCollection>(COLLECTIONS_KEY, []);
    if (all.some((c) => c.name.toLowerCase() === cleanName.toLowerCase())) {
      throw new Error(`Collection "${cleanName}" already exists.`);
    }
    const newCol: PhotoCollection = {
      ...col,
      name: cleanName,
      description: col.description?.trim() || undefined,
      coverPhotoId: col.coverPhotoId?.trim() || undefined,
      hidden: Boolean(col.hidden),
      id: `col-${Math.random().toString(36).substring(2, 9)}`,
      createdAt: new Date().toISOString(),
    };
    if (isClient) {
      localStorage.setItem(COLLECTIONS_KEY, JSON.stringify([...all, newCol]));
    }
    return newCol;
  }

  const { fs, db } = await getFirestoreClient();
  const payload = Object.fromEntries(
    Object.entries({
      name: cleanName,
      description: col.description?.trim() || undefined,
      coverPhotoId: col.coverPhotoId?.trim() || undefined,
      order: col.order,
      hidden: Boolean(col.hidden),
    }).filter(([, v]) => v !== undefined)
  );
  const docRef = await fs.addDoc(fs.collection(db, 'photoCollections'), {
    ...payload,
    createdAt: fs.Timestamp.now(),
  });
  return {
    ...col,
    name: cleanName,
    id: docRef.id,
    createdAt: new Date().toISOString(),
  };
};

export const updateCollection = async (
  id: string,
  updates: Partial<PhotoCollection>
): Promise<void> => {
  if (!isFirebaseConfigured()) {
    if (!isClient) return;
    const all = getLocalStorageItems<PhotoCollection>(COLLECTIONS_KEY, []);
    const updated = all.map((c) => (c.id === id ? { ...c, ...updates } : c));
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(updated));
    return;
  }
  const { fs, db } = await getFirestoreClient();
  const clean = Object.fromEntries(
    Object.entries(updates).filter(([, v]) => v !== undefined && v !== null)
  );
  await fs.updateDoc(fs.doc(db, 'photoCollections', id), clean);
};

export const deleteCollection = async (id: string): Promise<void> => {
  if (!isFirebaseConfigured()) {
    if (!isClient) return;
    const all = getLocalStorageItems<PhotoCollection>(COLLECTIONS_KEY, []);
    const updated = all.filter((c) => c.id !== id);
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(updated));
    return;
  }
  const { fs, db } = await getFirestoreClient();
  await fs.deleteDoc(fs.doc(db, 'photoCollections', id));
};

export const renameCollectionAcrossPhotos = async (
  oldName: string,
  newName: string
): Promise<number> => {
  const from = oldName.trim();
  const to = newName.trim();
  if (!from || from === to) return 0;

  if (!isFirebaseConfigured()) {
    if (!isClient) return 0;
    const all = getLocalStorageItems<Photo>(PHOTOS_KEY, []);
    let count = 0;
    const updated = all.map((p) => {
      if ((p.collection || '').trim().toLowerCase() === from.toLowerCase()) {
        count += 1;
        return { ...p, collection: to || undefined };
      }
      return p;
    });
    if (count > 0) {
      localStorage.setItem(PHOTOS_KEY, JSON.stringify(updated));
    }
    return count;
  }

  const photos = await fetchAllPhotos();
  const matching = photos.filter(
    (p) => (p.collection || '').trim().toLowerCase() === from.toLowerCase()
  );
  for (const photo of matching) {
    await updatePhoto(photo.id, { collection: to });
  }
  return matching.length;
};

// --- Firebase Firestore / LocalStorage settings for hidden GitHub projects ---

function normalizeHiddenRepoNames(names: unknown): string[] {
  if (!Array.isArray(names)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of names) {
    if (typeof item !== 'string') continue;
    const clean = item.trim().toLowerCase();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  }
  return out;
}

export const fetchHiddenRepos = async (): Promise<string[]> => {
  if (!isFirebaseConfigured()) {
    return normalizeHiddenRepoNames(getLocalStorageItems<string>(HIDDEN_REPOS_KEY, []));
  }
  try {
    const { fs, db } = await getFirestoreClient();
    const snap = await fs.getDoc(fs.doc(db, 'siteSettings', 'projects'));
    if (!snap.exists()) return [];
    return normalizeHiddenRepoNames(snap.data()?.hiddenRepos);
  } catch (error) {
    console.error('Failed to fetch hidden repos from Firebase, falling back to local storage:', error);
    return normalizeHiddenRepoNames(getLocalStorageItems<string>(HIDDEN_REPOS_KEY, []));
  }
};

export const saveHiddenRepos = async (hiddenRepos: string[]): Promise<string[]> => {
  const clean = normalizeHiddenRepoNames(hiddenRepos);
  if (!isFirebaseConfigured()) {
    if (isClient) {
      localStorage.setItem(HIDDEN_REPOS_KEY, JSON.stringify(clean));
    }
    return clean;
  }
  const { fs, db } = await getFirestoreClient();
  await fs.setDoc(
    fs.doc(db, 'siteSettings', 'projects'),
    {
      hiddenRepos: clean,
      updatedAt: fs.Timestamp.now(),
    },
    { merge: true }
  );
  return clean;
};

// --- Local Storage fallback for Skills ---

export const fetchAllSkills = (): Skill[] => {
  if (!isClient) return cvSkills;
  try {
    const localSkillsStr = localStorage.getItem(SKILLS_KEY);
    if (!localSkillsStr) {
      localStorage.setItem(SKILLS_KEY, JSON.stringify(cvSkills));
      return cvSkills;
    }
    return JSON.parse(localSkillsStr);
  } catch (error) {
    console.error('Failed to fetch skills from localstorage:', error);
    return cvSkills;
  }
};

export const saveSkill = (skill: Skill): Skill => {
  if (!isClient) {
    throw new Error('Can only save skill on client side');
  }
  const all = fetchAllSkills();
  if (all.some((s) => s.label.toLowerCase() === skill.label.toLowerCase())) {
    throw new Error('Skill already exists');
  }
  const updated = [...all, skill];
  localStorage.setItem(SKILLS_KEY, JSON.stringify(updated));
  return skill;
};

export const deleteSkill = (label: string): void => {
  if (!isClient) return;
  const all = fetchAllSkills();
  const updated = all.filter((s) => s.label.toLowerCase() !== label.toLowerCase());
  localStorage.setItem(SKILLS_KEY, JSON.stringify(updated));
};
