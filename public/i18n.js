(function () {
  const LANG_KEY = 'quicklook_lang';

  const strings = {
    en: {
      title: 'QuickLook - Photo Screening Tool',
      subtitle: 'Quick photo screening tool for photographers',
      selectDir: 'Select photo directory',
      orEnterPath: 'Or enter path manually:',
      dirPlaceholder: 'e.g. /Users/xxx/Pictures',
      open: 'Open',
      hint: 'Tip: You can also start with: node server.js /path/to/photos',
      selectedCount: 'Selected',
      photos: 'photos',
      batchCopy: 'Batch copy',
      loadingPhotos: 'Loading photos...',
      scanningPhotos: 'Scanning photos...',
      parsingDate: 'Parsing dates...',
      noPhotos: 'No photos found in this directory',
      exit: 'Exit (Esc)',
      selected: 'Selected',
      previewHint: 'Space: select | ← →: switch | Esc: exit',
      copyModalTitle: 'Batch copy',
      copyModalDesc: 'Copy {count} selected photos to target directory',
      selectTargetDir: 'Select target directory',
      orEnterTarget: 'Or enter target path (CLI mode):',
      targetPlaceholder: 'Target directory path',
      startCopy: 'Start copy',
      copying: 'Copying...',
      copyDone: 'Done! Copied',
      copyFailed: 'Copy failed:',
      close: 'Close',
      enterDirPath: 'Please enter directory path',
      enterTargetPath: 'Please enter target directory path',
      dirPickFailed: 'Directory selection failed. Use the input below to enter path manually.',
      copyProgress: '{done} / {total}',
      exitOnClose: 'Exit when close tab',
      update: 'Update',
      uninstall: 'Uninstall',
      updateSuccess: 'Update complete. Restarting...',
      updateRestarting: 'Restarting...',
      alreadyUpToDate: 'Already up to date.',
      updateChecking: 'Checking for updates...',
      updateDownloading: 'Downloading...',
      updateInstalling: 'Installing dependencies...',
      updateLauncher: 'Updating launcher...',
      updateFailed: 'Update failed',
      uninstallConfirm: 'Uninstall QuickLook? This will remove the app and all data.',
      uninstallConfirmAgain: 'Final confirmation: This cannot be undone. Continue?',
      uninstallStarted: 'Uninstall started. This page will close.',
      uninstallFailed: 'Uninstall failed',
    },
    zh: {
      title: 'QuickLook - 摄影师筛片工具',
      subtitle: '摄影师快速筛片工具',
      selectDir: '选择照片目录',
      orEnterPath: '或手动输入路径：',
      dirPlaceholder: '例如 /Users/xxx/Pictures',
      open: '打开',
      hint: '提示：可通过命令行指定目录启动，如 node server.js /path/to/photos',
      selectedCount: '已选',
      photos: '张',
      batchCopy: '批量复制',
      loadingPhotos: '正在加载照片...',
      scanningPhotos: '正在扫描照片...',
      parsingDate: '正在解析日期...',
      noPhotos: '该目录下没有找到图片',
      exit: '退出 (Esc)',
      selected: '已选中',
      previewHint: '空格: 选中/取消 | ← →: 切换 | Esc: 退出',
      copyModalTitle: '批量复制',
      copyModalDesc: '将选中的 {count} 张照片复制到目标目录',
      selectTargetDir: '选择目标目录',
      orEnterTarget: '或输入目标路径（命令行模式）：',
      targetPlaceholder: '目标目录路径',
      startCopy: '开始复制',
      copying: '复制中...',
      copyDone: '完成！成功复制',
      copyFailed: '复制失败:',
      close: '关闭',
      enterDirPath: '请输入目录路径',
      enterTargetPath: '请输入目标目录路径',
      dirPickFailed: '目录选择失败。请使用下方输入框手动输入路径。',
      copyProgress: '{done} / {total}',
      exitOnClose: '关闭标签页时退出',
      update: '更新',
      uninstall: '卸载',
      updateSuccess: '更新完成，正在重启...',
      updateRestarting: '正在重启...',
      alreadyUpToDate: '当前已是最新版本。',
      updateChecking: '正在检测更新...',
      updateDownloading: '正在下载...',
      updateInstalling: '正在安装依赖...',
      updateLauncher: '正在更新启动器...',
      updateFailed: '更新失败',
      uninstallConfirm: '确定要卸载 QuickLook？将删除应用及所有数据。',
      uninstallConfirmAgain: '再次确认：此操作不可恢复，确定继续？',
      uninstallStarted: '卸载已启动，本页面将关闭。',
      uninstallFailed: '卸载失败',
    },
  };

  function interpolate(str, vars) {
    if (!vars) return str;
    return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  }

  let lang = localStorage.getItem(LANG_KEY) || 'en';
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';

  window.i18n = {
    t(key, vars) {
      const str = strings[lang]?.[key] ?? strings.en[key] ?? key;
      return interpolate(str, vars);
    },
    setLang(l) {
      if (strings[l]) {
        lang = l;
        localStorage.setItem(LANG_KEY, l);
        document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
        return true;
      }
      return false;
    },
    getLang() {
      return lang;
    },
  };
})();
