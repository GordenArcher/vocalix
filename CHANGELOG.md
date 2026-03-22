# Changelog

All notable changes to Vocalix will be documented here.

---

## [Unreleased]

---

## [1.1.0] - 2026-03-22

### Added
- Animated waveform inside the pause button while playing
- **Re-read last** button in popup — re-reads the last text you listened to
- Clicking a history item in the popup re-reads it directly
- Delete individual history items with ✕ button
- Minimum selection length setting — set how many characters are needed before the Read button appears
- Toast notification — "No text selected" shown when shortcut is pressed with no selection
- Button stays visible after reading finishes if text is still selected

### Fixed
- Double/triple play bug — added `isLoading` lock to prevent multiple simultaneous reads
- Button container duplication on repeated selections
- Voices showing "Loading..." in popup — added retry fallback for async voice loading
- Popup height overflow — settings tab is now scrollable
- History tab was leaking settings styles
- Pause button showing **▶ Read** instead of **▶ Resume** + **⏹ Stop** — guarded `onend` from firing when paused
- Play button not working after shortcut reading ends — added `lastText` fallback
- Duplicate volume slider in popup settings
- `isLoading` now released on stop, end, and error

---

## [1.0.0] - 2026-03-22

### Added
- Highlight any text on a webpage → floating **▶ Read** button appears
- Right-click context menu — "Read aloud with Vocalix"
- Keyboard shortcuts — `Alt+R` to read, `Alt+S` to stop, `Alt+P` to pause/resume
- Web Speech API integration — reads selected text using browser-native voices
- Multi-button UI — **⏸ Pause** and **⏹ Stop** buttons while reading
- Word highlight follow-along — each word highlights as it is spoken
- Popup UI with **Settings** and **History** tabs
- Voice switcher — pick from all available browser voices
- Speed, pitch and volume controls
- Auto-read on highlight toggle
- Highlight words toggle
- History panel — logs last 50 reads with site and timestamp
- Options page — full settings page
- Extension icons (16px, 48px, 128px)

### Fixed
- Context menu and keyboard shortcut connection errors via scripting re-injection

### Coming Soon
- ElevenLabs AI voices
- Google TTS voices
- Reading progress bar
- Dark / light theme toggle
- Chrome Web Store listing
