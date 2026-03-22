import { DEFAULT_SETTINGS, SpeechSettings } from "../src/types/index";

/**
 * Options page elements - this is the full settings page, separate from the popup
 * I keep this more comprehensive than the popup since users can access it from extensions page
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
const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
const savedMsg = document.getElementById("saved-msg") as HTMLParagraphElement;

/**
 * Load saved settings from sync storage on page load
 * I merge with defaults so any new settings added in future updates don't break existing installs
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

  loadVoices(settings.voiceId);
});

/**
 * Populate voice dropdown with available system voices
 * Voices aren't always immediately available, so I listen for onvoiceschanged
 * If that doesn't fire, the recursive call ensures it eventually loads
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
 * Live preview of rate and pitch values while sliders move
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
 * I show a temporary success message that fades out after 2 seconds
 * No need to reload voices since changes take effect on next reading
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
  };

  chrome.storage.sync.set({ settings }, () => {
    savedMsg.classList.remove("hidden");
    setTimeout(() => savedMsg.classList.add("hidden"), 2000);
  });
});
