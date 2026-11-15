import { MockBrain } from './mockBrain'
import type { AgentView, Brain, Choice, DayPlan, Speech } from './types'

const API = 'https://generativelanguage.googleapis.com/v1beta'
const REQUEST_TIMEOUT_MS = 20000
const MAX_ATTEMPTS = 3

export interface GeminiOptions {
  apiKey: string
  model: string
  /** Calls are spaced out to stay under this. */
  requestsPerMinute: number
  /** After this many calls the brain falls back to canned decisions. */
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

const pct = (n: number) => `${Math.round(n * 10)}/10`

function persona(view: AgentView): string {
  const { self } = view
  const t = self.traits
  const roleRules: Record<string, string> = {
    werewolf:
      'You are a WEREWOLF. Each night the werewolves kill one villager. By day you must blend in, deflect suspicion and get innocents voted out. Never admit you are a werewolf.',
    villager: 'You are an ordinary VILLAGER. Work out who the werewolves are and vote them out.',
    seer: 'You are the SEER. Each night you learn whether one fruit is a werewolf. Use what you learn, but revealing yourself makes you a target.',
    doctor: 'You are the DOCTOR. Each night you protect one fruit from being killed. Revealing yourself makes you a target.',
  }
  return [
    `You are ${self.name}, a little ${self.kind} with legs who lives in a fruit village. The village is playing Werewolf (Mafia) for real.`,
    roleRules[self.role],
    'The village wins when every werewolf is dead. The werewolves win when they are at least half of the living fruits.',
    `Your personality (0 = not at all, 10 = extremely): aggression ${pct(t.aggression)}, honesty ${pct(t.honesty)}, talkativeness ${pct(t.talkativeness)}, suspicion of others ${pct(t.suspicion)}.`,
    t.quirk ? `Your quirk: ${t.quirk}` : '',
    'Stay in character. Let your personality drive both what you decide and how you talk. Anything you say out loud must be one or two short sentences, at most 25 words, with the odd fruit pun welcome.',
    'Reply with a single JSON object and nothing else.',
  ]
    .filter(Boolean)
    .join('\n')
}

function situation(view: AgentView): string {
  return [
    `It is day ${view.day}.`,
    `Other living fruits: ${view.others.map((o) => o.name).join(', ')}.`,
    view.self.memory.length ? `What only you know:\n${view.self.memory.map((m) => `- ${m}`).join('\n')}` : '',
    view.publicLog.length ? `What has happened publicly (oldest first):\n${view.publicLog.join('\n')}` : 'Nothing has happened publicly yet.',
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Each fruit's decisions come from Gemini. Any failure falls back to a canned decision. */
export class GeminiBrain implements Brain {
  private fallback = new MockBrain()
  private calls = 0
  private queue: Promise<unknown> = Promise.resolve()
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
      signal.addEventListener('abort', () => (clearTimeout(timer), reject(new DOMException('Aborted', 'AbortError'))), {
        once: true,
      })
    })
  }

  /** One request at a time, spaced to respect the rate limit. Returns null on any failure. */
  private ask(view: AgentView, task: string): Promise<Record<string, unknown> | null> {
    const run = async () => {
      if (this.calls >= this.opts.maxCalls) {
        this.problem(`Hit the cap of ${this.opts.maxCalls} Gemini calls. The fruits are improvising from here.`)
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
              systemInstruction: { parts: [{ text: persona(view) }] },
              contents: [{ role: 'user', parts: [{ text: `${situation(view)}\n\n${task}` }] }],
              generationConfig: { responseMimeType: 'application/json', temperature: 1 },
            }),
          })
          if (res.status === 429 || res.status >= 500) {
            if (attempt === MAX_ATTEMPTS) {
              this.problem(`Gemini is rate-limiting or unavailable (HTTP ${res.status}). Some fruits are improvising.`)
              return null
            }
            await this.sleep(4000 * attempt)
            continue
          }
          const json = await res.json()
          if (!res.ok) {
            this.problem(`Gemini error: ${json?.error?.message ?? `HTTP ${res.status}`}`)
            return null
          }
          const text: string | undefined = json?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text
          const parsed = text ? JSON.parse(text) : null
          return parsed && typeof parsed === 'object' ? parsed : null
        } catch (err) {
          if (this.opts.signal.aborted) throw err
          if (attempt === MAX_ATTEMPTS) {
            this.problem(`Gemini request failed: ${err instanceof Error ? err.message : String(err)}`)
            return null
          }
        }
      }
      return null
    }
    const result = this.queue.then(run, run)
    this.queue = result.catch(() => null)
    return result
  }

  /** Accept an id or a name, case-insensitively. */
  private resolve(value: unknown, options: { id: string; name: string }[]): string | null {
    if (typeof value !== 'string') return null
    const key = value.trim().toLowerCase()
    return options.find((o) => o.id.toLowerCase() === key || o.name.toLowerCase() === key)?.id ?? null
  }

  private text(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim().slice(0, 240) : null
  }

  async planDay(view: AgentView): Promise<DayPlan> {
    const out = await this.ask(
      view,
      'It is morning. Decide what you want to do today before the village meeting: pick ONE living fruit to walk over to and say something to in private (probe them, warn them, make an ally, plant a lie; your call).\nJSON shape: {"approach": "<their name>", "line": "<what you say to them>"}',
    )
    const approach = this.resolve(out?.approach, view.others)
    const line = this.text(out?.line)
    return approach && line ? { approach, line } : this.fallback.planDay(view)
  }

  async speak(view: AgentView): Promise<Speech> {
    const out = await this.ask(
      view,
      'The village is gathered at the campfire to work out who the werewolf is. It is your turn to speak to everyone. React to what was just said if it makes sense.\nJSON shape: {"say": "<what you say out loud>"}',
    )
    const say = this.text(out?.say)
    return say ? { say } : this.fallback.speak(view)
  }

  async vote(view: AgentView): Promise<Choice> {
    const out = await this.ask(
      view,
      'Discussion is over. Vote for ONE living fruit to eliminate.\nJSON shape: {"target": "<their name>", "reason": "<what you say out loud as you vote, short>"}',
    )
    const target = this.resolve(out?.target, view.others)
    return target ? { target, reason: this.text(out?.reason) ?? '' } : this.fallback.vote(view)
  }

  async nightAction(view: AgentView, candidates: { id: string; name: string }[]): Promise<Choice> {
    const tasks: Record<string, string> = {
      werewolf: 'It is night. Choose ONE fruit for the werewolves to kill.',
      seer: 'It is night. Choose ONE fruit to inspect; you will learn whether they are a werewolf.',
      doctor: 'It is night. Choose ONE fruit to protect from the werewolves tonight. You may choose yourself.',
    }
    const out = await this.ask(
      view,
      `${tasks[view.self.role]}\nOptions: ${candidates.map((c) => c.name).join(', ')}.\nJSON shape: {"target": "<their name>", "reason": "<private reasoning, short>"}`,
    )
    const target = this.resolve(out?.target, candidates)
    return target ? { target, reason: this.text(out?.reason) ?? '' } : this.fallback.nightAction(view, candidates)
  }
}
