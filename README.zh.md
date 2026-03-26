```
 ____  _     _  ____ _  __   _     ____  ____  _  __
/  _ \/ \ /\/ \/   _Y |/ /  / \   /  _ \/  _ \/ |/ /
| / \|| | ||| ||  / |   /   | |   | / \|| / \||   /
| \_\|| \_/|| ||  \_|   \   | |_/\| \_/|| \_/||   \
\____\\____/\_/\____|_|\_\  \____/\____/\____/\_|\_\
```

本地网页工具，帮助摄影师快速筛选照片和视频，并将选中的内容批量复制到目标目录。

[English](README.md)

## 功能

- 打开指定目录，按日期分组展示所有图片和视频
- 混合媒体全屏预览：支持键盘切换、快速选中/取消
- 视频支持流式加载，已缓冲的部分可立即播放
- 在视频预览中按住 `Enter` 可 3 倍速快进
- 图片可显示 EXIF 摄影参数（光圈、快门、ISO、焦距等）
- 图片预加载与缩略图缓存
- 批量复制选中的内容到目标目录

## 安装

**统一一键安装（所有平台同一条命令）：**

```bash
curl -fsSL https://raw.githubusercontent.com/Luckyji6/QuickLook/main/install.sh | bash
```

- **macOS / Linux：** 直接运行 shell 安装脚本。若提示，请将 `export PATH="$HOME/.local/bin:$PATH"` 加入 PATH。
- **Windows（Git Bash / MSYS）：** 会自动识别 Windows 并执行 `install.ps1`。

**仅用 Windows PowerShell 时**（没有 Git Bash 时）可单独执行：

```powershell
irm https://raw.githubusercontent.com/Luckyji6/QuickLook/main/install.ps1 | iex
```

安装后重启终端以使 `quicklook` 生效。

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
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/Luckyji6/QuickLook/main/update.sh | bash
```
```powershell
# Windows
irm https://raw.githubusercontent.com/Luckyji6/QuickLook/main/update.ps1 | iex
```

## 卸载

**macOS / Linux：**

```bash
curl -fsSL https://raw.githubusercontent.com/Luckyji6/QuickLook/main/uninstall.sh | bash
```

**Windows（PowerShell）：**

```powershell
irm https://raw.githubusercontent.com/Luckyji6/QuickLook/main/uninstall.ps1 | iex
```

## 使用

```bash
# 指定媒体目录启动（推荐）
quicklook /path/to/your/media

# 或
npx quicklook /path/to/your/media

# 不指定目录启动，在网页中选择或输入路径
quicklook
```

启动后会自动打开浏览器，访问 http://localhost:3847

## 快捷键

| 按键 | 功能 |
|------|------|
| 空格 | 选中/取消选中当前项 |
| 按住 `Enter` | 视频预览时 3 倍速快进 |
| → | 下一项 |
| ← | 上一项 |
| Esc | 退出预览 |

## 支持的格式

图片：JPG、JPEG、PNG、HEIC、HEIF、WebP、TIFF、GIF、BMP

视频：MP4、MOV、M4V、WebM、OGV、OGG

## License

MIT
