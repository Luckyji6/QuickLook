#!/usr/bin/env node
const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const sharp = require('sharp');
const { scanDirectory, groupPhotosByDate, findFileByName, getExifInfo } = require('./utils/imageUtils');

const THUMB_SIZE = 320;

const app = express();
const PORT = 3847;

let photosBasePath = null;
let photosByDate = null;
let keepaliveCount = 0;

const CONFIG_PATH = path.join(__dirname, 'config.json');

function getStartupLang() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      if (cfg.lang === 'zh' || cfg.lang === 'en') return cfg.lang;
    }
  } catch (_) {}
  const lang = process.env.LANG || process.env.LC_ALL || '';
  return lang.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

const STARTUP_MSG = {
  en: {
    started: 'QuickLook started:',
    photoDir: 'Photo directory:',
    specifyDir: 'Specify photo directory via command line, e.g. quicklook /path/to/photos',
    orVisit: 'Or visit the URL above and select directory in the web UI',
    closeToExit: 'Close browser tab to exit (toggle in ⋮ menu)',
  },
  zh: {
    started: 'QuickLook 已启动:',
    photoDir: '照片目录:',
    specifyDir: '请通过命令行指定照片目录，例如 quicklook /path/to/photos',
    orVisit: '或访问上述 URL 后在网页中选择目录',
    closeToExit: '关闭标签页可退出（开关在 ⋮ 菜单中）',
  },
};

function openBrowser(url) {
  const plat = process.platform;
  let cmd;
  if (plat === 'darwin') cmd = `open "${url}"`;
  else if (plat === 'win32') cmd = `start "" "${url}"`;
  else cmd = `xdg-open "${url}"`;
  exec(cmd, (err) => { if (err) console.log(url); });
}

function getBinDir() {
  return path.join(os.homedir(), '.local', 'bin');
}

function getLauncherPath() {
  const bin = getBinDir();
  return process.platform === 'win32' ? path.join(bin, 'quicklook.cmd') : path.join(bin, 'quicklook');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 保存语言偏好（供启动时显示对应语言）
app.post('/api/set-lang', (req, res) => {
  const { lang } = req.body;
  if (lang !== 'zh' && lang !== 'en') {
    return res.status(400).json({ error: 'Invalid lang' });
  }
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ lang }), 'utf8');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Keepalive：页面打开时建立长连接，关闭时断开，无连接时退出进程
app.get('/api/keepalive', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Cache-Control', 'no-cache');
  res.write(' ');
  keepaliveCount++;
  req.on('close', () => {
    keepaliveCount--;
    if (keepaliveCount <= 0) process.exit(0);
  });
});

// 获取照片列表（按日期分组）
app.get('/api/photos', async (req, res) => {
  if (!photosBasePath) {
    return res.status(400).json({ error: '未指定照片目录，请通过命令行传入目录路径' });
  }
  try {
    if (!photosByDate) {
      const photos = scanDirectory(photosBasePath);
      photosByDate = await groupPhotosByDate(photos);
    }
    res.json({ groups: photosByDate, basePath: photosBasePath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 缩略图接口（主页面用），最大边长 320px
app.get(/^\/api\/thumb\/(.+)$/, async (req, res) => {
  if (!photosBasePath) return res.status(400).send('未指定照片目录');
  let relativePath = decodeURIComponent(req.params[0]).replace(/^\/+/, '');
  let fullPath = path.resolve(photosBasePath, relativePath);
  const baseResolved = path.resolve(photosBasePath);
  if (!fullPath.startsWith(baseResolved) || !fs.existsSync(fullPath)) {
    const filename = path.basename(relativePath);
    if (filename.startsWith('._')) return res.status(404).send('文件不存在');
    const found = findFileByName(photosBasePath, filename);
    if (found) {
      relativePath = found;
      fullPath = path.resolve(photosBasePath, found);
    } else {
      return res.status(404).send('文件不存在');
    }
  }
  const ext = path.extname(fullPath).toLowerCase();
  const thumbFormats = ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif', '.gif', '.heic', '.heif'];
  if (!thumbFormats.includes(ext)) {
    return res.sendFile(fullPath);
  }
  try {
    const buf = await sharp(fullPath)
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    res.setHeader('Cache-Control', 'public, max-age=2592000');
    res.setHeader('Content-Type', 'image/jpeg');
    res.send(buf);
  } catch (err) {
    res.sendFile(fullPath);
  }
});

// 提供照片原图访问（预览用）
app.get(/^\/api\/photo\/(.+)$/, (req, res) => {
  if (!photosBasePath) {
    return res.status(400).send('未指定照片目录');
  }
  let relativePath = decodeURIComponent(req.params[0]).replace(/^\/+/, '');
  let fullPath = path.resolve(photosBasePath, relativePath);
  const baseResolved = path.resolve(photosBasePath);
  if (!fullPath.startsWith(baseResolved)) {
    return res.status(403).send('禁止访问');
  }
  if (!fs.existsSync(fullPath)) {
    const filename = path.basename(relativePath);
    if (filename.startsWith('._')) return res.status(404).send('文件不存在');
    const found = findFileByName(photosBasePath, filename);
    if (found) {
      fullPath = path.resolve(photosBasePath, found);
    } else {
      return res.status(404).send('文件不存在');
    }
  }
  res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 天
  res.sendFile(fullPath);
});

// 获取照片 EXIF 信息
app.get(/^\/api\/exif\/(.+)$/, async (req, res) => {
  if (!photosBasePath) return res.status(400).json({ error: '未指定照片目录' });
  let relativePath = decodeURIComponent(req.params[0]).replace(/^\/+/, '');
  let fullPath = path.resolve(photosBasePath, relativePath);
  const baseResolved = path.resolve(photosBasePath);
  if (!fullPath.startsWith(baseResolved) || !fs.existsSync(fullPath)) {
    const filename = path.basename(relativePath);
    const found = findFileByName(photosBasePath, filename);
    if (found) fullPath = path.resolve(photosBasePath, found);
    else return res.status(404).json({ error: '文件不存在' });
  }
  try {
    const exif = await getExifInfo(fullPath);
    res.json(exif || {});
  } catch (err) {
    res.json({});
  }
});

// 设置照片目录（当命令行未传入时使用）
app.post('/api/set-dir', (req, res) => {
  const { dirPath } = req.body;
  if (!dirPath || typeof dirPath !== 'string') {
    return res.status(400).json({ error: '请提供目录路径' });
  }
  const resolved = path.resolve(dirPath.trim());
  if (!fs.existsSync(resolved)) {
    return res.status(400).json({ error: '目录不存在' });
  }
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    return res.status(400).json({ error: '路径不是目录' });
  }
  photosBasePath = resolved;
  photosByDate = null;
  res.json({ success: true, path: photosBasePath });
});

// 更新（流式返回进度，仅在有新版本时 git pull + 重装依赖 + 重建 launcher）
function sendProgress(res, data) {
  res.write(JSON.stringify(data) + '\n');
}

app.post('/api/update', async (req, res) => {
  const installDir = path.join(__dirname);
  const binDir = getBinDir();
  const launcherPath = getLauncherPath();
  const { execSync } = require('child_process');
  const isWin = process.platform === 'win32';

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders && res.flushHeaders();

  try {
    if (!fs.existsSync(path.join(installDir, '.git'))) {
      sendProgress(res, { error: 'Not a git clone. Run: curl -fsSL .../install.sh | bash' });
      res.end();
      return;
    }

    sendProgress(res, { progress: 5, messageKey: 'updateChecking' });
    execSync('git fetch origin', { cwd: installDir, stdio: 'pipe' });
    const behind = execSync('git rev-list HEAD..origin/main --count', { cwd: installDir, encoding: 'utf8' }).trim();

    if (behind === '0') {
      sendProgress(res, { progress: 100, success: true, messageKey: 'alreadyUpToDate', updated: false });
      res.end();
      return;
    }

    sendProgress(res, { progress: 15, messageKey: 'updateDownloading' });
    execSync('git pull origin main', { cwd: installDir, stdio: 'pipe' });

    let runner = 'node';
    try {
      execSync('bun --version', { stdio: 'pipe' });
      runner = 'bun';
    } catch (_) {}

    sendProgress(res, { progress: 50, messageKey: 'updateInstalling' });
    if (fs.existsSync(path.join(installDir, 'package.json'))) {
      try {
        execSync('bun install', { cwd: installDir, stdio: 'pipe' });
      } catch {
        execSync('npm install', { cwd: installDir, stdio: 'pipe' });
      }
    }

    sendProgress(res, { progress: 85, messageKey: 'updateLauncher' });
    if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });
    if (isWin) {
      const cmd = `@echo off
cd /d "${installDir}"
"${runner}" server.js %*
`;
      fs.writeFileSync(launcherPath, cmd, 'utf8');
    } else {
      const launcherScript = `#!/bin/bash
cd "${installDir}"
# Auto-update on startup (only when behind)
if [ -d ".git" ]; then
  git fetch origin 2>/dev/null
  behind=$(git rev-list HEAD..origin/main --count 2>/dev/null || echo "0")
  if [ "$behind" != "0" ] && [ "$behind" != "" ]; then
    echo "QuickLook: updating..."
    git pull origin main
    if command -v bun >/dev/null 2>&1; then bun install
    elif command -v pnpm >/dev/null 2>&1; then pnpm install
    elif command -v yarn >/dev/null 2>&1; then yarn install
    else npm install; fi
    echo "QuickLook: updated."
  fi
fi
exec ${runner} server.js "$@"
`;
      fs.writeFileSync(launcherPath, launcherScript, { mode: 0o755 });
    }

    sendProgress(res, { progress: 100, success: true, messageKey: 'updateRestarting', updated: true });
    res.end();

    const { spawn } = require('child_process');
    const args = photosBasePath ? [photosBasePath] : [];
    res.on('finish', () => {
      const opt = { detached: true, stdio: 'ignore', env: process.env };
      if (isWin) {
        spawn('cmd.exe', ['/c', launcherPath, ...args], opt).unref();
      } else {
        spawn(launcherPath, args, opt).unref();
      }
      process.exit(0);
    });
  } catch (err) {
    console.error(err);
    sendProgress(res, { error: err.message || 'Update failed' });
    res.end();
  }
});

// 卸载（跨平台：用 Node 延迟删除启动器与安装目录）
app.post('/api/uninstall', (req, res) => {
  const installDir = path.join(__dirname);
  const launcher = getLauncherPath();
  try {
    const { spawn } = require('child_process');
    const script = `
      const fs=require('fs');
      const os=require('os');
      setTimeout(() => {
        try { process.chdir(os.homedir()); } catch(e) {}
        try { fs.unlinkSync(process.env.QL_LAUNCHER); } catch(e) {}
        try { fs.rmSync(process.env.QL_DIR, { recursive: true }); } catch(e) {}
      }, 2000);
    `;
    spawn(process.execPath, ['-e', script], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, QL_LAUNCHER: launcher, QL_DIR: installDir },
    }).unref();
    res.json({ success: true, message: 'Uninstall started. This page will close.' });
    res.on('finish', () => process.exit(0));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Uninstall failed' });
  }
});

// 批量复制选中照片到目标目录
app.post('/api/copy', (req, res) => {
  const { targetDir, relativePaths } = req.body;
  if (!targetDir || !Array.isArray(relativePaths) || relativePaths.length === 0) {
    return res.status(400).json({ error: '缺少目标目录或文件列表' });
  }
  if (!photosBasePath) {
    return res.status(400).json({ error: '未指定照片目录' });
  }
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const results = [];
    for (const rel of relativePaths) {
      const srcPath = path.join(photosBasePath, rel);
      const filename = path.basename(rel);
      const destPath = path.join(targetDir, filename);
      if (!srcPath.startsWith(photosBasePath) || !fs.existsSync(srcPath)) {
        results.push({ path: rel, success: false, error: '文件不存在' });
        continue;
      }
      try {
        fs.copyFileSync(srcPath, destPath);
        results.push({ path: rel, success: true });
      } catch (e) {
        results.push({ path: rel, success: false, error: e.message });
      }
    }
    const successCount = results.filter(r => r.success).length;
    res.json({ success: true, results, successCount, total: relativePaths.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const LOGO = [
  ' ____  _     _  ____ _  __   _     ____  ____  _  __',
  '/  _ \\/ \\ /\\/ \\/   _Y |/ /  / \\   /  _ \\/  _ \\/ |/ /',
  '| / \\|| | ||| ||  / |   /   | |   | / \\|| / \\||   / ',
  '| \\_\\|| \\_/|| ||  \\_|   \\   | |_/\\| \\_/|| \\_/||   \\ ',
  '\\____\\\\____/\\_/\\____|_|\\_\\  \\____/\\____/\\____/\\_|\\_\\',
];

function showStartupBanner() {
  if (!process.stdout.isTTY) return;
  const cols = process.stdout.columns || 80;
  process.stdout.write('\x1b[2J\x1b[H');
  for (const line of LOGO) {
    const pad = Math.max(0, Math.floor((cols - line.length) / 2));
    process.stdout.write(' '.repeat(pad) + line + '\n');
  }
  process.stdout.write('\n');
}

async function start(dirArg) {
  photosBasePath = dirArg ? path.resolve(dirArg) : null;
  if (!photosBasePath && process.argv[2]) {
    photosBasePath = path.resolve(process.argv[2]);
  }

  app.listen(PORT, () => {
    const lang = getStartupLang();
    const msg = STARTUP_MSG[lang] || STARTUP_MSG.en;
    showStartupBanner();
    const url = `http://localhost:${PORT}`;
    console.log(`${msg.started} ${url}`);
    if (photosBasePath) {
      console.log(`${msg.photoDir} ${photosBasePath}`);
      openBrowser(url);
    } else {
      console.log(msg.specifyDir);
      console.log(msg.orVisit);
      openBrowser(url);
    }
    console.log(msg.closeToExit);
  });
}

// 支持命令行传入目录
const dirArg = process.argv[2];
start(dirArg);
