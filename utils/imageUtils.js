const fs = require('fs');
const path = require('path');
const exifr = require('exifr');

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp', '.tiff', '.tif', '.gif', '.bmp'];

/**
 * 递归扫描目录获取所有图片文件
 */
function scanDirectory(dirPath, basePath = dirPath) {
  const results = [];
  if (!fs.existsSync(dirPath)) return results;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanDirectory(fullPath, basePath));
    } else if (entry.isFile()) {
      if (entry.name.startsWith('._')) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (IMAGE_EXTENSIONS.includes(ext)) {
        const relativePath = path.relative(basePath, fullPath);
        results.push({
          path: fullPath,
          relativePath: relativePath.replace(/\\/g, '/'),
          filename: entry.name,
        });
      }
    }
  }
  return results;
}

/**
 * 从 EXIF 或文件修改时间获取拍摄日期
 */
async function getPhotoDate(filePath) {
  try {
    const exif = await exifr.parse(filePath, { pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate'] });
    if (exif?.DateTimeOriginal) return new Date(exif.DateTimeOriginal);
    if (exif?.CreateDate) return new Date(exif.CreateDate);
    if (exif?.ModifyDate) return new Date(exif.ModifyDate);
  } catch (_) {
    // EXIF 解析失败，使用文件修改时间
  }
  const stats = fs.statSync(filePath);
  return stats.mtime;
}

/**
 * 按日期分组图片
 */
async function groupPhotosByDate(photos) {
  const dateMap = new Map();
  for (const photo of photos) {
    const date = await getPhotoDate(photo.path);
    const dateKey = date.toISOString().slice(0, 10);
    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, []);
    }
    dateMap.get(dateKey).push({
      ...photo,
      date: dateKey,
    });
  }
  // 按日期倒序排列
  const sortedDates = [...dateMap.keys()].sort((a, b) => b.localeCompare(a));
  return sortedDates.map(date => ({
    date,
    photos: dateMap.get(date).sort((a, b) => a.filename.localeCompare(b.filename)),
  }));
}

/**
 * 获取照片完整 EXIF 信息（用于预览显示）
 */
async function getExifInfo(filePath) {
  try {
    const exif = await exifr.parse(filePath, {
      pick: [
        'DateTimeOriginal',
        'CreateDate',
        'ModifyDate',
        'FNumber',
        'ExposureTime',
        'ISOSpeedRatings',
        'FocalLength',
        'LensModel',
        'Model',
        'Make',
      ],
    });
    if (!exif) return null;
    const fNum = exif.FNumber;
    const exp = exif.ExposureTime;
    const iso = exif.ISOSpeedRatings;
    const focal = exif.FocalLength;
    let dateStr = '';
    const d = exif.DateTimeOriginal || exif.CreateDate || exif.ModifyDate;
    if (d) dateStr = new Date(d).toLocaleString('zh-CN');
    return {
      date: dateStr,
      fNumber: fNum != null ? `f/${fNum}` : null,
      exposureTime: exp != null ? (exp < 1 ? `1/${Math.round(1 / exp)}s` : `${exp}s`) : null,
      iso: iso != null ? `ISO ${iso}` : null,
      focalLength: focal != null ? `${focal}mm` : null,
      lens: exif.LensModel || null,
      model: exif.Model || exif.Make || null,
    };
  } catch (_) {
    return null;
  }
}

/**
 * 在目录中按文件名递归查找文件
 */
function findFileByName(dirPath, filename, basePath = dirPath) {
  if (!fs.existsSync(dirPath)) return null;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const found = findFileByName(fullPath, filename, basePath);
      if (found) return found;
    } else if (entry.isFile() && entry.name === filename) {
      return path.relative(basePath, fullPath).replace(/\\/g, '/');
    }
  }
  return null;
}

module.exports = {
  scanDirectory,
  groupPhotosByDate,
  findFileByName,
  getExifInfo,
  IMAGE_EXTENSIONS,
};
