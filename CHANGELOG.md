# Changelog

All notable changes to Vocalix will be documented here.

---

## [Unreleased]

---

## [1.0.0] - 2026-03-22

### Added
- Highlight any text on a webpage → floating **▶ Read** button appears
- Right-click context menu — "Read aloud with Vocalix"
- Keyboard shortcuts — `Alt+R` to read, `Alt+S` to stop, `Alt+P` to pause/resume
- Web Speech API integration — reads selected text using browser-native voices
- Multi-button UI — **⏸ Pause** and **⏹ Stop** buttons while reading
- Animated waveform inside the pause button while playing
- Word highlight follow-along — each word highlights as it is spoken
- Popup UI with **Settings** and **History** tabs
- Voice switcher — pick from all available browser voices
- Speed, pitch and volume controls
- Auto-read on highlight toggle — reads immediately without clicking
- Highlight words toggle
- **🔁 Re-read last** button in popup
- History panel — logs last 50 reads with site and timestamp
- Options page — full settings with API key placeholders for AI voices
- Extension icons (16px, 48px, 128px)

### Fixed
- Prevented double/triple play with `isLoading` lock
- Fixed button container duplication on repeated selections
- Fixed voices not loading in popup dropdown
- Fixed popup height overflow — settings tab now scrollable
- Fixed context menu and keyboard shortcut connection errors via scripting re-injection

### Coming Soon
- ElevenLabs AI voices
- Google TTS voices
- Reading progress bar (requires AI voices for accurate duration)
- Chrome Web Store listing
