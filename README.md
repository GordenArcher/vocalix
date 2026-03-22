# Vocalix

> Highlight anything. Hear everything.

A Chrome extension that reads selected text aloud using multiple voices — browser-native and AI-powered (coming soon).

---

## Install from GitHub (no store needed)

### 1. Clone the repo
```bash
git clone https://github.com/GordenArcher/vocalix.git
cd vocalix
```

### 2. Install dependencies
```bash
npm install
```

### 3. Build the extension
```bash
npm run build
```

### 4. Load in Chrome
1. Open Chrome and go to `chrome://extensions`
2. Toggle **Developer mode** on (top right corner)
3. Click **Load unpacked**
4. Select the `dist/` folder inside the project

Vocalix is now installed and ready to use.

### 5. Set keyboard shortcuts (optional)
1. Go to `chrome://extensions/shortcuts`
2. Find Vocalix and set:
   - `Alt+R` — Read selected text
   - `Alt+S` — Stop reading
   - `Alt+P` — Pause / Resume

---

## How to Use

1. Go to any webpage
2. Highlight any text
3. Click the **▶ Read** button that appears
4. Use **⏸ Pause** and **⏹ Stop** to control playback
5. Click the extension icon to change voice, speed, pitch and volume

---

## Features

-  Floating read button on any text selection
-  Pause, resume and stop controls
-  Word-by-word highlight as it reads
-  Multiple voices + speed, pitch & volume control
-  Keyboard shortcuts
-  Right-click context menu support
-  Reading history — click any entry to re-read
-  Re-read last button
-  Auto-read, minimum selection length and more

---

## Development

```bash
npm run dev   # watch mode — rebuilds on every file change
npm run build # production build
```

After each build, click the refresh icon on the Vocalix card in `chrome://extensions`.

---

## Project Structure

```
vocalix/
├── src/
│   ├── background/     # service worker — context menu, shortcuts
│   ├── content/        # injected into pages — button, TTS, highlights
│   ├── types/          # shared TypeScript types
│   └── utils/          # storage helpers
├── popup/              # toolbar popup — voice switcher, history
├── options/            # full settings page
└── public/icons/       # extension icons
```

---

## Stack

- TypeScript
- Vite + vite-plugin-web-extension
- Chrome Manifest V3
- Web Speech API

---

## Roadmap

- [ ] ElevenLabs AI voices
- [ ] Google TTS voices
- [ ] Reading progress bar
- [ ] Dark / light theme toggle
- [ ] Chrome Web Store listing

---

## Contributing

PRs welcome! See [CONTRIBUTING.md](.github/CONTRIBUTING.md).

---

## License

MIT © [GordenArcher](https://github.com/GordenArcher)
