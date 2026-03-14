# QuickLook - Photo Screening Tool for Photographers

A local web tool that helps photographers quickly filter photos and batch-copy them to a target directory.

[中文](README.zh.md)

## Features

- Open a directory and display all photos grouped by date
- Single-image preview mode: full-screen view, space to select/deselect, arrow keys to switch
- Display EXIF parameters (aperture, shutter speed, ISO, focal length, etc.)
- Image preloading and thumbnail caching
- Batch copy selected photos to a target directory

## Installation

One-line install (clones from GitHub, auto-detects environment, uses Bun/pnpm/yarn):

```bash
curl -fsSL https://raw.githubusercontent.com/Luckyji6/QuickLook/main/install.sh | bash
```

Then add to PATH if prompted:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Or clone and run manually:

```bash
git clone https://github.com/Luckyji6/QuickLook.git
cd QuickLook
bun install   # or: pnpm install / yarn / npm install
node server.js /path/to/photos
```

## Update

```bash
curl -fsSL https://raw.githubusercontent.com/Luckyji6/QuickLook/main/update.sh | bash
```

## Uninstall

```bash
curl -fsSL https://raw.githubusercontent.com/Luckyji6/QuickLook/main/uninstall.sh | bash
```

## Usage

```bash
# Start with photo directory (recommended)
quicklook /path/to/your/photos

# Or
npx quicklook /path/to/your/photos

# Start without directory, then select or enter path in the web UI
quicklook
```

The browser will open automatically at http://localhost:3847

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Select / deselect current photo |
| → | Next photo |
| ← | Previous photo |
| Esc | Exit preview |

## Supported Image Formats

JPG, JPEG, PNG, HEIC, HEIF, WebP, TIFF, GIF, BMP

## License

MIT
