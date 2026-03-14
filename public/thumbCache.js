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

  window.thumbCache = {
    async get(path, lastModified) {
      try {
        const d = await getDB();
        return new Promise((resolve, reject) => {
          const tx = d.transaction(STORE, 'readonly');
          const req = tx.objectStore(STORE).get(cacheKey(path, lastModified));
          req.onsuccess = () => {
            const r = req.result;
            if (!r || Date.now() - r.time > MAX_AGE) resolve(null);
            else resolve(r.blob);
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
  };
})();
