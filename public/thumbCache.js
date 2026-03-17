(function () {
  const DB_NAME = 'QuickLookThumbCache';
  const STORE = 'thumbs';
  const MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 天
  const MAX_BLOB_BYTES = 8 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 300 * 1024 * 1024;

  let db = null;

  function getDB() {
    if (db) return Promise.resolve(db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        db = req.result;
        resolve(db);
      };
      req.onupgradeneeded = (e) => {
        e.target.result.createObjectStore(STORE, { keyPath: 'key' });
      };
    });
  }

  function cacheKey(path, lastModified) {
    return path + '|' + lastModified;
  }

  async function purgeExpiredEntries() {
    try {
      const d = await getDB();
      const cutoff = Date.now() - MAX_AGE;
      return new Promise((resolve, reject) => {
        const tx = d.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const entries = [];
        let total = 0;
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) {
            if (total > MAX_TOTAL_BYTES) {
              const sorted = entries.sort((a, b) => a.time - b.time);
              let excess = total - MAX_TOTAL_BYTES;
              for (const item of sorted) {
                if (excess <= 0) break;
                if (!item) continue;
                try {
                  store.delete(item.key);
                  excess -= item.size || 0;
                } catch (_) {}
              }
            }
            return resolve();
          }
          const blob = cursor.value?.blob;
          const size = blob?.size || 0;
          total += size;
          entries.push({
            key: cursor.key,
            time: cursor.value?.time || 0,
            size,
          });
          if ((cursor.value && cursor.value.time < cutoff) || (blob && blob.size > MAX_BLOB_BYTES)) {
            cursor.delete();
            total -= size;
          }
          cursor.continue();
        };
        req.onerror = () => reject(req.error);
      });
    } catch (_) {}
  }

  window.thumbCache = {
    async get(path, lastModified) {
      try {
        const d = await getDB();
        return new Promise((resolve, reject) => {
          const tx = d.transaction(STORE, 'readwrite');
          const store = tx.objectStore(STORE);
          const key = cacheKey(path, lastModified);
          const req = store.get(key);
          req.onsuccess = () => {
            const r = req.result;
            if (!r || Date.now() - r.time > MAX_AGE) {
              if (r) store.delete(key);
              resolve(null);
            } else {
              resolve(r.blob);
            }
          };
          req.onerror = () => reject(req.error);
        });
      } catch (_) {
        return null;
      }
    },
    async set(path, lastModified, blob) {
      try {
        if (!blob || blob.size > MAX_BLOB_BYTES) return;
        const d = await getDB();
        return new Promise((resolve, reject) => {
          const tx = d.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put({
            key: cacheKey(path, lastModified),
            blob,
            time: Date.now(),
          });
          tx.oncomplete = () => {
            purgeExpiredEntries().catch(() => {});
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        });
      } catch (_) {}
    },
    async clear() {
      try {
        const d = await getDB();
        return new Promise((resolve, reject) => {
          const tx = d.transaction(STORE, 'readwrite');
          const req = tx.objectStore(STORE).clear();
          req.onsuccess = () => resolve();
          req.onerror = () => reject(tx.error);
        });
      } catch (_) {}
    },
    async cleanupExpired() {
      return purgeExpiredEntries();
    },
  };

  purgeExpiredEntries().catch(() => {});
})();
