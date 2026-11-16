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

/** Voice pitch for each kind of fruit: small fruits squeak, big ones rumble. */
const KIND_PITCH: Record<FruitKind, number> = {
  apple: 290,
  orange: 235,
  lemon: 350,
  plum: 310,
  pear: 195,
  lime: 375,
  peach: 330,
  blueberry: 420,
  cherry: 460,
  kiwi: 260,
}

/** Mouth shapes: the two resonances that make a buzz sound like "ah", "eh", "ee", "oh" or "oo". */
const VOWELS: Record<string, [number, number]> = {
  a: [850, 1300],
  e: [550, 1900],
  i: [330, 2400],
  o: [520, 950],
  u: [360, 800],
}
const VOWEL_KEYS = Object.keys(VOWELS)

/** How many fruits are speaking right now. */
let talking = 0

/** One spoken syllable: a buzz shaped by a vowel's two resonances, with a quick fade in and out. */
function syllable(pitch: number, start: number, length: number, vowel: [number, number], gain: number, pan: number) {
  if (!ctx || useSim.getState().settings.muted) return
  const t = ctx.currentTime + start
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(pitch * 1.05, t)
  osc.frequency.exponentialRampToValueAtTime(pitch * 0.95, t + length)
  amp.gain.setValueAtTime(0.0001, t)
  amp.gain.linearRampToValueAtTime(gain, t + 0.008)
  amp.gain.setValueAtTime(gain, t + length * 0.55)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + length)
  for (const frequency of vowel) {
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = frequency
    filter.Q.value = 5
    osc.connect(filter).connect(amp)
  }
  const panner = ctx.createStereoPanner()
  panner.pan.value = pan
  amp.connect(panner).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + length + 0.02)
}

/**
 * Speech as a rapid string of tiny syllables, one per letter of the line, so the gibberish
 * follows the rhythm of the words: vowels sound like themselves, consonants are shorter and
 * quieter, spaces and punctuation are pauses, and a question rises at the end.
 * The kind of fruit sets the pitch, talkative fruits gabble faster, and aggressive ones swing
 * further up and down. `variant` nudges the pitch so two fruits of the same kind differ.
 */
export function babble(fruit: Pick<FruitDef, 'kind' | 'traits'>, variant: number, text: string, durationMs: number) {
  // Several conversations run at once. Only the first voice is heard clearly; anyone who
  // starts while it is still going is a murmur in the background, and a third is silent.
  const others = talking
  talking++
  window.setTimeout(() => talking--, durationMs)
  if (others >= 2) return
  const volume = others ? 0.22 : 1
  // Spread the voices across the speakers so they are easier to tell apart.
  const pan = ((variant % 5) - 2) * 0.3
  const base = KIND_PITCH[fruit.kind] * (1 + (((variant * 7) % 5) - 2) * 0.04)
  const letters = text.toLowerCase().slice(0, 90)
  // Finish a little before the bubble closes, however fast the game is running.
  const gap = Math.min(0.078 - fruit.traits.talkativeness * 0.026, (durationMs / 1000) * 0.85 / Math.max(1, letters.length))
  const swing = 0.035 + fruit.traits.aggression * 0.05
  const question = text.trim().endsWith('?')
  for (let i = 0; i < letters.length; i++) {
    const letter = letters[i]
    if (letter < 'a' || letter > 'z') continue
    const code = letter.charCodeAt(0)
    const isVowel = letter in VOWELS
    const vowel = VOWELS[isVowel ? letter : VOWEL_KEYS[code % VOWEL_KEYS.length]]
    // Each letter always lands on the same note, which is what makes it sound like words.
    const lift = question && i > letters.length - 8 ? 1 + (i - letters.length + 8) * 0.03 : 1
    const pitch = base * (1 + ((code % 7) - 3) * swing) * lift
    syllable(pitch, i * gap, gap * (isVowel ? 1.5 : 1.1), vowel, (isVowel ? 0.3 : 0.2) * volume, pan)
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
