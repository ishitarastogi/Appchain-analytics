// src/services/indexedDBService.js

import { openDB } from "idb";

const DB_NAME = "TransactionMetricsDB";
const STORE_NAME = "metricsStore";
const DB_VERSION = 1;

// Initialize and open the database
const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
        });
        // Create an index on the timestamp
        store.createIndex("timestamp", "timestamp");
      }
    },
  });
};

// Save data to IndexedDB
export const saveData = async (id, data) => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const timestamp = Date.now();
  await store.put({ id, data, timestamp });
  await tx.done;
};

// Get data from IndexedDB
export const getData = async (id) => {
  const db = await initDB();
  const store = db.transaction(STORE_NAME).objectStore(STORE_NAME);
  const record = await store.get(id);
  return record;
};

// Clear all data from IndexedDB
export const clearAllData = async () => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  await store.clear();
  await tx.done;
};
