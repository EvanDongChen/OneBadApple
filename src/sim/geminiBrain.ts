import { MockBrain } from './mockBrain'
import type { Brain, DayScript, FruitState, NightScript, WorldView } from './types'

const API = 'https://generativelanguage.googleapis.com/v1beta'
const REQUEST_TIMEOUT_MS = 45000
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

const ROLE_BRIEF: Record<string, string> = {
  werewolf: 'WEREWOLF. Kills a villager each night. By day it blends in, deflects suspicion and gets innocents voted out. It never admits what it is.',
  villager: 'VILLAGER. No powers. Wants to find the werewolves and vote them out.',
  seer: 'SEER. Each night learns whether one fruit is a werewolf. Wants to use that, but revealing itself makes it a target.',
  doctor: 'DOCTOR. Each night protects one fruit from being killed. Revealing itself makes it a target.',
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
    'Rules: the village wins when every werewolf is dead; the werewolves win when they are at least half of the living fruits. Each night the werewolves kill one fruit, the doctor protects one, the seer inspects one. Each day the fruits talk, then vote one fruit out.',
    'Secrecy is the whole game. A fruit only knows the PUBLIC log and its own PRIVATE section. Never let a fruit act on, hint at or repeat anything from another fruit\'s private section. Villagers do not know who the werewolf is and should sometimes be wrong.',
    'Each fruit\'s personality must drive both what it decides and how it talks: aggressive fruits attack and hold grudges, dishonest ones lie and invent claims, suspicious ones accuse on thin evidence, talkative ones speak more and longer. Use each quirk. The odd fruit pun is welcome.',
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
  minds: list(obj({ name: STR, thought: STR, feelings: list(obj({ about: STR, trust: { type: 'INTEGER' }, note: STR })) })),
})

const DAY_SCHEMA = obj({
  plans: list(obj({ name: STR, approach: STR, line: STR })),
  discussion: list(obj({ name: STR, say: STR })),
  votes: list(obj({ name: STR, target: STR, reason: STR })),
})

type Json = Record<string, unknown>

/**
 * The whole village's decisions come from Gemini, two batched calls per game day:
 * one for the night (actions plus every fruit's updated thoughts and feelings) and
 * one for the day (morning chats, the full meeting and every vote).
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
    const prey = living.filter((f) => f.role !== 'werewolf')

    const out = await this.ask(
      world,
      [
        `It is the night of day ${world.day}. Decide the night, each choice made only from that fruit's own knowledge:`,
        `- "kill": the werewolves' victim. Options: ${prey.map((f) => f.name).join(', ')}.`,
        doctor ? `- "protect": who ${doctor.name} (doctor) guards; may be itself.` : '- "protect": "" (there is no doctor).',
        seer ? `- "inspect": who ${seer.name} (seer) inspects; not itself, ideally someone not inspected before.` : '- "inspect": "" (there is no seer).',
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

    return {
      kill: this.resolve(out.kill, prey) ?? backup.kill,
      protect: doctor ? (this.resolve(out.protect, living) ?? backup.protect) : null,
      inspect: seer ? (this.resolve(out.inspect, living.filter((f) => f.id !== seer.id)) ?? backup.inspect) : null,
      // Any fruit Gemini skipped keeps the rule-based mind.
      minds: living.map((f) => minds.find((m) => m.id === f.id && m.feelings.length) ?? backup.minds.find((m) => m.id === f.id)!),
    }
  }

  async playDay(world: WorldView): Promise<DayScript> {
    const living = world.fruits.filter((f) => f.alive)
    const backup = await this.fallback.playDay(world)
    const turns = Math.max(5, Math.min(12, Math.round(living.length * 1.6)))

    const out = await this.ask(
      world,
      [
        `It is day ${world.day}. Write the whole day in order:`,
        '- "plans": the morning. For EVERY living fruit, the ONE other living fruit it chooses to walk up to ("approach") and the "line" it says to them privately: probing, warning, allying or lying, as its feelings and personality dictate.',
        `- "discussion": the village meeting, about ${turns} lines in speaking order. Fruits react to the lines before them: accuse, defend, bluff, change the subject. Chattier fruits speak more; quiet ones may speak once or not at all. Private morning lines were only heard by the fruit they were said to.`,
        '- "votes": after the meeting, EVERY living fruit votes for ONE other living fruit ("target"), with a short "reason" said out loud. Votes must follow from each fruit\'s own feelings and what was said in the discussion you just wrote.',
      ].join('\n'),
      DAY_SCHEMA,
    )
    if (!out) return backup

    const plans = this.rows(out.plans).flatMap((row) => {
      const id = this.resolve(row.name, living)
      const approach = this.resolve(row.approach, living)
      const line = this.text(row.line)
      return id && approach && approach !== id && line ? [{ id, approach, line }] : []
    })
    const discussion = this.rows(out.discussion)
      .flatMap((row) => {
        const id = this.resolve(row.name, living)
        const say = this.text(row.say)
        return id && say ? [{ id, say }] : []
      })
      .slice(0, 14)
    const votes = this.rows(out.votes).flatMap((row) => {
      const id = this.resolve(row.name, living)
      const target = this.resolve(row.target, living)
      return id && target && target !== id ? [{ id, target, reason: this.text(row.reason, 160) }] : []
    })

    return {
      plans: living.map((f) => plans.find((p) => p.id === f.id) ?? backup.plans.find((p) => p.id === f.id)!),
      discussion: discussion.length >= 3 ? discussion : backup.discussion,
      votes: living.map((f) => votes.find((v) => v.id === f.id) ?? backup.votes.find((v) => v.id === f.id)!),
    }
  }
}
