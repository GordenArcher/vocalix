# Vocalix

> Highlight anything. Hear everything.

A Chrome extension that reads selected text aloud using multiple voices, browser-native and AI-powered (coming soon).

---

## Features

-  **Floating button** — highlight text, a play button appears instantly
-  **Right-click** — "Read aloud with Vocalix" in the context menu
-  **Keyboard shortcuts** — `Alt+R` to read, `Alt+S` to stop
-  **Multiple voices** — pick from all browser-native voices
-  **Speed & pitch controls** — adjust from the popup
-  **Word highlight follow-along** — each word highlights as it's spoken
-  **Options page** — auto-read toggle, default voice, and more
-  **History** — log of everything you've read

---

## Installation

### From source

```bash
git clone https://github.com/GordenArcher/vocalix.git
cd vocalix
npm install
npm run build
```

Then:
1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `dist/` folder

### Keyboard shortcuts

After installing, go to `chrome://extensions/shortcuts` and set:
- `Alt+R` — Read selected text
- `Alt+S` — Stop reading

---

## Development

```bash
npm run dev    # watch mode, rebuilds on every file change
npm run build  # production build
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
- [ ] Pause / resume support
- [ ] Reading speed presets
- [ ] Chrome Web Store listing

---

## Contributing

PRs welcome! Please keep each PR focused on one feature or fix.

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature`
3. Make your changes and build: `npm run build`
4. Test in Chrome
5. Open a PR with a clear description

---

## License

MIT © [GordenArcher](https://github.com/GordenArcher)
