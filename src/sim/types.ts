export const FRUIT_KINDS = [
  'apple',
  'orange',
  'lemon',
  'plum',
  'pear',
  'lime',
  'peach',
  'blueberry',
  'cherry',
  'kiwi',
] as const
export type FruitKind = (typeof FRUIT_KINDS)[number]

export type Role = 'werewolf' | 'villager' | 'seer' | 'doctor' | 'hunter' | 'jester'

export type Phase = 'setup' | 'night' | 'dawn' | 'talk' | 'vote' | 'over'

export type Winner = 'village' | 'werewolves' | 'jester'

/** Personality sliders, each 0..1, plus a free-text quirk. */
export interface Traits {
  aggression: number
  honesty: number
  talkativeness: number
  suspicion: number
  quirk: string
}

export const TRAIT_KEYS = ['aggression', 'honesty', 'talkativeness', 'suspicion'] as const

/** Game options chosen on the setup screen. */
export interface Rules {
  wolves: number
  seer: boolean
  doctor: boolean
  /** Takes one fruit down with it when it dies. */
  hunter: boolean
  /** Wins alone if the village votes it out. */
  jester: boolean
  /** How many rounds of small conversations happen each day before the vote. */
  rounds: number
}

/** What the user edits on the setup screen. */
export interface FruitDef {
  id: string
  name: string
  kind: FruitKind
  traits: Traits
}

/** How one fruit feels about another. */
export interface Feeling {
  /** -5 (sure they are a wolf) to +5 (would trust with its life). */
  trust: number
  /** Short reason, in the fruit's own words. */
  note: string
}

/** A fruit in a running game. */
export interface FruitState extends FruitDef {
  role: Role
  alive: boolean
  /** Its own spot at the edge of the stage. */
  home: [number, number]
  /** Its spot at the meeting circle, used for the vote. */
  seat: [number, number]
  /** Character sheet, written once at game start and reused in every prompt. */
  persona: string
  /** Private facts only this fruit knows (role info, night results). */
  memory: string[]
  /** Recent lines from conversations this fruit was part of, oldest first. */
  heard: string[]
  /** What it is privately thinking right now. Rewritten every night. */
  thought: string
  /** How it feels about each other fruit, keyed by their id. Rewritten every night. */
  feelings: Record<string, Feeling>
}

export interface LogEntry {
  kind: 'say' | 'system' | 'vote'
  name?: string
  /** Who a conversation line was said to. */
  to?: string
  text: string
}

/** The whole world, handed to a brain for one batched decision. */
export interface WorldView {
  day: number
  rules: Rules
  /** Every fruit, living and dead. */
  fruits: FruitState[]
  /** Recent events everyone knows (deaths, votes), oldest first. Conversations are not public. */
  publicLog: string[]
}

/** Everything that happens in one night, decided in a single batch. */
export interface NightScript {
  /** Who the werewolves attack. */
  kill: string
  /** Who the doctor guards, if there is a doctor. */
  protect: string | null
  /** Who the seer inspects, if there is a seer. */
  inspect: string | null
  /** Who the hunter will take down with it if it dies before the next night. */
  revenge: string | null
  /** Each living fruit's updated inner state. */
  minds: { id: string; thought: string; feelings: { about: string; trust: number; note: string }[] }[]
}

/** A few fruits talking among themselves. Only the members hear it. */
export interface Conversation {
  members: string[]
  lines: { id: string; say: string }[]
}

/** Everything that happens in one day, decided in a single batch. */
export interface DayScript {
  /** Each round splits the living fruits into small groups that talk at the same time. */
  rounds: Conversation[][]
  /** One vote per living fruit. */
  votes: { id: string; target: string; reason: string }[]
}

/**
 * The decision-maker for the whole village. The engine enforces the rules; the brain chooses.
 * Both methods must return a complete, legal script (implementations fall back rather than throw).
 */
export interface Brain {
  playNight(world: WorldView): Promise<NightScript>
  playDay(world: WorldView): Promise<DayScript>
}
