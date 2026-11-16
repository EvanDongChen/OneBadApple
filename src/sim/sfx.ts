import { useSim } from './store'
import type { FruitDef, FruitKind } from './types'

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

/** Each kind of fruit has its own voice: small fruits squeak, big ones rumble, sour ones buzz. */
const KIND_VOICE: Record<FruitKind, { pitch: number; wave: OscillatorType }> = {
  apple: { pitch: 300, wave: 'square' },
  orange: { pitch: 235, wave: 'square' },
  lemon: { pitch: 430, wave: 'sawtooth' },
  plum: { pitch: 340, wave: 'triangle' },
  pear: { pitch: 190, wave: 'triangle' },
  lime: { pitch: 480, wave: 'sawtooth' },
  peach: { pitch: 385, wave: 'sine' },
  blueberry: { pitch: 590, wave: 'triangle' },
  cherry: { pitch: 680, wave: 'square' },
  kiwi: { pitch: 265, wave: 'sawtooth' },
}
const WAVE_GAIN: Record<OscillatorType, number> = { square: 0.035, sawtooth: 0.03, triangle: 0.075, sine: 0.085, custom: 0.035 }

/**
 * Gibberish speech in the speaker's own voice. The kind of fruit sets the pitch and tone,
 * talkative fruits gabble faster, and aggressive ones swing further up and down.
 * `variant` nudges the pitch so two fruits of the same kind still sound different.
 */
export function babble(fruit: Pick<FruitDef, 'kind' | 'traits'>, variant: number, durationMs: number) {
  const { pitch, wave } = KIND_VOICE[fruit.kind]
  const base = pitch * (1 + (((variant * 7) % 5) - 2) * 0.035)
  const gap = 0.135 - fruit.traits.talkativeness * 0.07
  const swing = 0.12 + fruit.traits.aggression * 0.38
  const count = Math.min(40, Math.floor(durationMs / 1000 / gap))
  for (let i = 0; i < count; i++) {
    tone(base * (1 - swing / 2 + Math.random() * swing), i * gap, gap * 0.75, wave, WAVE_GAIN[wave])
  }
}

/** A sharp intake of breath from the whole village. */
export function gasp() {
  tone(280, 0, 0.22, 'triangle', 0.12, 720)
  tone(360, 0.04, 0.2, 'triangle', 0.08, 900)
}

export function cheer() {
  ;[523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.16, 'triangle', 0.09))
}

/** A sad trombone, more or less. */
export function sulk() {
  tone(233, 0, 0.3, 'sawtooth', 0.045, 220)
  tone(196, 0.3, 0.6, 'sawtooth', 0.045, 150)
}

/** A quick blade swish. */
export function slice() {
  tone(1800, 0, 0.16, 'sawtooth', 0.07, 300)
  tone(900, 0.03, 0.12, 'triangle', 0.05, 200)
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

/** Length of one beat of the party music, in milliseconds. The dancers hop in time with it. */
export const PARTY_BEAT_MS = 500
const PARTY_TUNE = [262, 330, 392, 523, 392, 330, 294, 392]
let partyTimer: number | undefined

/** Start the looping victory tune: a kick on every beat, a bouncy lead and an off-beat hat. */
export function startParty() {
  stopParty()
  let step = 0
  const bar = () => {
    tone(150, 0, 0.18, 'sine', 0.3, 45)
    tone(PARTY_TUNE[step % PARTY_TUNE.length], 0, 0.16, 'square', 0.045)
    tone(PARTY_TUNE[(step + 2) % PARTY_TUNE.length] * 2, 0.25, 0.1, 'triangle', 0.05)
    tone(6000, 0.25, 0.03, 'square', 0.015)
    step++
  }
  bar()
  partyTimer = window.setInterval(bar, PARTY_BEAT_MS)
}

export function stopParty() {
  if (partyTimer !== undefined) window.clearInterval(partyTimer)
  partyTimer = undefined
}

export function voteTick() {
  tone(880, 0, 0.08, 'triangle', 0.08)
}
