(function () {
  const PRELOAD_RANGE = 3;
  const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp', '.tiff', '.tif', '.gif', '.bmp'];
  const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm', '.ogv', '.ogg'];
  const EXIT_ON_CLOSE_KEY = 'quicklook_exit_on_close';

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
  const previewVideo = $('#preview-video');
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
  const previewLoadFill = previewLoadBar?.querySelector('.preview-load-fill');
  const copyModalDesc = $('#copy-modal-desc');
  const menuBtn = $('#menu-btn');
  const menuDropdown = $('#menu-dropdown');
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
    document.querySelectorAll('[data-lang]').forEach((btn) => {
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

  function isVideo(photo) {
    if (!photo) return false;
    if (photo.type) return photo.type === 'video';
    const name = (photo.filename || photo.relativePath || '').toLowerCase();
    return VIDEO_EXTENSIONS.some((ext) => name.endsWith(ext));
  }

  function isImage(photo) {
    return !isVideo(photo);
  }

  function getMediaUrl(photo) {
    if (state.useClientMode && photo.objectUrl) return photo.objectUrl;
    if (isVideo(photo)) return '/api/media/' + encodeURIComponent(photo.relativePath);
    return '/api/photo/' + encodeURIComponent(photo.relativePath);
  }

  function getPhotoUrl(photo) {
    return getMediaUrl(photo);
  }

  function getThumbUrl(photo) {
    if (state.useClientMode) return null;
    if (isVideo(photo)) return getMediaUrl(photo) + '#t=0.1';
    return '/api/thumb/' + encodeURIComponent(photo.relativePath);
  }

  function createClientThumbBlob(photo) {
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
            if (blob) resolve(blob);
            else reject();
          },
          'image/jpeg',
          0.8
        );
      };
      img.onerror = reject;
      img.src = photo.objectUrl;
    });
  }

  function createClientThumb(photo) {
    if (photo.thumbUrl) return Promise.resolve(photo.thumbUrl);
    return createClientThumbBlob(photo).then((blob) => {
      const thumbUrl = URL.createObjectURL(blob);
      photo.thumbUrl = thumbUrl;
      const cache = window.thumbCache;
      if (cache && photo.relativePath && photo.file?.lastModified != null) {
        cache.set(photo.relativePath, photo.file.lastModified, blob).catch(() => {});
      }
      return thumbUrl;
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
        if (IMAGE_EXTENSIONS.includes(ext) || VIDEO_EXTENSIONS.includes(ext)) {
          const file = await entry.getFile();
          photos.push({
            handle: entry,
            file,
            relativePath: relPath,
            filename: name,
            type: VIDEO_EXTENSIONS.includes(ext) ? 'video' : 'image',
          });
        }
      }
    }
    return photos;
  }

  async function getPhotoDate(photo) {
    if (isVideo(photo)) return new Date(photo.file.lastModified);
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
        const objectUrl = URL.createObjectURL(p.file);
        let thumbUrl = null;
        p.objectUrl = objectUrl;
        if (cache && isImage(p)) {
          const cached = await cache.get(p.relativePath, p.file.lastModified);
          if (cached) {
            thumbUrl = URL.createObjectURL(cached);
          }
        }
        const result = {
          relativePath: p.relativePath,
          filename: p.filename,
          file: p.file,
          objectUrl,
          date: p.date,
          type: p.type || (isVideo(p) ? 'video' : 'image'),
        };
        if (thumbUrl) result.thumbUrl = thumbUrl;
        return {
          ...result,
          thumbUrl: thumbUrl || null,
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
      .then(async (r) => {
        if (!r.ok) {
          if (r.status === 400) return [];
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error || r.statusText || 'Failed to load photos');
        }
        const data = await r.json();
        if (data.error) throw new Error(data.error);
        return data?.groups?.map((g) => ({
          date: g.date,
          photos: g.photos.map((p) => ({
            ...p,
            objectUrl: null,
            type: p.type || (isVideo(p) ? 'video' : 'image'),
          })),
        })) || [];
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
    const { el, url, photo } = item;
    if (!el.isConnected) return;
    let src = url;
    if (!src && photo) {
      if (isVideo(photo)) {
        src = getMediaUrl(photo) + '#t=0.1';
      } else if (state.useClientMode) {
        try {
          src = await createClientThumb(photo);
        } catch (_) {
          src = photo.objectUrl;
        }
      }
    }
    if (!el.isConnected || !src) return;
    if (el.tagName === 'VIDEO') {
      el.preload = 'metadata';
      el.muted = true;
      el.playsInline = true;
      el.src = src;
      el.load();
    } else {
      el.src = src;
    }
    await new Promise((resolve) => {
      if (!el.isConnected) return resolve();
      if (el.tagName === 'VIDEO') {
        if (el.readyState >= 2) return resolve();
        el.onloadeddata = el.onerror = resolve;
      } else if (el.complete) {
        resolve();
      } else {
        el.onload = el.onerror = resolve;
      }
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
              ${isVideo(p)
                ? `<video class="photo-thumb"
                   preload="metadata"
                   muted
                   playsinline
                   data-src="${(state.useClientMode ? '' : getThumbUrl(p)).replace(/"/g, '&quot;')}"
                   data-relative="${p.relativePath}"></video>
                   <span class="media-badge">${t('video')}</span>`
                : `<img class="photo-thumb"
                   src="${PLACEHOLDER}"
                   data-src="${(state.useClientMode ? '' : getThumbUrl(p)).replace(/"/g, '&quot;')}"
                   data-relative="${p.relativePath}"
                   alt="${p.filename}" />`}
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
          const el = e.target;
          if (el.dataset.loaded) return;
          el.dataset.loaded = '1';
          const url = el.dataset.src;
          const photo = state.flatPhotos.find((p) => p.relativePath === el.dataset.relative) || null;
          thumbLoadQueue.push({ el, url: url || null, photo });
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
    stopPreviewVideo();
    showPanel(mainPanel);
    renderDateGroups();
    updateSelectedUI();
  }

  async function fetchExif(photo) {
    if (isVideo(photo)) return '';
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

  function clearClientBlobCache() {
    if (state.flatPhotos && state.flatPhotos.length > 0) {
      state.flatPhotos.forEach((photo) => {
        if (photo.objectUrl && photo.objectUrl.startsWith('blob:')) {
          URL.revokeObjectURL(photo.objectUrl);
          photo.objectUrl = null;
        }
        if (photo.thumbUrl && photo.thumbUrl.startsWith('blob:')) {
          URL.revokeObjectURL(photo.thumbUrl);
          photo.thumbUrl = null;
        }
      });
    }
    if (previewImg && previewImg.src && previewImg.src.startsWith('blob:')) {
      URL.revokeObjectURL(previewImg.src);
      previewImg.src = '';
    }
    if (previewVideo && previewVideo.src && previewVideo.src.startsWith('blob:')) {
      URL.revokeObjectURL(previewVideo.src);
      previewVideo.removeAttribute('src');
      previewVideo.load();
    }
  }

  function clearClientCacheOnExit() {
    clearClientBlobCache();
    if (window.thumbCache?.clear) {
      window.thumbCache.clear().catch(() => {});
    }
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

  function showPreviewLoadBar(mode = 'indeterminate', progress = 0) {
    if (!previewLoadBar || !previewLoadFill) return;
    previewLoadBar.classList.remove('hidden');
    if (mode === 'determinate') {
      previewLoadFill.classList.add('determinate');
      previewLoadFill.style.width = `${Math.max(0, Math.min(100, progress))}%`;
    } else {
      previewLoadFill.classList.remove('determinate');
      previewLoadFill.style.width = '';
    }
  }

  function hidePreviewLoadBar() {
    if (!previewLoadBar || !previewLoadFill) return;
    previewLoadBar.classList.add('hidden');
    previewLoadFill.classList.remove('determinate');
    previewLoadFill.style.width = '';
  }

  function stopPreviewVideo() {
    if (!previewVideo) return;
    previewVideo.pause();
    previewVideo.playbackRate = 1;
    previewVideo.onloadeddata = null;
    previewVideo.onprogress = null;
    previewVideo.oncanplaythrough = null;
    previewVideo.onwaiting = null;
    previewVideo.onerror = null;
    previewVideo.removeAttribute('src');
    previewVideo.load();
  }

  function updateVideoBufferedProgress() {
    if (!previewVideo || !previewVideo.duration || !previewVideo.buffered?.length) return;
    const end = previewVideo.buffered.end(previewVideo.buffered.length - 1);
    const progress = Math.round((end / previewVideo.duration) * 100);
    if (progress >= 100) hidePreviewLoadBar();
    else showPreviewLoadBar('determinate', progress);
  }

  function updatePreview() {
    const photo = state.flatPhotos[state.currentPhotoIndex];
    if (!photo) return;
    state.previewLoaded = false;
    stopPreviewVideo();
    previewExif.textContent = '';
    previewInfo.textContent = `${state.currentPhotoIndex + 1} / ${state.flatPhotos.length}`;
    previewSelected.classList.toggle('hidden', !state.selected.has(getPhotoId(photo)));
    if (isVideo(photo)) {
      previewImg.classList.add('hidden');
      previewVideo.classList.remove('hidden');
      showPreviewLoadBar('determinate', 0);
      previewVideo.onloadeddata = () => {
        state.previewLoaded = true;
        updateVideoBufferedProgress();
        previewVideo.play().catch(() => {});
      };
      previewVideo.onprogress = () => updateVideoBufferedProgress();
      previewVideo.oncanplaythrough = () => hidePreviewLoadBar();
      previewVideo.onwaiting = () => updateVideoBufferedProgress();
      previewVideo.onerror = () => {
        state.previewLoaded = true;
        hidePreviewLoadBar();
      };
      previewVideo.src = getMediaUrl(photo);
      previewVideo.load();
      previewExif.textContent = photo.filename;
      return;
    }

    previewVideo.classList.add('hidden');
    previewImg.classList.remove('hidden');
    showPreviewLoadBar();
    previewImg.onload = () => {
      state.previewLoaded = true;
      hidePreviewLoadBar();
      fetchExif(photo).then((txt) => {
        const cur = state.flatPhotos[state.currentPhotoIndex];
        if (previewExif && cur && cur.relativePath === photo.relativePath) {
          previewExif.textContent = txt;
        }
      });
    };
    previewImg.onerror = () => {
      state.previewLoaded = true;
      hidePreviewLoadBar();
    };
    previewImg.src = getPhotoUrl(photo);
    previewImg.alt = photo.filename;
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
        if (isVideo(p)) {
          const video = document.createElement('video');
          video.preload = 'metadata';
          video.onloadeddata = video.onerror = resolve;
          video.src = getMediaUrl(p);
          video.load();
        } else {
          const img = new Image();
          img.onload = img.onerror = resolve;
          img.src = getPhotoUrl(p);
        }
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

  function startVideoFastForward() {
    const photo = state.flatPhotos[state.currentPhotoIndex];
    if (!photo || !isVideo(photo) || previewVideo.classList.contains('hidden')) return;
    previewVideo.playbackRate = 3;
  }

  function stopVideoFastForward() {
    if (!previewVideo || previewVideo.classList.contains('hidden')) return;
    previewVideo.playbackRate = 1;
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
      if (e.key === 'Enter') {
        e.preventDefault();
        startVideoFastForward();
        return;
      }
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
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') stopVideoFastForward();
    });
    window.addEventListener('blur', stopVideoFastForward);
  }

  function startKeepalive() {
    if (window._keepaliveAbort) window._keepaliveAbort.abort();
    const ctrl = new AbortController();
    window._keepaliveAbort = ctrl;
    fetch('/api/keepalive', { signal: ctrl.signal }).catch(() => {});
  }

  function registerCacheCleanupOnExit() {
    const cleanupOnce = (() => {
      let cleaned = false;
      return () => {
        if (cleaned) return;
        cleaned = true;
        clearClientCacheOnExit();
      };
    })();
    window.addEventListener('beforeunload', cleanupOnce);
    window.addEventListener('pagehide', cleanupOnce);
  }

  function init() {
    const exitOnCloseCheck = $('#exit-on-close');
    const exitOnClose = localStorage.getItem(EXIT_ON_CLOSE_KEY);
    const enabled = exitOnClose === null || exitOnClose === 'true';
    if (exitOnCloseCheck) {
      exitOnCloseCheck.checked = enabled;
      exitOnCloseCheck.addEventListener('change', () => {
        const v = exitOnCloseCheck.checked;
        localStorage.setItem(EXIT_ON_CLOSE_KEY, String(v));
        if (v) startKeepalive();
        else if (window._keepaliveAbort) window._keepaliveAbort.abort();
      });
    }
    if (enabled) startKeepalive();
    registerCacheCleanupOnExit();
    applyLang();
    document.querySelectorAll('[data-lang]').forEach((btn) => {
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

    menuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      menuDropdown?.classList.toggle('hidden');
    });
    document.addEventListener('click', () => menuDropdown?.classList.add('hidden'));
    menuDropdown?.addEventListener('click', (e) => e.stopPropagation());

    btnUpdate?.addEventListener('click', async () => {
      menuDropdown?.classList.add('hidden');
      btnUpdate.disabled = true;
      const progressEl = $('#update-progress');
      const progressFill = $('#update-progress-fill');
      const progressText = $('#update-progress-text');
      progressEl?.classList.remove('hidden');
      if (progressFill) progressFill.style.width = '0%';
      if (progressText) progressText.textContent = t('updateChecking') || 'Checking...';
      try {
        const r = await fetch('/api/update', { method: 'POST' });
        if (!r.ok) throw new Error(r.statusText);
        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let lastData = null;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line);
              lastData = data;
              if (data.progress != null && progressFill) progressFill.style.width = data.progress + '%';
              if (progressText) progressText.textContent = data.messageKey ? t(data.messageKey) : (data.message || '');
            } catch (_) {}
          }
        }
        if (buffer.trim()) {
          try {
            lastData = JSON.parse(buffer);
            if (lastData?.progress != null && progressFill) progressFill.style.width = lastData.progress + '%';
            if (progressText && lastData?.messageKey) progressText.textContent = t(lastData.messageKey);
          } catch (_) {}
        }
        progressEl?.classList.add('hidden');
        if (lastData?.error) throw new Error(lastData.error);
        alert(lastData?.updated === false ? t('alreadyUpToDate') : t('updateSuccess'));
        if (lastData?.updated) setTimeout(() => location.reload(), 1500);
      } catch (err) {
        progressEl?.classList.add('hidden');
        alert(t('updateFailed') + ': ' + err.message);
      } finally {
        btnUpdate.disabled = false;
        if (btnUpdate.dataset.i18n) btnUpdate.textContent = t(btnUpdate.dataset.i18n);
      }
    });

    btnUninstall?.addEventListener('click', async () => {
      menuDropdown?.classList.add('hidden');
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
