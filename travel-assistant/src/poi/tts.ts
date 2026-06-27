import { SpeechSynthesis } from '@capgo/capacitor-speech-synthesis'

let activeStartCallback: (() => void) | null = null;
let activeEndCallback: (() => void) | null = null;
let listenersInitialized = false;

/**
 * Initializes listeners for the native speech synthesis engine.
 */
function initListeners(): void {
  if (listenersInitialized) return;
  listenersInitialized = true;

  console.log("TTS: Initializing native event listeners for start, end, and error.");

  try {
    SpeechSynthesis.addListener('start', () => {
      console.log("TTS Native Event: 'start' fired.");
      if (activeStartCallback) {
        activeStartCallback();
      }
    });

    SpeechSynthesis.addListener('end', () => {
      console.log("TTS Native Event: 'end' fired.");
      triggerEnd();
    });

    SpeechSynthesis.addListener('error', (err) => {
      console.warn("TTS Native Event: 'error' fired. Details:", err);
      triggerEnd();
    });
  } catch (error) {
    console.error("TTS: Failed to add SpeechSynthesis event listeners:", error);
  }
}

function triggerEnd(): void {
  if (activeEndCallback) {
    const callback = activeEndCallback;
    activeEndCallback = null;
    activeStartCallback = null;
    callback();
  }
}

/**
 * Checks if the engine is currently speaking.
 */
export async function isSpeaking(): Promise<boolean> {
  try {
    const { value } = await SpeechSynthesis.isSpeaking();
    return value;
  } catch (e) {
    console.warn("TTS: isSpeaking check failed, falling back to false:", e);
    return false;
  }
}

/**
 * Stops any active speech synthesis and resets listeners.
 */
export function stop(): void {
  console.log("TTS: stop() called.");
  try {
    SpeechSynthesis.cancel();
  } catch (e) {
    console.error("TTS: stop() cancel call failed:", e);
  }
  
  triggerEnd();
}

/**
 * Speaks the provided text offline using @capgo/capacitor-speech-synthesis.
 * Automatically falls back to Web Speech Synthesis in desktop browsers.
 * 
 * @param text The text content to read.
 * @param onStart Callback fired when speech starts.
 * @param onEnd Callback fired when speech finishes, is cancelled, or errors out.
 */
export function speak(
  text: string,
  onStart: () => void,
  onEnd: () => void
): void {
  console.log("TTS: speak() called. Text length:", text.length, "Snippet:", text.substring(0, 60));
  
  // 1. Initialize listeners on first speak call
  initListeners();

  // 2. Stop any active speech first
  stop();

  // Clean up any extra whitespace or newlines for smoother reading
  const cleanText = text.replace(/\s+/g, " ").trim();
  if (!cleanText) {
    console.warn("TTS: speak() aborted because cleanText is empty.");
    onEnd();
    return;
  }

  activeStartCallback = onStart;
  activeEndCallback = onEnd;

  try {
    console.log("TTS: Invoking SpeechSynthesis.speak() for snippet:", cleanText.substring(0, 60) + "...");
    SpeechSynthesis.speak({
      text: cleanText,
      value: cleanText,
      language: 'en-US',
      rate: 0.95, // Slightly slower for better legibility
      pitch: 1.0,
      volume: 1.0
    }).then(() => {
      console.log("TTS: SpeechSynthesis.speak() promise resolved successfully.");
    }).catch(error => {
      console.error("TTS: SpeechSynthesis.speak() promise rejected:", error);
      if (activeEndCallback === onEnd) {
        triggerEnd();
      }
    });
  } catch (error) {
    console.error("TTS: Exception caught in speak():", error);
    if (activeEndCallback === onEnd) {
      triggerEnd();
    }
  }
}
