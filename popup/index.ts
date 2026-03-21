import { DEFAULT_SETTINGS, SpeechSettings } from "../src/types/index";

const voiceSelect = document.getElementById(
  "voice-select",
) as HTMLSelectElement;
const rateInput = document.getElementById("rate") as HTMLInputElement;
const pitchInput = document.getElementById("pitch") as HTMLInputElement;
const rateValue = document.getElementById("rate-value") as HTMLSpanElement;
const pitchValue = document.getElementById("pitch-value") as HTMLSpanElement;
const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;

chrome.storage.sync.get("settings", (result) => {
  const settings: SpeechSettings = {
    ...DEFAULT_SETTINGS,
    ...(result.settings || {}),
  };
  rateInput.value = String(settings.rate);
  pitchInput.value = String(settings.pitch);
  rateValue.textContent = String(settings.rate);
  pitchValue.textContent = String(settings.pitch);

  loadVoices(settings.voiceId);
});

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

rateInput.addEventListener("input", () => {
  rateValue.textContent = rateInput.value;
});

pitchInput.addEventListener("input", () => {
  pitchValue.textContent = pitchInput.value;
});

saveBtn.addEventListener("click", () => {
  const settings: SpeechSettings = {
    ...DEFAULT_SETTINGS,
    voiceId: voiceSelect.value,
    rate: parseFloat(rateInput.value),
    pitch: parseFloat(pitchInput.value),
  };

  chrome.storage.sync.set({ settings }, () => {
    saveBtn.textContent = "Saved ✓";
    setTimeout(() => (saveBtn.textContent = "Save settings"), 1500);
  });
});
