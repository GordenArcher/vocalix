# Vocalix

> Highlight anything. Hear everything.

A Chrome extension that reads selected text aloud using multiple voices — browser-native and AI-powered.

## Features

- Highlight any text → floating play button appears
- Right-click context menu support
- Keyboard shortcut (`Alt+R` to read, `Alt+S` to stop)
- Multiple voices (browser built-in + ElevenLabs / Google TTS)
- Word-by-word highlight follow-along
- Speed & pitch controls
- History of read text

## Getting Started

```bash
git clone https://github.com/GordenArcher/vocalix.git
cd vocalix
npm install
npm run build
```

Then load the `dist/` folder as an unpacked extension in `chrome://extensions`.

## Development

```bash
npm run dev   # watch mode — rebuilds on file change
```

## Stack

- TypeScript
- Vite + vite-plugin-web-extension
- Chrome Manifest V3
- Web Speech API
- ElevenLabs / Google TTS (optional, AI voices)

## Contributing

PRs welcome! See [CONTRIBUTING.md](.github/CONTRIBUTING.md).

## License

MIT © [GordenArcher](https://github.com/GordenArcher)
