// IndexedDB Storage Service for heavy spreadsheet tables & data rows

const DB_NAME = 'LeptaDatabaseStore';
const DB_VERSION = 1;
const STORE_ROWS = 'table_data_rows';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB não é suportado neste ambiente.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_ROWS)) {
        db.createObjectStore(STORE_ROWS); // Key will be tableId
      }
    };
  });
}

/**
 * Save rows for a specific tableId in IndexedDB
 */
export async function saveTableRows(tableId: string, rows: Record<string, any>[]): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ROWS, 'readwrite');
      const store = tx.objectStore(STORE_ROWS);
      const req = store.put(rows, tableId);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Error saving to IndexedDB:', err);
  }
}

/**
 * Retrieve rows for a specific tableId from IndexedDB
 */
export async function getTableRows(tableId: string): Promise<Record<string, any>[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ROWS, 'readonly');
      const store = tx.objectStore(STORE_ROWS);
      const req = store.get(tableId);

      req.onsuccess = () => {
        resolve(req.result || []);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Error reading from IndexedDB:', err);
    return [];
  }
}

/**
 * Delete rows for a tableId from IndexedDB
 */
export async function deleteTableRows(tableId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ROWS, 'readwrite');
      const store = tx.objectStore(STORE_ROWS);
      const req = store.delete(tableId);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Error deleting from IndexedDB:', err);
  }
}
