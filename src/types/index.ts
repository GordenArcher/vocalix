export interface HistoryEntry {
  id: string;
  text: string;
  url: string;
  timestamp: number;
}

export interface SpeechSettings {
  voiceId: string;
  rate: number;
  pitch: number;
  volume: number;
  autoRead: boolean;
  highlightWords: boolean;
  source: "browser" | "elevenlabs" | "google";
  elevenLabsApiKey?: string;
  googleApiKey?: string;
}

export type MessageType =
  | "READ_TEXT"
  | "STOP"
  | "PAUSE"
  | "RESUME"
  | "SPEECH_STATE";

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}

export const DEFAULT_SETTINGS: SpeechSettings = {
  voiceId: "",
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  autoRead: false,
  highlightWords: true,
  source: "browser",
};
