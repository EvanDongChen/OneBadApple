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

export type Role = 'werewolf' | 'villager' | 'seer' | 'doctor'

export type Phase = 'setup' | 'night' | 'dawn' | 'mingle' | 'discussion' | 'vote' | 'over'

/** Personality sliders, each 0..1, plus a free-text quirk. */
export interface Traits {
  aggression: number
  honesty: number
  talkativeness: number
  suspicion: number
  quirk: string
}

export const TRAIT_KEYS = ['aggression', 'honesty', 'talkativeness', 'suspicion'] as const

/** What the user edits on the setup screen. */
export interface FruitDef {
  id: string
  name: string
  kind: FruitKind
  traits: Traits
}

/** A fruit in a running game. */
export interface FruitState extends FruitDef {
  role: Role
  alive: boolean
  /** Spot in front of its hut. */
  home: [number, number]
  /** Spot at the campfire circle. */
  seat: [number, number]
  /** Private notes only this fruit knows; fed to its brain. */
  memory: string[]
}

export interface LogEntry {
  kind: 'say' | 'whisper' | 'system' | 'vote'
  name?: string
  text: string
}

/** Everything one fruit is allowed to know when making a decision. */
export interface AgentView {
  self: FruitState
  day: number
  /** Living fruits other than self. */
  others: { id: string; name: string }[]
  /** Recent public events and speech, oldest first. */
  publicLog: string[]
}

export interface DayPlan {
  /** Who to walk over to this morning. */
  approach: string
  /** What to say to them privately. */
  line: string
}

export interface Speech {
  say: string
}

export interface Choice {
  target: string
  reason: string
}

/**
 * A fruit's decision-maker. The engine enforces the rules; the brain chooses.
 * Every method must return a valid result (implementations fall back rather than throw).
 */
export interface Brain {
  planDay(view: AgentView): Promise<DayPlan>
  speak(view: AgentView): Promise<Speech>
  vote(view: AgentView): Promise<Choice>
  /** Werewolf: who to kill. Seer: who to inspect. Doctor: who to protect (may include self). */
  nightAction(view: AgentView, candidates: { id: string; name: string }[]): Promise<Choice>
}
