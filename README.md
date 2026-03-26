```
 ____  _     _  ____ _  __   _     ____  ____  _  __
/  _ \/ \ /\/ \/   _Y |/ /  / \   /  _ \/  _ \/ |/ /
| / \|| | ||| ||  / |   /   | |   | / \|| / \||   /
| \_\|| \_/|| ||  \_|   \   | |_/\| \_/|| \_/||   \
\____\\____/\_/\____|_|\_\  \____/\____/\____/\_|\_\
```

A local web tool that helps photographers quickly filter photos and videos and batch-copy selected items to a target directory.

[中文](README.zh.md)

## Features

- Open a directory and display photos and videos grouped by date
- Full-screen preview for mixed media, with keyboard navigation and quick selection
- Videos support streamed playback so buffered parts can play immediately
- Hold `Enter` in video preview for 3x fast-forward
- Display EXIF parameters for photos (aperture, shutter speed, ISO, focal length, etc.)
- Image preloading and thumbnail caching
- Batch copy selected items to a target directory

## Installation

**One-line install (all platforms):**

```bash
curl -fsSL https://raw.githubusercontent.com/Luckyji6/QuickLook/main/install.sh | bash
```

- **macOS / Linux:** runs the shell installer. If prompted, add to PATH: `export PATH="$HOME/.local/bin:$PATH"`.
- **Windows (Git Bash / MSYS):** detects Windows and runs `install.ps1` automatically.

**Windows (PowerShell only):** if you use PowerShell and don’t have Git Bash, run:

```powershell
irm https://raw.githubusercontent.com/Luckyji6/QuickLook/main/install.ps1 | iex
```

Restart the terminal so `quicklook` is on PATH.

Or clone and run manually:

```bash
git clone https://github.com/Luckyji6/QuickLook.git
cd QuickLook
bun install   # or: pnpm install / yarn / npm install
node server.js /path/to/photos
```

## Update

QuickLook **auto-updates on startup** when you run `quicklook` — it checks for new versions and upgrades silently if available.

Manual update:

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/Luckyji6/QuickLook/main/update.sh | bash
```
```powershell
# Windows
irm https://raw.githubusercontent.com/Luckyji6/QuickLook/main/update.ps1 | iex
```

## Uninstall

**macOS / Linux:**

```bash
curl -fsSL https://raw.githubusercontent.com/Luckyji6/QuickLook/main/uninstall.sh | bash
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/Luckyji6/QuickLook/main/uninstall.ps1 | iex
```

## Usage

```bash
# Start with media directory (recommended)
quicklook /path/to/your/media

# Or
npx quicklook /path/to/your/media

# Start without directory, then select or enter path in the web UI
quicklook
```

The browser will open automatically at http://localhost:3847

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Select / deselect current item |
| Hold `Enter` | 3x fast-forward in video preview |
| → | Next item |
| ← | Previous item |
| Esc | Exit preview |

## Supported Formats

Images: JPG, JPEG, PNG, HEIC, HEIF, WebP, TIFF, GIF, BMP

Videos: MP4, MOV, M4V, WebM, OGV, OGG

## License

MIT
