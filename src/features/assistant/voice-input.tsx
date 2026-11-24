"use client";

import { Mic, MicOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * "Type, speak or tap" (proposal, "Ask"). Uses the browser's own speech recognition where it
 * exists and shows nothing where it doesn't. What was heard only fills the ask box: the
 * person still taps Ask, so a misheard request is never sent on its own. Some browsers send
 * the audio to their maker's servers to recognise it; the privacy policy says so.
 */

type RecognitionResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionConstructor = new () => Recognition;

export function speechRecognitionConstructor(scope: unknown = typeof window === "undefined" ? undefined : window): RecognitionConstructor | null {
  const candidate = scope as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor } | undefined;
  return candidate?.SpeechRecognition ?? candidate?.webkitSpeechRecognition ?? null;
}

export function VoiceInputButton({ onText, onProblem, disabled }: { onText: (text: string) => void; onProblem?: (message: string | null) => void; disabled?: boolean }) {
  const [Constructor] = useState(() => speechRecognitionConstructor());
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  const onProblemRef = useRef(onProblem);

  useEffect(() => {
    onTextRef.current = onText;
    onProblemRef.current = onProblem;
  }, [onText, onProblem]);

  const setProblem = (message: string | null) => onProblemRef.current?.(message);

  useEffect(() => () => recognition.current?.abort(), []);

  if (!Constructor) return null;

  function start() {
    if (!Constructor) return;
    setProblem(null);
    const next = new Constructor();
    next.lang = "en-ZA";
    next.interimResults = true;
    next.continuous = false;
    next.maxAlternatives = 1;
    next.onresult = (event) => {
      const text = Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" ").trim();
      if (text) onTextRef.current(text.slice(0, 300));
    };
    next.onerror = (event) => {
      setProblem(event.error === "not-allowed" || event.error === "service-not-allowed" ? "Allow the microphone to speak a request." : event.error === "no-speech" ? "I didn't hear anything. Try again or type." : "Speaking isn't working right now. Type instead.");
    };
    next.onend = () => {
      setListening(false);
      recognition.current = null;
    };
    recognition.current = next;
    try {
      next.start();
      setListening(true);
    } catch {
      setProblem("Speaking isn't working right now. Type instead.");
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={listening}
        aria-label={listening ? "Stop listening" : "Speak your request"}
        onClick={() => (listening ? recognition.current?.stop() : start())}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
          listening && "bg-selection text-selection-foreground",
        )}
      >
        {listening ? <MicOff className="size-4" aria-hidden="true" /> : <Mic className="size-4" aria-hidden="true" />}
      </button>
      {listening ? <span role="status" className="sr-only">Listening</span> : null}
    </>
  );
}
