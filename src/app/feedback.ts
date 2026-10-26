/**
 * Gentle sensory cues: a soft synthesized chime (Web Audio — no audio files, nothing recorded),
 * a short vibration, and optional French speech. Every API is optional and fails silently.
 */
import type { SoundTimbre } from '../storage/preferences';

type AudioContextCtor = typeof AudioContext;
let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (context) return context;
  const Ctor: AudioContextCtor | undefined =
    typeof window !== 'undefined'
      ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext)
      : undefined;
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    context = null;
  }
  return context;
}

/** Must be called from a user gesture (Start button) so browsers allow sound. */
export function unlockAudio(): void {
  const ctx = getContext();
  if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
}

export function chime(timbre: SoundTimbre, volume: number, pitch: 'high' | 'low' = 'high'): void {
  const ctx = getContext();
  if (!ctx || volume <= 0 || ctx.state !== 'running') return;
  try {
    const base = timbre === 'bol' ? 196 : 523.25;
    const freq = pitch === 'high' ? base * 1.5 : base;
    const t = ctx.currentTime;
    const gain = ctx.createGain();
    const peak = Math.min(1, volume / 100) * 0.18;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + (timbre === 'bol' ? 2.4 : 1.2));
    gain.connect(ctx.destination);
    for (const ratio of timbre === 'bol' ? [1, 2.01, 2.76] : [1, 2]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * ratio;
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 2.5);
    }
  } catch {
    // Audio is a nicety; never break the session.
  }
}

export function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch {
    // ignore
  }
}

export function speak(text: string): void {
  try {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 0.9;
    synth.speak(utterance);
  } catch {
    // ignore
  }
}

export function stopSpeaking(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // ignore
  }
}

export function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}
