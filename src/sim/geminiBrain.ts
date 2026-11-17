import { MockBrain } from './mockBrain'
import type { Brain, Conversation, DayScript, FruitState, NightScript, Role, WorldView } from './types'

const API = 'https://generativelanguage.googleapis.com/v1beta'
const REQUEST_TIMEOUT_MS = 60000
const MAX_ATTEMPTS = 2

export interface GeminiOptions {
  apiKey: string
  model: string
  /** Calls are spaced out to stay under this. */
  requestsPerMinute: number
  /** After this many calls the brain falls back to the no-AI rules. */
  maxCalls: number
  signal: AbortSignal
  /** Called after every request so the UI can show usage. */
  onCall(count: number): void
  /** Called once per distinct problem so the UI can surface it. */
  onProblem(message: string): void
}

export async function listGeminiModels(apiKey: string): Promise<string[]> {
  const res = await fetch(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': apiKey } })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
  return (json.models as { name: string; supportedGenerationMethods?: string[] }[])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace('models/', ''))
    .filter((n) => n.startsWith('gemini') && !/tts|image|transcribe|computer|robotics|omni/.test(n))
}

const ROLE_BRIEF: Record<Role, string> = {
  werewolf: 'WEREWOLF. Kills a fruit each night. By day it blends in, deflects suspicion and gets innocents voted out. It never admits what it is.',
  villager: 'VILLAGER. No powers. Wants to find the werewolves and vote them out.',
  seer: 'SEER. Each night learns whether one fruit is a werewolf. Wants to use that, but revealing itself makes it a target.',
  doctor: 'DOCTOR. Each night protects one fruit from being killed. Revealing itself makes it a target.',
  hunter: 'HUNTER. On the village side. When it dies, by night or by vote, it takes one fruit of its choice down with it.',
  jester: 'JESTER. On nobody\'s side. It wins alone, and the game ends, if the village votes it out, so it tries to seem suspicious without being obvious about wanting it. Being killed at night is a loss for it.',
}

/** A fruit's character sheet. Written once at game start and stored on the fruit. */
export function buildPersona(fruit: Pick<FruitState, 'name' | 'kind' | 'role' | 'traits'>): string {
  const t = fruit.traits
  const level = (n: number) => `${Math.round(n * 10)}/10`
  return [
    `${fruit.name} is a little ${fruit.kind} with legs.`,
    `Role: ${ROLE_BRIEF[fruit.role]}`,
    `Personality: aggression ${level(t.aggression)}, honesty ${level(t.honesty)}, talkativeness ${level(t.talkativeness)}, suspicion of others ${level(t.suspicion)}.`,
    t.quirk ? `Quirk: ${t.quirk}` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

/** Static for the whole game, so it is sent as an identical prefix on every call. */
function systemPrompt(world: WorldView): string {
  return [
    'You are the game master and voice actor for a village of fruits playing Werewolf (Mafia) for real. You play EVERY fruit, each strictly from its own point of view.',
    'Rules: the village wins when every werewolf is dead; the werewolves win when they are at least half of the living fruits. Each night the werewolves kill one fruit, the doctor protects one, the seer inspects one. Each day the fruits talk in small private groups, then everyone votes one fruit out in public.',
    'Secrecy is the whole game. A fruit only knows the PUBLIC log, its own PRIVATE section and the conversations it was in. Never let a fruit act on, hint at or repeat anything it could not know. News travels only when a fruit chooses to pass it on, and it may be passed on wrongly or as a lie. Villagers do not know who the werewolf is and should sometimes be wrong.',
    'Each fruit\'s personality must drive both what it decides and how it talks: aggressive fruits attack and hold grudges, dishonest ones lie and invent claims, suspicious ones accuse on thin evidence, talkative ones say more. Use each quirk. The odd fruit pun is welcome.',
    'Anything said out loud is one or two short sentences, at most 25 words.',
    'Refer to fruits by name exactly as written. Reply with JSON matching the schema and nothing else.',
    'THE CAST (permanent character sheets):',
    ...world.fruits.map((f) => `- ${f.persona}`),
  ].join('\n')
}

/** The changing part of the prompt: who is alive, what each fruit privately knows and feels, what happened. */
function worldState(world: WorldView): string {
  const living = world.fruits.filter((f) => f.alive)
  const dead = world.fruits.filter((f) => !f.alive)
  const nameOf = (id: string) => world.fruits.find((f) => f.id === id)?.name ?? id
  const privateSection = (f: FruitState) => {
    const feelings = Object.entries(f.feelings)
      .filter(([id]) => living.some((o) => o.id === id))
      .map(([id, feel]) => `${nameOf(id)} ${feel.trust > 0 ? '+' : ''}${feel.trust}${feel.note ? ` (${feel.note})` : ''}`)
    return [
      `### ${f.name} (${f.role}) PRIVATE`,
      f.memory.length ? `Knows: ${f.memory.join(' | ')}` : 'Knows: nothing special.',
      f.thought ? `Current thought: ${f.thought}` : '',
      feelings.length ? `Trust in others (-5 to +5): ${feelings.join(', ')}` : '',
      f.heard.length ? `Conversations it was in (oldest first):\n${f.heard.slice(-18).join('\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }
  return [
    `DAY ${world.day}.`,
    `Living: ${living.map((f) => f.name).join(', ')}.${dead.length ? ` Dead: ${dead.map((f) => `${f.name} (was ${f.role})`).join(', ')}.` : ''}`,
    'PUBLIC log (oldest first):',
    world.publicLog.length ? world.publicLog.join('\n') : '(nothing yet)',
    ...living.map(privateSection),
  ].join('\n\n')
}

const STR = { type: 'STRING' }
const obj = (properties: Record<string, unknown>) => ({ type: 'OBJECT', properties, required: Object.keys(properties) })
const list = (items: unknown) => ({ type: 'ARRAY', items })

const NIGHT_SCHEMA = obj({
  kill: STR,
  protect: STR,
  inspect: STR,
  revenge: STR,
  wolfChat: list(obj({ name: STR, say: STR })),
  minds: list(obj({ name: STR, thought: STR, feelings: list(obj({ about: STR, trust: { type: 'INTEGER' }, note: STR })) })),
})

const DAY_SCHEMA = obj({
  rounds: list(obj({ groups: list(obj({ members: list(STR), lines: list(obj({ name: STR, say: STR })) })) })),
  votes: list(obj({ name: STR, target: STR, reason: STR, lastWords: STR })),
})

type Json = Record<string, unknown>

/**
 * The whole village's decisions come from Gemini, two batched calls per game day:
 * one for the night (actions plus every fruit's updated thoughts and feelings) and
 * one for the day (every small conversation in every round, then every vote).
 * Anything missing or illegal in a reply is filled in by the no-AI rules.
 */
export class GeminiBrain implements Brain {
  private fallback = new MockBrain()
  private calls = 0
  private lastCallAt = 0
  private reported = new Set<string>()
  private opts: GeminiOptions

  constructor(opts: GeminiOptions) {
    this.opts = opts
  }

  private problem(message: string) {
    if (this.reported.has(message)) return
    this.reported.add(message)
    this.opts.onProblem(message)
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve, reject) => {
      const { signal } = this.opts
      if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'))
      const timer = setTimeout(resolve, ms)
      signal.addEventListener('abort', () => (clearTimeout(timer), reject(new DOMException('Aborted', 'AbortError'))), { once: true })
    })
  }

  /** Returns the parsed reply, or null on any failure. */
  private async ask(world: WorldView, task: string, schema: unknown): Promise<Json | null> {
    if (this.calls >= this.opts.maxCalls) {
      this.problem(`Hit the cap of ${this.opts.maxCalls} Gemini calls. The fruits are running on the no-AI rules from here.`)
      return null
    }
    const gap = 60000 / this.opts.requestsPerMinute - (Date.now() - this.lastCallAt)
    if (gap > 0) await this.sleep(gap)

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      this.lastCallAt = Date.now()
      this.opts.onCall(++this.calls)
      try {
        const res = await fetch(`${API}/models/${this.opts.model}:generateContent`, {
          method: 'POST',
          headers: { 'x-goog-api-key': this.opts.apiKey, 'content-type': 'application/json' },
          signal: AbortSignal.any([this.opts.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt(world) }] },
            contents: [{ role: 'user', parts: [{ text: `${worldState(world)}\n\n${task}` }] }],
            generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 1 },
          }),
        })
        if (res.status === 429 || res.status >= 500) {
          if (attempt === MAX_ATTEMPTS) {
            this.problem(`Gemini is rate-limiting or unavailable (HTTP ${res.status}). Using the no-AI rules for that turn.`)
            return null
          }
          await this.sleep(5000)
          continue
        }
        const json = await res.json()
        if (!res.ok) {
          this.problem(`Gemini error: ${json?.error?.message ?? `HTTP ${res.status}`}`)
          return null
        }
        const text: string | undefined = json?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text
        const parsed = text ? JSON.parse(text) : null
        if (parsed && typeof parsed === 'object') return parsed
        throw new Error('empty or malformed reply')
      } catch (err) {
        if (this.opts.signal.aborted) throw err
        if (attempt === MAX_ATTEMPTS) {
          this.problem(`Gemini request failed (${err instanceof Error ? err.message : String(err)}). Using the no-AI rules for that turn.`)
          return null
        }
      }
    }
    return null
  }

  /** Match a name (or id) from the reply to one of the allowed fruits. */
  private resolve(value: unknown, options: FruitState[]): string | null {
    if (typeof value !== 'string') return null
    const key = value.trim().toLowerCase()
    return options.find((o) => o.name.toLowerCase() === key || o.id.toLowerCase() === key)?.id ?? null
  }

  private text(value: unknown, max = 240): string {
    return typeof value === 'string' ? value.trim().slice(0, max) : ''
  }

  private rows(value: unknown): Json[] {
    return Array.isArray(value) ? value.filter((v): v is Json => !!v && typeof v === 'object') : []
  }

  async playNight(world: WorldView): Promise<NightScript> {
    const living = world.fruits.filter((f) => f.alive)
    const backup = await this.fallback.playNight(world)
    const doctor = living.find((f) => f.role === 'doctor')
    const seer = living.find((f) => f.role === 'seer')
    const hunter = living.find((f) => f.role === 'hunter')
    const prey = living.filter((f) => f.role !== 'werewolf')
    const wolves = living.filter((f) => f.role === 'werewolf')

    const out = await this.ask(
      world,
      [
        `It is the night of day ${world.day}. Decide the night, each choice made only from that fruit's own knowledge:`,
        `- "kill": the werewolves' victim. Options: ${prey.map((f) => f.name).join(', ')}.`,
        doctor ? `- "protect": who ${doctor.name} (doctor) guards; may be itself.` : '- "protect": "" (there is no doctor).',
        seer ? `- "inspect": who ${seer.name} (seer) inspects; not itself, ideally someone not inspected before.` : '- "inspect": "" (there is no seer).',
        hunter ? `- "revenge": who ${hunter.name} (hunter) will take down with it if it dies before the next night; not itself.` : '- "revenge": "" (there is no hunter).',
        wolves.length > 1
          ? `- "wolfChat": before they strike, the werewolves (${wolves.map((f) => f.name).join(', ')}) whisper together about who to kill: 3 or 4 short lines, each in its speaker's own voice, in which they may disagree, ending with them settled on the fruit named in "kill". Nobody else hears this.`
          : '- "wolfChat": [] (there is only one werewolf).',
        '- "minds": for EVERY living fruit, its updated inner state after everything so far: "thought" is one private sentence (max 20 words) in its own voice about what it plans or fears; "feelings" has one entry for EVERY other living fruit with "trust" from -5 (certain they are a werewolf) to +5 (total trust) and a "note" of at most 8 words giving the reason. Base feelings on what that fruit has actually seen and heard, coloured by its personality.',
      ].join('\n'),
      NIGHT_SCHEMA,
    )
    if (!out) return backup

    const minds = this.rows(out.minds).flatMap((row) => {
      const id = this.resolve(row.name, living)
      if (!id) return []
      const feelings = this.rows(row.feelings).flatMap((f) => {
        const about = this.resolve(f.about, living)
        const trust = Number(f.trust)
        if (!about || about === id || !Number.isFinite(trust)) return []
        return [{ about, trust: Math.max(-5, Math.min(5, Math.round(trust))), note: this.text(f.note, 80) }]
      })
      return [{ id, thought: this.text(row.thought, 200), feelings }]
    })

    const kill = this.resolve(out.kill, prey)
    const chat = this.rows(out.wolfChat).flatMap((row) => {
      const id = this.resolve(row.name, wolves)
      const say = this.text(row.say)
      return id && say ? [{ id, say }] : []
    })

    return {
      kill: kill ?? backup.kill,
      // The rule-based whispers name the rule-based victim, so they only fit if that victim is used.
      wolfChat: wolves.length > 1 ? (kill && chat.length >= 2 ? chat.slice(0, 5) : kill ? undefined : backup.wolfChat) : undefined,
      protect: doctor ? (this.resolve(out.protect, living) ?? backup.protect) : null,
      inspect: seer ? (this.resolve(out.inspect, living.filter((f) => f.id !== seer.id)) ?? backup.inspect) : null,
      revenge: hunter ? (this.resolve(out.revenge, living.filter((f) => f.id !== hunter.id)) ?? backup.revenge) : null,
      // Any fruit Gemini skipped keeps the rule-based mind.
      minds: living.map((f) => minds.find((m) => m.id === f.id && m.feelings.length) ?? backup.minds.find((m) => m.id === f.id)!),
    }
  }

  /**
   * Make one round legal: every living fruit in exactly one group, every group has
   * at least two members and two lines. Returns null if nothing usable is left.
   */
  private repairRound(row: Json, living: FruitState[]): Conversation[] | null {
    const placed = new Set<string>()
    const groups: Conversation[] = []
    for (const group of this.rows(row.groups)) {
      const members = (Array.isArray(group.members) ? group.members : [])
        .map((m) => this.resolve(m, living))
        .filter((id): id is string => !!id && !placed.has(id))
        .filter((id, i, all) => all.indexOf(id) === i)
      const lines = this.rows(group.lines).flatMap((line) => {
        const id = this.resolve(line.name, living)
        const say = this.text(line.say)
        return id && members.includes(id) && say ? [{ id, say }] : []
      })
      if (members.length < 2 || lines.length < 2) continue
      members.forEach((id) => placed.add(id))
      groups.push({ members, lines: lines.slice(0, 8) })
    }
    if (!groups.length) return null
    // Anyone left out stands with the smallest group and listens.
    for (const fruit of living) {
      if (!placed.has(fruit.id)) groups.reduce((a, b) => (b.members.length < a.members.length ? b : a)).members.push(fruit.id)
    }
    return groups
  }

  async playDay(world: WorldView): Promise<DayScript> {
    const living = world.fruits.filter((f) => f.alive)
    const backup = await this.fallback.playDay(world)
    const { rounds } = world.rules

    const out = await this.ask(
      world,
      [
        `It is day ${world.day}. Write the whole day in order:`,
        `- "rounds": exactly ${rounds} round${rounds > 1 ? 's' : ''} of talking. In each round the living fruits split into "groups" of two (one group of three if the number is odd), so that EVERY living fruit is in exactly one group. Each fruit goes to whoever it most wants to talk to, given its feelings and personality (to confront a suspect, sound out a friend, spread a rumour, tell a lie), and should change partner between rounds. Each group has "members" and its own private conversation in "lines": about 4 lines for a pair, 5 for a three, speakers taking turns and reacting to each other. Only a group's members hear its lines. What a fruit learns in one round it can repeat, twist or hide in the next.`,
        '- "votes": after the talking, EVERY living fruit votes in public for ONE other living fruit ("target"), with a short "reason" said out loud. Each vote must follow from that fruit\'s own feelings and only the conversations it was in. "lastWords" is what that fruit cries out, in at most 15 words, if it turns out to be the one voted out: an innocent fruit pleads or curses the village, a werewolf that has been caught may gloat or confess, the jester celebrates.',
      ].join('\n'),
      DAY_SCHEMA,
    )
    if (!out) return backup

    const written = this.rows(out.rounds)
    const votes = this.rows(out.votes).flatMap((row) => {
      const id = this.resolve(row.name, living)
      const target = this.resolve(row.target, living)
      const lastWords = this.text(row.lastWords, 140) || backup.votes.find((v) => v.id === id)?.lastWords
      return id && target && target !== id ? [{ id, target, reason: this.text(row.reason, 160), lastWords }] : []
    })

    return {
      rounds: Array.from({ length: rounds }, (_, r) => (written[r] && this.repairRound(written[r], living)) || backup.rounds[r]),
      votes: living.map((f) => votes.find((v) => v.id === f.id) ?? backup.votes.find((v) => v.id === f.id)!),
    }
  }
}
