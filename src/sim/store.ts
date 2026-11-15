import { create } from 'zustand'
import { Vector3 } from 'three'
import type { FruitDef, FruitKind, Mood, SpeechLine } from './types'

const ROSTER: { name: string; kind: FruitKind; mood: Mood }[] = [
  { name: 'Pip', kind: 'apple', mood: 'paranoid' },
  { name: 'Clem', kind: 'orange', mood: 'cheerful' },
  { name: 'Zest', kind: 'lemon', mood: 'grumpy' },
  { name: 'Dusk', kind: 'plum', mood: 'sleepy' },
  { name: 'Bosc', kind: 'pear', mood: 'cheerful' },
  { name: 'Key', kind: 'lime', mood: 'paranoid' },
]

const HOME_RING = 10
const SEAT_RING = 3.6

function ring(i: number, n: number, radius: number): [number, number] {
  const angle = (i / n) * Math.PI * 2
  return [Math.cos(angle) * radius, Math.sin(angle) * radius]
}

const fruits: FruitDef[] = ROSTER.map((r, i) => ({
  ...r,
  id: r.name.toLowerCase(),
  home: ring(i + 0.5, ROSTER.length, HOME_RING),
  seat: ring(i, ROSTER.length, SEAT_RING),
}))

interface SimState {
  fruits: FruitDef[]
  speech: SpeechLine | null
  log: SpeechLine[]
  paused: boolean
  say(line: SpeechLine): void
  clearSpeech(): void
  togglePaused(): void
}

export const useSim = create<SimState>((set) => ({
  fruits,
  speech: null,
  log: [],
  paused: false,
  say: (line) => set((s) => ({ speech: line, log: [...s.log, line].slice(-50) })),
  clearSpeech: () => set({ speech: null }),
  togglePaused: () => set((s) => ({ paused: !s.paused })),
}))

/** Live world positions, written by each Fruit every frame. Kept out of React state. */
export const fruitPositions = new Map<string, Vector3>()
