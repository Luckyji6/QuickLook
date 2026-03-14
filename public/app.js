(function () {
  const PRELOAD_RANGE = 3;
  const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp', '.tiff', '.tif', '.gif', '.bmp'];

  const t = (key, vars) => window.i18n?.t(key, vars) ?? key;

  let state = {
    groups: [],
    flatPhotos: [],
    selected: new Set(),
    currentGroupIndex: 0,
    currentPhotoIndex: 0,
    hasDir: false,
    useClientMode: false,
    dirHandle: null,
    previewLoaded: false,
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dirPicker = $('#dir-picker');
  const mainPanel = $('#main-panel');
  const previewPanel = $('#preview-panel');
  const copyModal = $('#copy-modal');
  const dirPickBtn = $('#dir-pick-btn');
  const dirFallback = $('#dir-fallback');
  const dirInput = $('#dir-input');
  const dirConfirm = $('#dir-confirm');
  const dateGroups = $('#date-groups');
  const loading = $('#loading');
  const selectedCount = $('#selected-count');
  const btnCopy = $('#btn-copy');
  const previewImg = $('#preview-img');
  const previewInfo = $('#preview-info');
  const previewSelected = $('#preview-selected');
  const previewSelectedCount = $('#preview-selected-count');
  const btnCopyPreview = $('#btn-copy-preview');
  const btnExitPreview = $('#btn-exit-preview');
  const copyPickerWrap = $('#copy-picker-wrap');
  const copyInputWrap = $('#copy-input-wrap');
  const copyPickTarget = $('#copy-pick-target');
  const copyTargetDir = $('#copy-target-dir');
  const copyConfirm = $('#copy-confirm');
  const copyClose = $('#copy-close');
  const copyCount = $('#copy-count');
  const copyProgress = $('#copy-progress');
  const progressFill = $('#progress-fill');
  const progressText = $('#progress-text');
  const previewExif = $('#preview-exif');
  const previewLoadBar = $('#preview-load-bar');
  const copyModalDesc = $('#copy-modal-desc');
  const langSwitcher = $('#lang-switcher');
  const settingsBtn = $('#settings-btn');
  const settingsMenu = $('#settings-menu');
  const btnUpdate = $('#btn-update');
  const btnUninstall = $('#btn-uninstall');

  const supportsDirPicker = typeof window.showDirectoryPicker === 'function';

  function applyLang() {
    document.title = t('title');
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      if (key && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    langSwitcher?.querySelectorAll('button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lang === window.i18n?.getLang());
    });
    updateSelectedUI();
    if (copyModalDesc && !copyModal.classList.contains('hidden')) {
      copyModalDesc.innerHTML = t('copyModalDesc', { count: state.selected.size });
    }
  }
  const PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  function showPanel(panel) {
    [dirPicker, mainPanel, previewPanel].forEach((p) => p.classList.add('hidden'));
    panel.classList.remove('hidden');
  }

  const THUMB_SIZE = 320;

  function getPhotoUrl(photo) {
    if (state.useClientMode && photo.objectUrl) return photo.objectUrl;
    return '/api/photo/' + encodeURIComponent(photo.relativePath);
  }

  function getThumbUrl(photo) {
    if (state.useClientMode) return null;
    return '/api/thumb/' + encodeURIComponent(photo.relativePath);
  }

  function createClientThumb(photo) {
    if (photo.thumbUrl) return Promise.resolve(photo.thumbUrl);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = THUMB_SIZE / Math.max(img.width, img.height);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        if (w <= 0 || h <= 0) return reject();
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        c.toBlob(
          (blob) => {
            if (blob) {
              photo.thumbUrl = URL.createObjectURL(blob);
              resolve(photo.thumbUrl);
            } else reject();
          },
          'image/jpeg',
          0.8
        );
      };
      img.onerror = reject;
      img.src = photo.objectUrl;
    });
  }

  function getPhotoId(photo) {
    return photo.relativePath || photo.filename;
  }

  async function scanDirHandle(handle, basePath = '') {
    const photos = [];
    for await (const [name, entry] of handle.entries()) {
      const relPath = basePath ? basePath + '/' + name : name;
      if (entry.kind === 'directory') {
        photos.push(...(await scanDirHandle(entry, relPath)));
      } else if (entry.kind === 'file') {
        if (name.startsWith('._')) continue;
        const ext = '.' + (name.split('.').pop() || '').toLowerCase();
        if (IMAGE_EXTENSIONS.includes(ext)) {
          const file = await entry.getFile();
          photos.push({ handle: entry, file, relativePath: relPath, filename: name });
        }
      }
    }
    return photos;
  }

  async function getPhotoDate(photo) {
    try {
      if (typeof exifr !== 'undefined') {
        const exif = await exifr.parse(photo.file, { pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate'] });
        if (exif?.DateTimeOriginal) return new Date(exif.DateTimeOriginal);
        if (exif?.CreateDate) return new Date(exif.CreateDate);
        if (exif?.ModifyDate) return new Date(exif.ModifyDate);
      }
    } catch (_) {}
    return new Date(photo.file.lastModified);
  }

  async function loadPhotosFromPicker(dirHandle) {
    loading.classList.remove('hidden');
    loading.textContent = t('scanningPhotos');
    const rawPhotos = await scanDirHandle(dirHandle);
    loading.textContent = t('parsingDate');
    const withDates = await Promise.all(
      rawPhotos.map(async (p) => ({ ...p, date: (await getPhotoDate(p)).toISOString().slice(0, 10) }))
    );
    const cache = window.thumbCache;
    const withUrls = await Promise.all(
      withDates.map(async (p) => {
        let objectUrl;
        if (cache) {
          const cached = await cache.get(p.relativePath, p.file.lastModified);
          if (cached) {
            objectUrl = URL.createObjectURL(cached);
          } else {
            objectUrl = URL.createObjectURL(p.file);
            cache.set(p.relativePath, p.file.lastModified, p.file);
          }
        } else {
          objectUrl = URL.createObjectURL(p.file);
        }
        return {
          relativePath: p.relativePath,
          filename: p.filename,
          file: p.file,
          objectUrl,
          date: p.date,
        };
      })
    );
    const dateMap = new Map();
    for (const p of withUrls) {
      if (!dateMap.has(p.date)) dateMap.set(p.date, []);
      dateMap.get(p.date).push(p);
    }
    const sortedDates = [...dateMap.keys()].sort((a, b) => b.localeCompare(a));
    return sortedDates.map((date) => ({
      date,
      photos: dateMap.get(date).sort((a, b) => a.filename.localeCompare(b.filename)),
    }));
  }

  function loadPhotosFromServer() {
    return fetch('/api/photos')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        return data.groups.map((g) => ({
          date: g.date,
          photos: g.photos.map((p) => ({ ...p, objectUrl: null })),
        }));
      });
  }

  function loadPhotos() {
    if (state.useClientMode && state.dirHandle) {
      return loadPhotosFromPicker(state.dirHandle);
    }
    return loadPhotosFromServer();
  }

  const THUMB_CONCURRENCY = 2;
  let thumbLoadQueue = [];
  let thumbLoadActive = 0;

  async function loadOneThumb(item) {
    const { img, url, photo } = item;
    if (!img.isConnected) return;
    let src = url;
    if (!src && state.useClientMode && photo) {
      try {
        src = await createClientThumb(photo);
      } catch (_) {
        src = photo.objectUrl;
      }
    }
    if (img.isConnected && src) img.src = src;
    await new Promise((resolve) => {
      if (!img.isConnected || img.complete) resolve();
      else img.onload = img.onerror = resolve;
    });
  }

  async function processThumbQueue() {
    while (thumbLoadQueue.length > 0 && thumbLoadActive < THUMB_CONCURRENCY) {
      const item = thumbLoadQueue.shift();
      if (!item) break;
      thumbLoadActive++;
      loadOneThumb(item).finally(() => {
        thumbLoadActive--;
        processThumbQueue();
      });
    }
  }

  function renderDateGroups() {
    if (state.groups.length === 0) {
      dateGroups.innerHTML = `<p class="empty">${t('noPhotos')}</p>`;
      loading.classList.add('hidden');
      return;
    }
    loading.classList.add('hidden');
    thumbLoadQueue = [];
    const prevIO = dateGroups._thumbIO;
    if (prevIO) prevIO.disconnect();
    dateGroups.innerHTML = state.groups
      .map(
        (g) => `
      <div class="date-group" data-date="${g.date}">
        <div class="date-group-header">
          <span>${g.date}</span>
          <span class="count">${g.photos.length} ${t('photos')}</span>
        </div>
        <div class="date-group-photos">
          ${g.photos
            .map(
              (p) => `
            <div class="photo-thumb-wrap ${state.selected.has(getPhotoId(p)) ? 'selected' : ''}"
                 data-relative="${p.relativePath}"
                 data-date="${g.date}"
                 data-filename="${p.filename}">
              <img class="photo-thumb"
                   src="${PLACEHOLDER}"
                   data-src="${(state.useClientMode ? '' : getThumbUrl(p)).replace(/"/g, '&quot;')}"
                   data-relative="${p.relativePath}"
                   alt="${p.filename}" />
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `
      )
      .join('');

    const thumbs = dateGroups.querySelectorAll('.photo-thumb');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const img = e.target;
          if (img.dataset.loaded) return;
          img.dataset.loaded = '1';
          const url = img.dataset.src;
          const photo = state.useClientMode ? state.flatPhotos.find((p) => p.relativePath === img.dataset.relative) : null;
          thumbLoadQueue.push({ img, url: url || null, photo });
          processThumbQueue();
        });
      },
      { rootMargin: '80px', threshold: 0.01 }
    );
    thumbs.forEach((img) => io.observe(img));
    dateGroups._thumbIO = io;
    dateGroups.querySelectorAll('.photo-thumb-wrap').forEach((wrap) => {
      wrap.addEventListener('click', () => enterPreview(wrap.dataset.relative));
    });

    dateGroups.querySelectorAll('.date-group-header').forEach((el) => {
      el.addEventListener('click', () => {
        const group = el.closest('.date-group');
        const first = group.querySelector('.photo-thumb-wrap');
        if (first) enterPreview(first.dataset.relative);
      });
    });
  }

  function getFlatIndex(relativePath) {
    return state.flatPhotos.findIndex((p) => p.relativePath === relativePath);
  }

  function enterPreview(relativePath) {
    const idx = getFlatIndex(relativePath);
    if (idx < 0) return;
    state.currentPhotoIndex = idx;
    state.previewLoaded = false;
    showPanel(previewPanel);
    updatePreview();
    updateSelectedUI();
    preloadNearby();
  }

  function exitPreview() {
    showPanel(mainPanel);
    renderDateGroups();
    updateSelectedUI();
  }

  async function fetchExif(photo) {
    if (state.useClientMode && photo.file) {
      try {
        if (typeof exifr !== 'undefined') {
          const exif = await exifr.parse(photo.file, {
            pick: ['DateTimeOriginal', 'CreateDate', 'FNumber', 'ExposureTime', 'ISOSpeedRatings', 'FocalLength', 'LensModel', 'Model', 'Make'],
          });
          return formatExif(exif);
        }
      } catch (_) {}
      return '';
    }
    try {
      const r = await fetch('/api/exif/' + encodeURIComponent(photo.relativePath));
      const exif = await r.json();
      return formatExifDisplay(exif);
    } catch (_) {
      return '';
    }
  }

  function formatExif(exif) {
    if (!exif) return '';
    const parts = [];
    const d = exif.DateTimeOriginal || exif.CreateDate;
    if (d) parts.push(new Date(d).toLocaleString(window.i18n?.getLang() === 'zh' ? 'zh-CN' : 'en'));
    if (exif.FocalLength != null) parts.push(`${exif.FocalLength}mm`);
    if (exif.FNumber != null) parts.push(`f/${exif.FNumber}`);
    if (exif.ExposureTime != null) parts.push(exif.ExposureTime < 1 ? `1/${Math.round(1 / exif.ExposureTime)}s` : `${exif.ExposureTime}s`);
    if (exif.ISOSpeedRatings != null) parts.push(`ISO ${exif.ISOSpeedRatings}`);
    if (exif.LensModel) parts.push(exif.LensModel);
    if (exif.Model || exif.Make) parts.push(exif.Model || exif.Make);
    return parts.join('  ·  ');
  }

  function formatExifDisplay(exif) {
    if (!exif || typeof exif !== 'object') return '';
    const parts = [];
    if (exif.date) parts.push(exif.date);
    if (exif.focalLength) parts.push(exif.focalLength);
    if (exif.fNumber) parts.push(exif.fNumber);
    if (exif.exposureTime) parts.push(exif.exposureTime);
    if (exif.iso) parts.push(exif.iso);
    if (exif.lens) parts.push(exif.lens);
    if (exif.model) parts.push(exif.model);
    return parts.join('  ·  ');
  }

  function updatePreview() {
    const photo = state.flatPhotos[state.currentPhotoIndex];
    if (!photo) return;
    state.previewLoaded = false;
    previewLoadBar.classList.remove('hidden');
    previewExif.textContent = '';
    previewImg.onload = () => {
      state.previewLoaded = true;
      previewLoadBar.classList.add('hidden');
      fetchExif(photo).then((txt) => {
        const cur = state.flatPhotos[state.currentPhotoIndex];
        if (previewExif && cur && cur.relativePath === photo.relativePath) {
          previewExif.textContent = txt;
        }
      });
    };
    previewImg.onerror = () => {
      state.previewLoaded = true;
      previewLoadBar.classList.add('hidden');
    };
    previewImg.src = getPhotoUrl(photo);
    previewImg.alt = photo.filename;
    previewInfo.textContent = `${state.currentPhotoIndex + 1} / ${state.flatPhotos.length}`;
    previewSelected.classList.toggle('hidden', !state.selected.has(getPhotoId(photo)));
  }

  let preloadAbort = false;

  async function preloadNearby() {
    preloadAbort = true;
    await new Promise((r) => setTimeout(r, 0));
    preloadAbort = false;
    const indices = [state.currentPhotoIndex];
    for (let d = 1; d <= PRELOAD_RANGE; d++) {
      if (state.currentPhotoIndex + d < state.flatPhotos.length) indices.push(state.currentPhotoIndex + d);
      if (state.currentPhotoIndex - d >= 0) indices.push(state.currentPhotoIndex - d);
    }
    for (const i of indices) {
      if (preloadAbort) return;
      const p = state.flatPhotos[i];
      await new Promise((resolve) => {
        const img = new Image();
        img.onload = img.onerror = resolve;
        img.src = getPhotoUrl(p);
      });
    }
  }

  function toggleSelect() {
    const photo = state.flatPhotos[state.currentPhotoIndex];
    if (!photo) return;
    const id = getPhotoId(photo);
    if (state.selected.has(id)) {
      state.selected.delete(id);
    } else {
      state.selected.add(id);
    }
    previewSelected.classList.toggle('hidden', !state.selected.has(id));
    updateSelectedUI();
  }

  function nextPhoto() {
    if (!state.previewLoaded) return;
    if (state.currentPhotoIndex < state.flatPhotos.length - 1) {
      state.currentPhotoIndex++;
      updatePreview();
      preloadNearby();
    }
  }

  function prevPhoto() {
    if (!state.previewLoaded) return;
    if (state.currentPhotoIndex > 0) {
      state.currentPhotoIndex--;
      updatePreview();
      preloadNearby();
    }
  }

  function updateSelectedUI() {
    const n = state.selected.size;
    selectedCount.textContent = `${t('selectedCount')} ${n} ${t('photos')}`;
    btnCopy.disabled = n === 0;
    if (previewSelectedCount) previewSelectedCount.textContent = `${t('selectedCount')} ${n} ${t('photos')}`;
    if (btnCopyPreview) btnCopyPreview.disabled = n === 0;
  }

  function openCopyModal() {
    if (copyModalDesc) copyModalDesc.innerHTML = t('copyModalDesc', { count: state.selected.size });
    copyTargetDir.value = '';
    copyProgress.classList.add('hidden');
    copyPickerWrap.classList.toggle('hidden', !state.useClientMode || !supportsDirPicker);
    copyInputWrap.classList.toggle('hidden', state.useClientMode && supportsDirPicker);
    copyModal.classList.remove('hidden');
  }

  function closeCopyModal() {
    copyModal.classList.add('hidden');
  }

  async function doCopyWithPicker() {
    try {
      const targetHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      const paths = Array.from(state.selected);
      const selectedPhotos = state.flatPhotos.filter((p) => state.selected.has(getPhotoId(p)));
      copyProgress.classList.remove('hidden');
      progressFill.style.width = '0%';
      let done = 0;
      for (const photo of selectedPhotos) {
        try {
          const destHandle = await targetHandle.getFileHandle(photo.filename, { create: true });
          const writable = await destHandle.createWritable();
          await writable.write(photo.file);
          await writable.close();
        } catch (e) {
          console.error('Copy failed:', photo.filename, e);
        }
        done++;
        progressFill.style.width = Math.round((done / selectedPhotos.length) * 100) + '%';
        progressText.textContent = `${t('copying')} ${t('copyProgress', { done, total: selectedPhotos.length })}`;
      }
      progressText.textContent = `${t('copyDone')} ${done} / ${selectedPhotos.length}`;
    } catch (err) {
      if (err.name !== 'AbortError') {
        progressText.textContent = t('copyFailed') + ' ' + err.message;
      }
    }
  }

  function doCopyWithServer() {
    const target = copyTargetDir.value.trim();
    if (!target) {
      alert(t('enterTargetPath'));
      return;
    }
    const paths = Array.from(state.selected);
    copyProgress.classList.remove('hidden');
    progressFill.style.width = '0%';
    progressText.textContent = t('copying');

    fetch('/api/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDir: target, relativePaths: paths }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        progressFill.style.width = '100%';
        progressText.textContent = `${t('copyDone')} ${data.successCount} / ${data.total}`;
      })
      .catch((err) => {
        progressText.textContent = t('copyFailed') + ' ' + err.message;
      });
  }

  function doCopy() {
    if (state.useClientMode && supportsDirPicker) {
      doCopyWithPicker();
    } else {
      doCopyWithServer();
    }
  }

  function initDirPicker() {
    if (supportsDirPicker) {
      dirPickBtn.classList.remove('hidden');
      dirPickBtn.addEventListener('click', async () => {
        try {
          const handle = await window.showDirectoryPicker({ mode: 'read' });
          state.dirHandle = handle;
          state.useClientMode = true;
          state.hasDir = true;
          showPanel(mainPanel);
          const groups = await loadPhotos();
          state.groups = groups;
          state.flatPhotos = groups.flatMap((g) => g.photos);
          renderDateGroups();
          updateSelectedUI();
        } catch (err) {
          if (err.name === 'AbortError') return;
          const msg = err.message || String(err);
          alert(t('dirPickFailed') + '\n\n' + msg);
        }
      });
    } else {
      dirPickBtn.classList.add('hidden');
    }

    dirConfirm.addEventListener('click', () => {
      const path = dirInput.value.trim();
      if (!path) {
        alert(t('enterDirPath'));
        return;
      }
      fetch('/api/set-dir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dirPath: path }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.error) throw new Error(data.error);
          state.useClientMode = false;
          state.hasDir = true;
          showPanel(mainPanel);
          return loadPhotosFromServer();
        })
        .then((groups) => {
          state.groups = groups;
          state.flatPhotos = groups.flatMap((g) => g.photos);
          renderDateGroups();
          updateSelectedUI();
        })
        .catch((err) => alert(err.message));
    });
  }

  function initKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (!copyModal.classList.contains('hidden')) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeCopyModal();
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          doCopy();
        }
        return;
      }
      if (previewPanel.classList.contains('hidden')) return;
      e.preventDefault();
      switch (e.key) {
        case ' ':
          toggleSelect();
          break;
        case 'ArrowRight':
          nextPhoto();
          break;
        case 'ArrowLeft':
          prevPhoto();
          break;
        case 'Escape':
          exitPreview();
          break;
      }
    });
  }

  function init() {
    applyLang();
    langSwitcher?.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (window.i18n?.setLang(btn.dataset.lang)) {
          applyLang();
          renderDateGroups();
        }
      });
    });
    initDirPicker();
    initKeyboard();

    btnExitPreview.addEventListener('click', exitPreview);
    if (btnCopyPreview) btnCopyPreview.addEventListener('click', openCopyModal);
    btnCopy.addEventListener('click', openCopyModal);
    copyPickTarget.addEventListener('click', doCopyWithPicker);
    copyConfirm.addEventListener('click', doCopyWithServer);
    copyClose.addEventListener('click', closeCopyModal);

    settingsBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      settingsMenu?.classList.toggle('hidden');
    });
    document.addEventListener('click', () => settingsMenu?.classList.add('hidden'));
    settingsMenu?.addEventListener('click', (e) => e.stopPropagation());

    btnUpdate?.addEventListener('click', async () => {
      settingsMenu?.classList.add('hidden');
      btnUpdate.disabled = true;
      btnUpdate.textContent = '...';
      try {
        const r = await fetch('/api/update', { method: 'POST' });
        const data = await r.json();
        if (data.error) throw new Error(data.error);
        alert(t('updateSuccess'));
      } catch (err) {
        alert(t('updateFailed') + ': ' + err.message);
      } finally {
        btnUpdate.disabled = false;
        if (btnUpdate.dataset.i18n) btnUpdate.textContent = t(btnUpdate.dataset.i18n);
      }
    });

    btnUninstall?.addEventListener('click', async () => {
      settingsMenu?.classList.add('hidden');
      if (!confirm(t('uninstallConfirm'))) return;
      if (!confirm(t('uninstallConfirmAgain'))) return;
      try {
        const r = await fetch('/api/uninstall', { method: 'POST' });
        const data = await r.json();
        if (data.error) throw new Error(data.error);
        alert(t('uninstallStarted'));
        window.close();
        setTimeout(() => { document.body.innerHTML = '<p style="padding:2rem;text-align:center">Uninstalled. You can close this tab.</p>'; }, 500);
      } catch (err) {
        alert(t('uninstallFailed') + ': ' + err.message);
      }
    });

    loadPhotosFromServer()
      .then((groups) => {
        if (groups && groups.length > 0) {
          state.useClientMode = false;
          state.hasDir = true;
          state.groups = groups;
          state.flatPhotos = groups.flatMap((g) => g.photos);
          showPanel(mainPanel);
          renderDateGroups();
          updateSelectedUI();
        } else {
          showPanel(dirPicker);
        }
      })
      .catch(() => {
        showPanel(dirPicker);
      });
  }

  init();
})();
