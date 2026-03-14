#!/usr/bin/env node
const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const sharp = require('sharp');
const { scanDirectory, groupPhotosByDate, findFileByName, getExifInfo } = require('./utils/imageUtils');

const THUMB_SIZE = 320;

const app = express();
const PORT = 3847;

let photosBasePath = null;
let photosByDate = null;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// 更新（仅在有新版本时 git pull + 重装依赖 + 重建 launcher）
app.post('/api/update', async (req, res) => {
  const installDir = path.join(__dirname);
  const os = require('os');
  const binDir = path.join(os.homedir(), '.local', 'bin');
  const launcherPath = path.join(binDir, 'quicklook');
  try {
    if (!fs.existsSync(path.join(installDir, '.git'))) {
      return res.status(400).json({ error: 'Not a git clone. Run: curl -fsSL .../install.sh | bash' });
    }
    const { execSync } = require('child_process');
    execSync('git fetch origin', { cwd: installDir, stdio: 'pipe' });
    const behind = execSync('git rev-list HEAD..origin/main --count', { cwd: installDir, encoding: 'utf8' }).trim();
    if (behind === '0') {
      return res.json({ success: true, message: 'Already up to date.', updated: false });
    }
    execSync('git pull origin main', { cwd: installDir, stdio: 'pipe' });
    let runner = 'node';
    try {
      execSync('bun --version', { stdio: 'pipe' });
      runner = 'bun';
    } catch (_) {}
    if (fs.existsSync(path.join(installDir, 'package.json'))) {
      try {
        execSync('bun install', { cwd: installDir, stdio: 'pipe' });
      } catch {
        execSync('npm install', { cwd: installDir, stdio: 'pipe' });
      }
    }
    // Recreate launcher with auto-update logic
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
    if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(launcherPath, launcherScript, { mode: 0o755 });
    res.json({ success: true, message: 'Update complete. Restart quicklook to apply.', updated: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Update failed' });
  }
});

// 卸载（移除启动器 + 安装目录，需二次确认由前端处理）
app.post('/api/uninstall', (req, res) => {
  const installDir = path.join(__dirname);
  const binDir = path.join(require('os').homedir(), '.local', 'bin');
  const launcher = path.join(binDir, 'quicklook');
  try {
    const { spawn } = require('child_process');
    const script = `sleep 2; rm -f "${launcher}"; rm -rf "${installDir}"`;
    spawn('sh', ['-c', script], { detached: true, stdio: 'ignore' }).unref();
    res.json({ success: true, message: 'Uninstall started. This page will close.' });
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

async function start(dirArg) {
  photosBasePath = dirArg ? path.resolve(dirArg) : null;
  if (!photosBasePath && process.argv[2]) {
    photosBasePath = path.resolve(process.argv[2]);
  }

  app.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log(`QuickLook 已启动: ${url}`);
    if (photosBasePath) {
      console.log(`照片目录: ${photosBasePath}`);
      exec(`open "${url}"`);
    } else {
      console.log('请通过命令行指定照片目录，例如: node server.js /path/to/photos');
      console.log('或访问上述 URL 后在前端选择目录（需配合目录选择功能）');
      exec(`open "${url}"`);
    }
  });
}

// 支持命令行传入目录
const dirArg = process.argv[2];
start(dirArg);
