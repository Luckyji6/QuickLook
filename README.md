# QuickLook - Photo Screening Tool for Photographers

A local web tool that helps photographers quickly filter photos and batch-copy them to a target directory.

## Features

- Open a directory and display all photos grouped by date
- Single-image preview mode: full-screen view, space to select/deselect, arrow keys to switch
- Display EXIF parameters (aperture, shutter speed, ISO, focal length, etc.)
- Image preloading and thumbnail caching
- Batch copy selected photos to a target directory

## Installation

```bash
npm install -g quicklook-photo
```

Or run directly with npx:

```bash
npx quicklook-photo /path/to/photos
```

## Usage

```bash
# Start with photo directory (recommended)
quicklook-photo /path/to/your/photos

# Or
npx quicklook-photo /path/to/your/photos

# Start without directory, then select or enter path in the web UI
quicklook-photo
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
