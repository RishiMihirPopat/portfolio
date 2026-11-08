import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from './firebase';
import { Post, Photo, Skill, mockPosts, mockPhotos, cvSkills } from './data';

const isClient = typeof window !== 'undefined';

const POSTS_KEY = 'portfolio_posts_v2';
const PHOTOS_KEY = 'portfolio_photos_v2';
const SKILLS_KEY = 'portfolio_skills_v2';

// --- Local Storage fallback helpers for Posts and Photos ---
const getLocalStorageItems = <T>(key: string, fallback: T[]): T[] => {
  if (!isClient) return fallback;
  try {
    const item = localStorage.getItem(key);
    if (!item) {
      localStorage.setItem(key, JSON.stringify(fallback));
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
    const all = getLocalStorageItems<Post>(POSTS_KEY, mockPosts);
    const updated = all.map((p) => (p.id === id ? { ...p, ...post } : p));
    localStorage.setItem(POSTS_KEY, JSON.stringify(updated));
    return;
  }
  const db = getDb();
  if (!db) throw new Error('Database not initialized');
  const cleanPost = Object.fromEntries(
    Object.entries(post).filter(([, v]) => v !== undefined && v !== null)
  );
  const docRef = doc(db, 'posts', id);
  await updateDoc(docRef, cleanPost);
};

export const updatePhoto = async (id: string, photo: Partial<Photo>): Promise<void> => {
  if (!isFirebaseConfigured()) {
    if (!isClient) return;
    const all = getLocalStorageItems<Photo>(PHOTOS_KEY, mockPhotos);
    const updated = all.map((p) => (p.id === id ? { ...p, ...photo } : p));
    localStorage.setItem(PHOTOS_KEY, JSON.stringify(updated));
    return;
  }
  const db = getDb();
  if (!db) throw new Error('Database not initialized');
  const cleanPhoto = Object.fromEntries(
    Object.entries(photo).filter(([, v]) => v !== undefined && v !== null)
  );
  const docRef = doc(db, 'photos', id);
  await updateDoc(docRef, cleanPhoto);
};

// --- Firebase Firestore / LocalStorage CRUD for Posts ---

export const fetchAllPosts = async (): Promise<Post[]> => {
  if (!isFirebaseConfigured()) {
    return getLocalStorageItems<Post>(POSTS_KEY, mockPosts);
  }
  try {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title,
        content: data.content,
        imageUrl: data.imageUrl || undefined,
        createdAt:
          data.createdAt instanceof Timestamp
            ? data.createdAt.toDate().toISOString()
            : data.createdAt,
      };
    });
  } catch (error) {
    console.error('Failed to fetch posts from Firebase, falling back to local storage:', error);
    return getLocalStorageItems<Post>(POSTS_KEY, mockPosts);
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
  const db = getDb();
  if (!db) throw new Error('Database not initialized');
  const cleanPost = Object.fromEntries(
    Object.entries(post).filter(([, v]) => v !== undefined)
  );
  const docRef = await addDoc(collection(db, 'posts'), {
    ...cleanPost,
    createdAt: Timestamp.now(),
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
    const all = getLocalStorageItems<Post>(POSTS_KEY, mockPosts);
    const updated = all.filter((p) => p.id !== id);
    localStorage.setItem(POSTS_KEY, JSON.stringify(updated));
    return;
  }
  const db = getDb();
  if (!db) return;
  await deleteDoc(doc(db, 'posts', id));
};

// --- Firebase Firestore / LocalStorage CRUD for Photos ---

export const fetchAllPhotos = async (): Promise<Photo[]> => {
  if (!isFirebaseConfigured()) {
    return getLocalStorageItems<Photo>(PHOTOS_KEY, mockPhotos);
  }
  try {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');
    const q = query(collection(db, 'photos'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        url: data.url,
        title: data.title,
        description: data.description || undefined,
        createdAt:
          data.createdAt instanceof Timestamp
            ? data.createdAt.toDate().toISOString()
            : data.createdAt,
      };
    });
  } catch (error) {
    console.error('Failed to fetch photos from Firebase, falling back to local storage:', error);
    return getLocalStorageItems<Photo>(PHOTOS_KEY, mockPhotos);
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
  const db = getDb();
  if (!db) throw new Error('Database not initialized');
  const cleanPhoto = Object.fromEntries(
    Object.entries(photo).filter(([, v]) => v !== undefined)
  );
  const docRef = await addDoc(collection(db, 'photos'), {
    ...cleanPhoto,
    createdAt: Timestamp.now(),
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
    const all = getLocalStorageItems<Photo>(PHOTOS_KEY, mockPhotos);
    const updated = all.filter((p) => p.id !== id);
    localStorage.setItem(PHOTOS_KEY, JSON.stringify(updated));
    return;
  }
  const db = getDb();
  if (!db) return;
  await deleteDoc(doc(db, 'photos', id));
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
