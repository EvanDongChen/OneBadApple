export type FruitKind = 'apple' | 'orange' | 'lemon' | 'plum' | 'pear' | 'lime'

export type Mood = 'paranoid' | 'cheerful' | 'grumpy' | 'sleepy'

export interface FruitDef {
  id: string
  name: string
  kind: FruitKind
  mood: Mood
  /** Where the fruit spawns. */
  home: [number, number]
  /** Where it stands during discussion. */
  seat: [number, number]
}

export interface SpeechLine {
  speakerId: string
  name: string
  text: string
}

export interface SpeakContext {
  speaker: FruitDef
  others: FruitDef[]
  history: SpeechLine[]
}

/** Anything that can produce a fruit's next line: canned text now, an LLM later. */
export interface Brain {
  speak(ctx: SpeakContext): Promise<string>
}
