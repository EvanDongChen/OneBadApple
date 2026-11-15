import { create } from 'zustand'
import { Vector3 } from 'three'
import { FRUIT_KINDS } from './types'
import type { FruitDef, FruitState, LogEntry, Phase, Traits } from './types'

export const MIN_FRUITS = 4
export const MAX_FRUITS = 10
export const HUT_RING = 13.5
const HOME_RING = 10.4
const SEAT_RING = 3.8

const NAMES = ['Pip', 'Clem', 'Zest', 'Dusk', 'Bosc', 'Key', 'Fuzz', 'Indigo', 'Bing', 'Tang', 'Mango', 'Fig']
const QUIRKS = [
  'Ends sentences with a nervous laugh.',
  'Convinced it is the smartest fruit in the village.',
  'Speaks like a tired old sailor.',
  'Extremely polite, even when accusing someone.',
  'Easily distracted by snacks and naps.',
  'Dramatic. Everything is the end of the world.',
  'Suspicious of anyone who is too nice.',
  'Loves gossip more than the truth.',
]

export interface Settings {
  brain: 'test' | 'gemini'
  apiKey: string
  model: string
  requestsPerMinute: number
  maxCalls: number
  muted: boolean
}

const SETTINGS_KEY = 'onebadapple.settings'

function loadSettings(): Settings {
  // The dev key from .env.local is only read in dev builds; production users paste their own.
  const devKey: string = import.meta.env.DEV ? (import.meta.env.VITE_GEMINI_API_KEY ?? '') : ''
  const defaults: Settings = {
    brain: devKey ? 'gemini' : 'test',
    apiKey: devKey,
    model: 'gemini-flash-lite-latest',
    requestsPerMinute: 15,
    maxCalls: 80,
    muted: false,
  }
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null')
    return saved ? { ...defaults, ...saved, apiKey: saved.apiKey || devKey } : defaults
  } catch {
    return defaults
  }
}

function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Storage can be unavailable (private windows); the settings just won't persist.
  }
}

function randomTraits(): Traits {
  const r = () => Math.round(Math.random() * 10) / 10
  return {
    aggression: r(),
    honesty: r(),
    talkativeness: r(),
    suspicion: r(),
    quirk: QUIRKS[Math.floor(Math.random() * QUIRKS.length)],
  }
}

let nextId = 1

function makeFruit(index: number, taken: string[]): FruitDef {
  const name = NAMES.find((n) => !taken.includes(n)) ?? `Fruit ${index + 1}`
  return { id: `f${nextId++}`, name, kind: FRUIT_KINDS[index % FRUIT_KINDS.length], traits: randomTraits() }
}

function makeRoster(count: number): FruitDef[] {
  const roster: FruitDef[] = []
  for (let i = 0; i < count; i++) roster.push(makeFruit(i, roster.map((f) => f.name)))
  return roster
}

function ring(i: number, n: number, radius: number): [number, number] {
  const angle = (i / n) * Math.PI * 2
  return [Math.cos(angle) * radius, Math.sin(angle) * radius]
}

/** Place each fruit's home (by its hut) and campfire seat around the village. */
export function layout(roster: FruitDef[]): FruitState[] {
  return roster.map((def, i) => ({
    ...def,
    role: 'villager',
    alive: true,
    home: ring(i, roster.length, HOME_RING),
    seat: ring(i, roster.length, SEAT_RING),
    persona: '',
    memory: [],
    thought: '',
    feelings: {},
  }))
}

function seats(fruits: FruitState[]): Record<string, [number, number]> {
  return Object.fromEntries(fruits.map((f) => [f.id, f.seat]))
}

export interface SimState {
  screen: 'setup' | 'game'
  roster: FruitDef[]
  fruits: FruitState[]
  phase: Phase
  day: number
  winner: 'village' | 'werewolves' | null
  /** Where each fruit is walking to. */
  targets: Record<string, [number, number]>
  /** Fruits currently chasing another fruit instead of a fixed target. */
  follow: Record<string, string | undefined>
  speech: Record<string, string | undefined>
  thinking: Record<string, boolean | undefined>
  /** Who everyone turns to look at. */
  focusId: string | null
  votes: Record<string, string>
  log: LogEntry[]
  paused: boolean
  speed: number
  revealRoles: boolean
  calls: number
  settings: Settings

  updateFruit(id: string, patch: Partial<Omit<FruitDef, 'traits'>> & { traits?: Partial<Traits> }): void
  addFruit(): void
  removeFruit(id: string): void
  randomizeRoster(): void
  setSettings(patch: Partial<Settings>): void
  addLog(entry: LogEntry): void
  backToSetup(): void
}

const initialRoster = makeRoster(6)

function setupState(roster: FruitDef[]) {
  const fruits = layout(roster)
  return {
    screen: 'setup' as const,
    roster,
    fruits,
    phase: 'setup' as Phase,
    day: 0,
    winner: null,
    targets: seats(fruits),
    follow: {},
    speech: {},
    thinking: {},
    focusId: null,
    votes: {},
    paused: false,
  }
}

export const useSim = create<SimState>((set, get) => ({
  ...setupState(initialRoster),
  log: [],
  speed: 1,
  revealRoles: false,
  calls: 0,
  settings: loadSettings(),

  updateFruit: (id, patch) =>
    set((s) =>
      setupState(
        s.roster.map((f) => (f.id === id ? { ...f, ...patch, traits: { ...f.traits, ...patch.traits } } : f)),
      ),
    ),
  addFruit: () =>
    set((s) =>
      s.roster.length >= MAX_FRUITS
        ? s
        : setupState([...s.roster, makeFruit(s.roster.length, s.roster.map((f) => f.name))]),
    ),
  removeFruit: (id) =>
    set((s) => (s.roster.length <= MIN_FRUITS ? s : setupState(s.roster.filter((f) => f.id !== id)))),
  randomizeRoster: () => set((s) => setupState(makeRoster(s.roster.length))),
  setSettings: (patch) => {
    const settings = { ...get().settings, ...patch }
    saveSettings(settings)
    set({ settings })
  },
  addLog: (entry) => set((s) => ({ log: [...s.log, entry].slice(-200) })),
  backToSetup: () => set((s) => ({ ...setupState(s.roster), revealRoles: false })),
}))

/** Live world positions, written by each Fruit every frame. Kept out of React state. */
export const fruitPositions = new Map<string, Vector3>()
