import { openDB, IDBPDatabase } from 'idb';
import { v4 as uuidv4 } from 'uuid';
import { OfflineRecord, SyncStatus } from '../types';
import { collection, addDoc, serverTimestamp, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

const DB_NAME = 'UPR_SmartFarm_Offline';
const STORE_NAME = 'sync_queue';

export async function initOfflineDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('sync_status', 'sync_status');
      }
    },
  });
}

export async function saveOffline<T>(collectionName: string, data: T | null, id?: string, operation: 'create' | 'update' | 'delete' = 'create') {
  const database = await initOfflineDB();
  const recordId = id || uuidv4();
  const record: OfflineRecord<T> = {
    id: recordId,
    data,
    operation,
    collection: collectionName,
    sync_status: 'pending',
    device_id: navigator.userAgent,
    timestamp: Date.now(),
  };
  
  await database.put(STORE_NAME, record);
  
  // Try to sync immediately if online
  if (navigator.onLine) {
    syncNow().catch(console.error);
  }
  
  return recordId;
}

export async function getPendingCount() {
  const database = await initOfflineDB();
  const pending = await database.getAllFromIndex(STORE_NAME, 'sync_status', 'pending');
  return pending.length;
}

export async function syncNow() {
  const database = await initOfflineDB();
  const pending = await database.getAllFromIndex(STORE_NAME, 'sync_status', 'pending');
  
  for (const record of pending) {
    try {
      await database.put(STORE_NAME, { ...record, sync_status: 'syncing' });
      
      const { collection: colName, data, id, operation } = record;
      
      if (operation === 'delete') {
        await deleteDoc(doc(db, colName, id));
      } else {
        // We use setDoc with a manual ID (the UUID we created offline) to ensure idempotency
        await setDoc(doc(db, colName, id), {
          ...data,
          syncedAt: serverTimestamp(),
          offlineId: id,
        }, { merge: true });
      }
      
      await database.put(STORE_NAME, { ...record, sync_status: 'synced' });
      // Optionally delete synced records to keep DB small
      // await database.delete(STORE_NAME, record.id);
    } catch (error) {
      console.error(`Sync error for record ${record.id}:`, error);
      await database.put(STORE_NAME, { 
        ...record, 
        sync_status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown sync error' 
      });
    }
  }
}

export async function clearOfflineData() {
  const database = await initOfflineDB();
  await database.clear(STORE_NAME);
}

// Start listener for online status
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncNow().catch(console.error);
  });
}
