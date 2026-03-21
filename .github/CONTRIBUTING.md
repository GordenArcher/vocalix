# Contributing to Vocalix

Thanks for taking the time to contribute! Here's everything you need to get started.

---

## Getting Started

1. Fork the repo
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/vocalix.git
   cd vocalix
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the dev build:
   ```bash
   npm run dev
   ```
5. Load the `dist/` folder as an unpacked extension in `chrome://extensions`

---

## Project Structure

```
vocalix/
├── src/
│   ├── background/     # service worker — context menu, keyboard shortcuts
│   ├── content/        # injected into pages — floating button, TTS, highlights
│   ├── types/          # shared TypeScript types
│   └── utils/          # storage helpers
├── popup/              # toolbar popup UI — voice switcher, history tab
├── options/            # full settings page
└── public/icons/       # extension icons (16, 48, 128px)
```

---

## How to Contribute

### Reporting a bug
- Open an issue and include:
  - What you expected to happen
  - What actually happened
  - Steps to reproduce
  - Chrome version and OS

### Suggesting a feature
- Open an issue with the `enhancement` label
- Describe the use case, not just the feature

### Submitting a PR
1. Create a branch from `main`:
   ```bash
   git checkout -b feat/your-feature
   # or
   git checkout -b fix/your-bug
   ```
2. Make your changes
3. Build and test in Chrome:
   ```bash
   npm run build
   ```
4. Commit with a clear message:
   ```bash
   git commit -m "feat: add pause and resume support"
   ```
5. Push and open a PR against `main`

---

## Commit Message Format

Use conventional commits:

| Prefix | When to use |
|--------|-------------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `chore:` | Config, deps, tooling |
| `docs:` | README, comments |
| `style:` | CSS/UI changes only |
| `refactor:` | Code change, no behaviour change |

---

## Guidelines

- One PR per feature or fix — keep it focused
- Don't break existing features
- Keep code style consistent with the rest of the codebase (TypeScript strict mode)
- Test on at least one real website before submitting

---

## Roadmap

Looking for something to work on? Check the open issues or pick from the roadmap:

- [ ] ElevenLabs AI voices integration
- [ ] Google TTS integration
- [ ] Pause / resume support
- [ ] Fix history panel storage bug
- [ ] Chrome Web Store listing
- [ ] Dark / light popup theme toggle

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](../LICENSE).
