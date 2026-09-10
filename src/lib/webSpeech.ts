type BrowserSpeechRecognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition

type WindowWithSpeech = Window & {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
}

export const DEFAULT_SPEECH_SILENCE_MS = 2500

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false
  const speechWindow = window as WindowWithSpeech
  return Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition)
}

function getSpeechRecognitionCtor(): BrowserSpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const speechWindow = window as WindowWithSpeech
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
}

export function pickSpanishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  const list = speechSynthesis.getVoices()
  return (
    list.find((voice) => voice.lang.toLowerCase().startsWith('es-ar')) ??
    list.find((voice) => voice.lang.toLowerCase().startsWith('es-')) ??
    list[0] ??
    null
  )
}

export function plainTextForSpeech(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*_`>~]/g, '')
    .replace(/\n+/g, '. ')
    .trim()
}

export function speakSpanishText(
  text: string,
  callbacks?: {
    onEnd?: () => void
  },
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const trimmed = text.trim()
  if (!trimmed) return

  speechSynthesis.getVoices()
  speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(trimmed)
  const voice = pickSpanishVoice()
  if (voice) utterance.voice = voice
  utterance.lang = voice?.lang ?? 'es-AR'
  utterance.rate = 1
  utterance.onend = () => callbacks?.onEnd?.()
  utterance.onerror = () => callbacks?.onEnd?.()
  speechSynthesis.speak(utterance)
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    speechSynthesis.cancel()
  }
}

export type SpeechRecognitionStartOptions = {
  /** Milisegundos de silencio antes de cortar (default 2500). 0 = sin corte automático. */
  silenceMs?: number
}

export type SpeechRecognitionController = {
  start: (options?: SpeechRecognitionStartOptions) => void
  stop: () => void
  isActive: () => boolean
}

export function createSpeechRecognitionHandlers(input: {
  onTranscript: (text: string, isFinal: boolean) => void
  onListeningChange: (listening: boolean) => void
  /** Se dispara cuando el dictado se detiene por silencio prolongado (no por stop manual). */
  onSilenceStop?: () => void
}): SpeechRecognitionController | null {
  const Ctor = getSpeechRecognitionCtor()
  if (!Ctor) return null

  const recognition = new Ctor()
  recognition.lang = 'es-AR'
  recognition.interimResults = true
  recognition.continuous = true

  let active = false
  let manualStop = false
  let stoppedBySilence = false
  let currentSilenceMs = DEFAULT_SPEECH_SILENCE_MS
  let silenceTimer: ReturnType<typeof setTimeout> | null = null

  function clearSilenceTimer() {
    if (silenceTimer) {
      clearTimeout(silenceTimer)
      silenceTimer = null
    }
  }

  function scheduleSilenceStop() {
    clearSilenceTimer()
    if (currentSilenceMs <= 0 || !active) return
    silenceTimer = setTimeout(() => {
      stoppedBySilence = true
      manualStop = true
      active = false
      recognition.stop()
    }, currentSilenceMs)
  }

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let text = ''
    for (let index = 0; index < event.results.length; index += 1) {
      text += event.results[index][0]?.transcript ?? ''
    }
    const isFinal = event.results[event.results.length - 1]?.isFinal ?? false
    input.onTranscript(text.trim(), isFinal)
    scheduleSilenceStop()
  }

  recognition.onerror = () => {
    clearSilenceTimer()
    active = false
    manualStop = true
    input.onListeningChange(false)
  }

  recognition.onend = () => {
    clearSilenceTimer()
    if (active && !manualStop) {
      try {
        recognition.start()
        scheduleSilenceStop()
      } catch {
        active = false
        input.onListeningChange(false)
      }
      return
    }

    const wasSilence = stoppedBySilence
    active = false
    stoppedBySilence = false
    input.onListeningChange(false)
    if (wasSilence) {
      input.onSilenceStop?.()
    }
  }

  return {
    start: (options?: SpeechRecognitionStartOptions) => {
      manualStop = false
      stoppedBySilence = false
      active = true
      currentSilenceMs = options?.silenceMs ?? DEFAULT_SPEECH_SILENCE_MS
      input.onListeningChange(true)
      try {
        recognition.start()
        scheduleSilenceStop()
      } catch {
        active = false
        input.onListeningChange(false)
      }
    },
    stop: () => {
      manualStop = true
      active = false
      clearSilenceTimer()
      recognition.stop()
    },
    isActive: () => active,
  }
}
