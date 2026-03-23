import { DEFAULT_SETTINGS, SpeechSettings } from "../src/types/index";

/**
 * Options page - full settings interface for Vocalix
 * This page provides all configuration options including voice selection,
 * speech parameters, and the new wake word feature for hands-free control
 */

const voiceSelect = document.getElementById(
  "voice-select",
) as HTMLSelectElement;
const rateInput = document.getElementById("rate") as HTMLInputElement;
const pitchInput = document.getElementById("pitch") as HTMLInputElement;
const rateValue = document.getElementById("rate-value") as HTMLSpanElement;
const pitchValue = document.getElementById("pitch-value") as HTMLSpanElement;
const autoRead = document.getElementById("auto-read") as HTMLInputElement;
const highlightWords = document.getElementById(
  "highlight-words",
) as HTMLInputElement;
const minLengthInput = document.getElementById(
  "min-length",
) as HTMLInputElement;
const wakeWordEnabled = document.getElementById(
  "wake-word-enabled",
) as HTMLInputElement;
const wakeWordInput = document.getElementById("wake-word") as HTMLInputElement;
const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
const savedMsg = document.getElementById("saved-msg") as HTMLParagraphElement;

/**
 * Load saved settings from sync storage when page opens
 * I merge with defaults to handle any missing settings gracefully
 */
chrome.storage.sync.get("settings", (result) => {
  const settings: SpeechSettings = {
    ...DEFAULT_SETTINGS,
    ...(result.settings || {}),
  };

  rateInput.value = String(settings.rate);
  pitchInput.value = String(settings.pitch);
  rateValue.textContent = String(settings.rate);
  pitchValue.textContent = String(settings.pitch);
  autoRead.checked = settings.autoRead;
  highlightWords.checked = settings.highlightWords;
  minLengthInput.value = String(settings.minLength ?? 2);
  wakeWordEnabled.checked = settings.wakeWordEnabled ?? false;
  wakeWordInput.value = settings.wakeWord ?? "hey vocalix";

  loadVoices(settings.voiceId);
});

/**
 * Populate voice dropdown with available system voices
 * Voices aren't always ready immediately, so I listen for onvoiceschanged
 */
function loadVoices(savedVoiceId: string = ""): void {
  const voices = window.speechSynthesis.getVoices();

  if (voices.length === 0) {
    window.speechSynthesis.onvoiceschanged = () => loadVoices(savedVoiceId);
    return;
  }

  voiceSelect.innerHTML = "";
  voices.forEach((voice) => {
    const option = document.createElement("option");
    option.value = voice.voiceURI;
    option.textContent = `${voice.name} (${voice.lang})`;
    if (voice.voiceURI === savedVoiceId) option.selected = true;
    voiceSelect.appendChild(option);
  });
}

/**
 * Live preview of rate and pitch values as sliders move
 * Gives immediate feedback without needing to save first
 */
rateInput.addEventListener("input", () => {
  rateValue.textContent = rateInput.value;
});
pitchInput.addEventListener("input", () => {
  pitchValue.textContent = pitchInput.value;
});

/**
 * Save all settings to Chrome sync storage
 * I show a temporary success message that fades after 2 seconds
 * The wake word is normalized to lowercase for case-insensitive matching
 */
saveBtn.addEventListener("click", () => {
  const settings: SpeechSettings = {
    ...DEFAULT_SETTINGS,
    voiceId: voiceSelect.value,
    rate: parseFloat(rateInput.value),
    pitch: parseFloat(pitchInput.value),
    autoRead: autoRead.checked,
    highlightWords: highlightWords.checked,
    minLength: parseInt(minLengthInput.value) || 2,
    wakeWordEnabled: wakeWordEnabled.checked,
    wakeWord: wakeWordInput.value.trim().toLowerCase() || "hey vocalix",
  };

  chrome.storage.sync.set({ settings }, () => {
    savedMsg.classList.remove("hidden");
    setTimeout(() => savedMsg.classList.add("hidden"), 2000);
  });
});
