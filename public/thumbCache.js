(function () {
  const DB_NAME = 'QuickLookThumbCache';
  const STORE = 'thumbs';
  const MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 天

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
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) return resolve();
          if (cursor.value && cursor.value.time < cutoff) {
            cursor.delete();
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
        const d = await getDB();
        return new Promise((resolve, reject) => {
          const tx = d.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put({
            key: cacheKey(path, lastModified),
            blob,
            time: Date.now(),
          });
          tx.oncomplete = () => resolve();
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
