# QuickLook - 摄影师筛片工具

本地网页工具，帮助摄影师快速筛选照片并批量复制到目标目录。

[English](README.md)

## 功能

- 打开指定目录，按日期分组展示所有照片
- 单图预览模式：全屏查看，空格选中/取消，左右箭头切换
- 显示 EXIF 摄影参数（光圈、快门、ISO、焦距等）
- 图片预加载与缩略图缓存
- 批量复制选中的照片到目标目录

## 安装

一键安装（从 GitHub 克隆，自动检测环境，使用 Bun/pnpm/yarn）：

```bash
curl -fsSL https://raw.githubusercontent.com/Luckyji6/QuickLook/main/install.sh | bash
```

若提示，请将以下内容加入 PATH：

```bash
export PATH="$HOME/.local/bin:$PATH"
```

或手动克隆并运行：

```bash
git clone https://github.com/Luckyji6/QuickLook.git
cd QuickLook
bun install   # 或: pnpm install / yarn / npm install
node server.js /path/to/photos
```

## 更新

每次运行 `quicklook` 时会**自动检查并升级**，有新版本时静默更新。

手动更新：

```bash
curl -fsSL https://raw.githubusercontent.com/Luckyji6/QuickLook/main/update.sh | bash
```

## 卸载

```bash
curl -fsSL https://raw.githubusercontent.com/Luckyji6/QuickLook/main/uninstall.sh | bash
```

## 使用

```bash
# 指定照片目录启动（推荐）
quicklook /path/to/your/photos

# 或
npx quicklook /path/to/your/photos

# 不指定目录启动，在网页中选择或输入路径
quicklook
```

启动后会自动打开浏览器，访问 http://localhost:3847

## 快捷键

| 按键 | 功能 |
|------|------|
| 空格 | 选中/取消选中当前照片 |
| → | 下一张 |
| ← | 上一张 |
| Esc | 退出预览 |

## 支持的图片格式

JPG、JPEG、PNG、HEIC、HEIF、WebP、TIFF、GIF、BMP

## License

MIT
