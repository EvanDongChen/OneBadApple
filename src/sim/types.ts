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
  'banana',
  'strawberry',
  'watermelon',
] as const
export type FruitKind = (typeof FRUIT_KINDS)[number]

export type Role = 'werewolf' | 'villager' | 'seer' | 'doctor' | 'hunter' | 'jester'

export type Phase = 'setup' | 'night' | 'dawn' | 'talk' | 'vote' | 'over'

export type Winner = 'village' | 'werewolves' | 'jester'

/** Personality sliders, each 0..1, plus up to three quirks. */
export interface Traits {
  aggression: number
  honesty: number
  talkativeness: number
  suspicion: number
  /** Each is a preset's id (see quirks.ts) or, for one the user wrote, the text itself. */
  quirks: string[]
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
  /** `ghost` is a dead fruit's thought, which no living fruit can hear. */
  kind: 'say' | 'system' | 'vote' | 'ghost'
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
  /** With two or more werewolves: what they whisper to each other before they strike. */
  wolfChat?: { id: string; say: string }[]
  /** Each living fruit's updated inner state. */
  minds: { id: string; thought: string; feelings: { about: string; trust: number; note: string }[] }[]
}

/** A few fruits talking among themselves. Only the members hear it. */
export interface Conversation {
  members: string[]
  /** `accuses` is the id of the fruit the line points the finger at, when the brain knows it. */
  lines: { id: string; say: string; accuses?: string }[]
}

/** A short burst of body language: a gasp, a nervous shake, a cheer, a sulk or a puzzled look. */
export type Reaction = 'gasp' | 'shake' | 'cheer' | 'sulk' | 'puzzle'

/** One entry in the end-of-game recap. Fruits are referred to by id. */
export type RecapEvent =
  | { kind: 'kill'; day: number; wolf: string; victim: string }
  | { kind: 'saved'; day: number; wolf: string; victim: string; doctor: string }
  | { kind: 'inspect'; day: number; seer: string; target: string; wolf: boolean }
  | { kind: 'shot'; day: number; hunter: string; target: string }
  | { kind: 'vote'; day: number; ballots: { voter: string; target: string }[]; out: string | null; tied: string[] }
  /** A fruit's trust in another crossed into clear trust or clear distrust overnight. */
  | { kind: 'turn'; day: number; who: string; about: string; from: number; to: number; note: string }

/** Everything that happens in one day, decided in a single batch. */
export interface DayScript {
  /** Each round splits the living fruits into small groups that talk at the same time. */
  rounds: Conversation[][]
  /** One vote per living fruit. `lastWords` is what it cries out if it is the one voted out. */
  votes: { id: string; target: string; reason: string; lastWords?: string }[]
}

/**
 * The decision-maker for the whole village. The engine enforces the rules; the brain chooses.
 * Both methods must return a complete, legal script (implementations fall back rather than throw).
 */
export interface Brain {
  playNight(world: WorldView): Promise<NightScript>
  playDay(world: WorldView): Promise<DayScript>
}
