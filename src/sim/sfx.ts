import { useSim } from './store'

// Tiny synthesised sound effects; no audio files.
let ctx: AudioContext | null = null

/** Must be called from a user gesture (the Start button) before any sound plays. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    void ctx.resume()
  } catch {
    ctx = null
  }
}

function tone(freq: number, start: number, duration: number, type: OscillatorType, gain: number, endFreq = freq) {
  if (!ctx || useSim.getState().settings.muted) return
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  const t = ctx.currentTime + start
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration)
  amp.gain.setValueAtTime(gain, t)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  osc.connect(amp).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + duration + 0.02)
}

/** Gibberish speech: a run of short blips at a pitch unique to the speaker. */
export function babble(voice: number, durationMs: number) {
  const base = 260 + (voice % 10) * 45
  const count = Math.min(24, Math.floor(durationMs / 95))
  for (let i = 0; i < count; i++) {
    tone(base * (0.9 + Math.random() * 0.35), i * 0.095, 0.07, 'square', 0.035)
  }
}

export function thud() {
  tone(140, 0, 0.35, 'sine', 0.4, 35)
}

export function nightChime() {
  tone(330, 0, 0.9, 'sine', 0.12)
  tone(247, 0.25, 1.1, 'sine', 0.12)
}

export function dawnChime() {
  tone(392, 0, 0.5, 'triangle', 0.12)
  tone(523, 0.18, 0.5, 'triangle', 0.12)
  tone(659, 0.36, 0.8, 'triangle', 0.12)
}

export function voteTick() {
  tone(880, 0, 0.08, 'triangle', 0.08)
}
