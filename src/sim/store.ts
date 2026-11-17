import { create } from 'zustand'
import { Vector3 } from 'three'
import { BACKSTORIES } from './dialog'
import { QUIRK_PRESETS } from './quirks'
import { FRUIT_KINDS } from './types'
import type { FruitDef, FruitKind, FruitState, LogEntry, Phase, Reaction, RecapEvent, Rules, Traits, Winner } from './types'

export const MIN_FRUITS = 4
export const MAX_FRUITS = 10
const HOME_RING = 10.4
const SEAT_RING = 3.8

const NAMES = [
  'Pip', 'Clem', 'Zest', 'Dusk', 'Bosc', 'Key', 'Fuzz', 'Indigo', 'Bing', 'Tang', 'Mango', 'Fig',
  'Juju', 'Pomelo', 'Quince', 'Rind', 'Nectar', 'Pith', 'Sorbet', 'Jam', 'Peel', 'Mellow', 'Tart', 'Squash',
]
export interface Settings {
  brain: 'test' | 'gemini'
  apiKey: string
  model: string
  requestsPerMinute: number
  maxCalls: number
  muted: boolean
  rules: Rules
}

const SETTINGS_KEY = 'onebadapple.settings'

const DEFAULT_RULES: Rules = { wolves: 1, seer: true, doctor: true, hunter: false, jester: false, rounds: 2 }

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
    rules: DEFAULT_RULES,
  }
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null')
    if (!saved) return defaults
    return { ...defaults, ...saved, apiKey: saved.apiKey || devKey, rules: { ...DEFAULT_RULES, ...saved.rules } }
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

/** Most wolves a village of this size can hold while still being outnumbered at the start. */
export function maxWolves(fruitCount: number) {
  return Math.max(1, Math.floor((fruitCount - 1) / 2))
}

function randomTraits(): Traits {
  const r = () => Math.round(Math.random() * 10) / 10
  // One quirk, sometimes two.
  const presets = [...QUIRK_PRESETS].sort(() => Math.random() - 0.5)
  return {
    aggression: r(),
    honesty: r(),
    talkativeness: r(),
    suspicion: r(),
    quirks: presets.slice(0, Math.random() < 0.3 ? 2 : 1).map((p) => p.id),
    backstory: BACKSTORIES[Math.floor(Math.random() * BACKSTORIES.length)],
  }
}

let nextId = 1

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

/** A new random villager: a name and a kind of fruit nobody in the roster has yet, if any are left. */
function makeFruit(roster: FruitDef[]): FruitDef {
  const names = NAMES.filter((n) => !roster.some((f) => f.name === n))
  const kinds = FRUIT_KINDS.filter((k) => !roster.some((f) => f.kind === k))
  return {
    id: `f${nextId++}`,
    name: names.length ? pick(names) : `Fruit ${roster.length + 1}`,
    kind: pick(kinds.length ? kinds : FRUIT_KINDS),
    traits: randomTraits(),
  }
}

function makeRoster(count: number): FruitDef[] {
  const roster: FruitDef[] = []
  for (let i = 0; i < count; i++) roster.push(makeFruit(roster))
  return roster
}

function ring(i: number, n: number, radius: number): [number, number] {
  const angle = (i / n) * Math.PI * 2
  return [Math.cos(angle) * radius, Math.sin(angle) * radius]
}

/** Place each fruit's home spot and meeting-circle seat around the stage. */
export function layout(roster: FruitDef[]): FruitState[] {
  return roster.map((def, i) => ({
    ...def,
    role: 'villager',
    alive: true,
    home: ring(i, roster.length, HOME_RING),
    seat: ring(i, roster.length, SEAT_RING),
    persona: '',
    memory: [],
    heard: [],
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
  winner: Winner | null
  /** Where each fruit is walking to. */
  targets: Record<string, [number, number]>
  /** Fruits currently chasing another fruit instead of a fixed target. */
  follow: Record<string, string | undefined>
  /** Who each fruit turns to face while standing: its conversation partner. */
  lookAt: Record<string, string | undefined>
  speech: Record<string, string | undefined>
  thinking: Record<string, boolean | undefined>
  /** The night attack in progress: the wolf carries a knife, and lunges when `striking`. */
  attack: { attackerId: string; victimId: string; striking: boolean } | null
  /** Fruits that died by the knife and fall apart in slices (others are flung whole). */
  chopped: Record<string, boolean | undefined>
  /** The winners' dance party: when it started (for keeping time) and who is dancing. */
  party: { at: number; dancers: string[] } | null
  /** The vote being carried out: one voter draws a gun on the condemned fruit, and `firing` is the shot. */
  execution: { shooterId: string; targetId: string; firing: boolean } | null
  /** The doctor's protection for the night: a bubble around one fruit. `hit` is the knife bouncing off it. */
  shield: { id: string; hit: boolean } | null
  /** Fruits that survived an attack and wear a plaster for the rest of the game. */
  bandaged: Record<string, boolean | undefined>
  /** Juice left on the floor where a fruit was chopped or shot. */
  splats: { x: number; z: number; kind: FruitKind; size: number; seed: number }[]
  /** Comic sound words ("CHOP!") bursting over the stage right now. */
  bursts: { key: number; text: string; at: [number, number, number] }[]
  /** What each ghost is thinking right now, shown over its head. */
  ghostThoughts: Record<string, string | undefined>
  /** Body language each fruit is showing right now. */
  reactions: Record<string, Reaction | undefined>
  /** Everything worth retelling once the game is over. */
  recap: RecapEvent[]
  /** Who everyone turns to look at when they have no partner. */
  focusId: string | null
  /** Ballots cast so far this vote: voter id to target id. */
  votes: Record<string, string>
  log: LogEntry[]
  paused: boolean
  speed: number
  revealRoles: boolean
  /** Show every fruit's private thought floating over its head. */
  showThoughts: boolean
  calls: number
  settings: Settings

  updateFruit(id: string, patch: Partial<Omit<FruitDef, 'traits'>> & { traits?: Partial<Traits> }): void
  addFruit(): void
  removeFruit(id: string): void
  randomizeRoster(): void
  setSettings(patch: Partial<Settings>): void
  setRules(patch: Partial<Rules>): void
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
    lookAt: {},
    speech: {},
    thinking: {},
    attack: null,
    party: null,
    execution: null,
    shield: null,
    bandaged: {},
    splats: [],
    bursts: [],
    ghostThoughts: {},
    reactions: {},
    chopped: {},
    focusId: null,
    votes: {},
    paused: false,
  }
}

export const useSim = create<SimState>((set, get) => ({
  ...setupState(initialRoster),
  log: [],
  recap: [],
  speed: 1,
  revealRoles: false,
  showThoughts: false,
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
        : setupState([...s.roster, makeFruit(s.roster)]),
    ),
  removeFruit: (id) =>
    set((s) => (s.roster.length <= MIN_FRUITS ? s : setupState(s.roster.filter((f) => f.id !== id)))),
  randomizeRoster: () => set((s) => setupState(makeRoster(s.roster.length))),
  setSettings: (patch) => {
    const settings = { ...get().settings, ...patch }
    saveSettings(settings)
    set({ settings })
  },
  setRules: (patch) => get().setSettings({ rules: { ...get().settings.rules, ...patch } }),
  addLog: (entry) => set((s) => ({ log: [...s.log, entry].slice(-300) })),
  backToSetup: () => set((s) => ({ ...setupState(s.roster), revealRoles: false })),
}))

/** How fast each fruit is moving along the ground right now. Lets fruits notice someone hurrying past. */
export const fruitSpeeds = new Map<string, number>()

/** Live world positions, written by each Fruit every frame. Kept out of React state. */
export const fruitPositions = new Map<string, Vector3>()

// Dev builds expose the store on the window, so the game can be poked at from the console.
if (import.meta.env.DEV) Object.assign(window, { __sim: { useSim, fruitPositions } })
