/**
 * Lightweight native IndexedDB media storage for prototype image and video attachments.
 * Avoids browser localStorage quota exhaustion by keeping binary data in IndexedDB
 * and storing only metadata in Task objects.
 */

const DB_NAME = 'TaskFlowMediaDB';
const DB_VERSION = 1;
const STORE_NAME = 'attachments';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Stores a binary File or Blob in IndexedDB.
 */
export async function saveMediaBlob(id: string, blob: Blob | File): Promise<string> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(blob, id);

      req.onsuccess = () => resolve(id);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to save media in IndexedDB:', err);
    return id;
  }
}

/**
 * Retrieves a Blob by key from IndexedDB.
 */
export async function getMediaBlob(id: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to retrieve media from IndexedDB:', err);
    return null;
  }
}

/**
 * Deletes a stored Blob from IndexedDB.
 */
export async function deleteMediaBlob(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to delete media from IndexedDB:', err);
  }
}

/**
 * Formats byte size into human-readable label (e.g. 2.4 MB).
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
