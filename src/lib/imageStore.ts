import { useEffect, useState } from 'react';

/**
 * Images that stay in this browser (generated mockups, uploaded logos) in IndexedDB.
 * localStorage is too small for images. When IndexedDB is unavailable, images live in memory
 * for this tab only, and the UI says they will not survive a reload.
 */
const DB = 'cad.images.v1';
const STORE = 'images';
const memory = new Map<string, string>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (!dbPromise)
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore(STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  return dbPromise;
}

export async function putImage(key: string, dataUrl: string): Promise<'idb' | 'memory'> {
  memory.set(key, dataUrl);
  const db = await open();
  if (!db) return 'memory';
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(dataUrl, key);
      tx.oncomplete = () => resolve('idb');
      tx.onerror = () => resolve('memory');
    } catch {
      resolve('memory');
    }
  });
}

export async function getImage(key: string): Promise<string | null> {
  if (memory.has(key)) return memory.get(key)!;
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => {
        const v = typeof req.result === 'string' ? req.result : null;
        if (v) memory.set(key, v);
        resolve(v);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function deleteImage(key: string) {
  memory.delete(key);
  const db = await open();
  if (!db) return;
  try {
    db.transaction(STORE, 'readwrite').objectStore(STORE).delete(key);
  } catch {
    /* ignore */
  }
}

/** undefined = loading, null = not found in this browser */
export function useStoredImage(key: string | undefined) {
  const [src, setSrc] = useState<string | null | undefined>(key ? memory.get(key) : null);
  useEffect(() => {
    let alive = true;
    if (!key) {
      setSrc(null);
      return;
    }
    setSrc(memory.get(key));
    getImage(key).then((v) => {
      if (alive) setSrc(v);
    });
    return () => {
      alive = false;
    };
  }, [key]);
  return src;
}

/** Shrinks an uploaded logo to at most `max` px so it fits comfortably in storage. */
export function fileToDataUrl(file: File, max = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('이미지 파일이 아닙니다.'));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/png'));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
