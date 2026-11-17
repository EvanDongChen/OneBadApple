import * as D from './dialog'
import { presetOf } from './quirks'
import type { Brain, Conversation, DayScript, FruitState, NightScript, WorldView } from './types'

type Other = { id: string; name: string }

/** What one fruit is allowed to know when it decides something. */
interface AgentView {
  self: FruitState
  /** Living fruits other than self. */
  others: Other[]
  /** Name of the fruit that died most recently, if any. */
  lastDead?: string
  /** Everything this fruit has seen or heard: public events plus its own conversations. */
  log: string[]
}

/** What a spoken line was doing, so the next speaker can react to it. */
interface Said {
  tone: 'accuse' | 'vouch' | 'friendly'
  /** Who the line was about, if anyone. */
  about?: string
}

/** Something the dead might have an opinion on. */
export type GhostEvent = 'death' | 'saved' | 'ballot-wrong' | 'ballot-right' | 'out-wrong' | 'out-right' | 'tie' | 'whisper'

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function best<T>(items: T[], score: (item: T) => number): T {
  return items.reduce((a, b) => (score(b) > score(a) ? b : a))
}

/**
 * The no-AI brain. No network: every decision is computed from the fruit's
 * personality sliders and what it has seen, so different traits play differently.
 * Lines come from the stock library in dialog.ts.
 *
 * - suspicion: how readily it acts on hunches and thin evidence
 * - aggression: how hard it retaliates against accusers, and how harshly it talks
 * - honesty: whether it shares what it truly knows, or bluffs and invents claims
 * - talkativeness: how much it says
 */
export class MockBrain implements Brain {
  /** Templates already used this game, so lines don't repeat until a pool runs dry. */
  private used = new Set<string>()

  private line(pool: string[], x?: Other, y?: Other, dead?: string): string {
    const fresh = pool.filter((t) => !this.used.has(t))
    const template = pick(fresh.length ? fresh : pool)
    this.used.add(template)
    return (
      template
        // With no {x} given, drop the name and its commas ("I trust you, {x}." becomes "I trust you.").
        .replace(/,?\s*\{x\},?/g, (m) => (x ? m.replace('{x}', x.name) : ''))
        .replaceAll('{y}', (y ?? x)?.name ?? '')
        .replaceAll('{d}', dead ?? '')
    )
  }

  private isPackmate(view: AgentView, other: Other) {
    return view.self.role === 'werewolf' && view.self.memory.includes(`Fellow werewolf: ${other.name}`)
  }

  private knownWolf(view: AgentView, other: Other) {
    return view.self.memory.some((m) => m.includes(`${other.name} is a WEREWOLF`))
  }

  private knownInnocent(view: AgentView, other: Other) {
    return view.self.memory.some((m) => m.includes(`${other.name} is NOT a werewolf`))
  }

  /** Lines this fruit has heard `speaker` say that mention `subject`. */
  private mentions(view: AgentView, speaker: string, subject: string) {
    return view.log.filter((l) => l.startsWith(`${speaker}:`) && l.slice(speaker.length).includes(subject)).length
  }

  /** How often this fruit has heard others name `other`. */
  private heat(view: AgentView, other: Other) {
    return view.others.filter((o) => o.id !== other.id).reduce((sum, o) => sum + this.mentions(view, o.name, other.name), 0)
  }

  /** How much this fruit wants `other` gone, given its personality. */
  private suspicionOf(view: AgentView, other: Other): number {
    const { traits, role, name } = view.self
    // The jester has no real opinions; it just wants attention.
    if (role === 'jester') return Math.random() * 3
    if (this.isPackmate(view, other)) return -100
    if (this.knownWolf(view, other)) return 50
    if (this.knownInnocent(view, other)) return -20

    const heat = this.heat(view, other)
    // Grudge: how often they have named me.
    const grudge = this.mentions(view, other.name, name)
    // Hunch: suspicious fruits invent reasons out of thin air.
    const hunch = Math.random() * (0.5 + traits.suspicion * 3)

    let score = heat * (0.4 + traits.suspicion * 0.6) + grudge * (0.3 + traits.aggression * 2.5) + hunch
    // A werewolf piles onto whoever is already under fire, and wants loud accusers gone.
    if (role === 'werewolf') score += heat * 0.8 + grudge * 1.5
    return score
  }

  private topSuspect(view: AgentView): Other {
    return best(view.others, (o) => this.suspicionOf(view, o))
  }

  private mostTrusted(view: AgentView): Other {
    return best(view.others, (o) => -this.suspicionOf(view, o))
  }

  /** Opening line of a conversation, said to `partner`. */
  private opener(view: AgentView, partner: Other): [string, Said] {
    const { traits, role } = view.self
    const suspect = this.topSuspect(view)
    const found = view.others.find((o) => this.knownWolf(view, o))

    if (role === 'jester' && Math.random() < 0.5) return [this.line(D.JESTER), { tone: 'friendly' }]
    if (found && found.id !== partner.id && Math.random() < 0.3 + traits.honesty * 0.7) {
      // An honest seer shares what it saw.
      return [this.line(D.SEER_REVEAL, found), { tone: 'accuse', about: found.id }]
    }
    if (role === 'werewolf' && suspect.id !== partner.id && Math.random() > traits.honesty && Math.random() < 0.45) {
      // A dishonest wolf invents evidence against an innocent.
      return [this.line(D.WOLF_LIE, suspect), { tone: 'accuse', about: suspect.id }]
    }
    if (suspect.id === partner.id) {
      // Face to face with its own suspect: the bold confront, the timid play nice.
      return Math.random() < traits.aggression + 0.15
        ? [this.line(D.CONFRONT, partner), { tone: 'accuse', about: partner.id }]
        : [this.line(D.ALLY), { tone: 'friendly' }]
    }
    if (Math.random() < 0.35 + traits.suspicion * 0.6) return [this.line(D.GOSSIP, partner, suspect), { tone: 'accuse', about: suspect.id }]
    if (view.lastDead && Math.random() < 0.3) return [this.line(D.MOURN, undefined, undefined, view.lastDead), { tone: 'friendly' }]
    return [this.line(D.ALLY), { tone: 'friendly' }]
  }

  /** A reply inside a conversation, reacting to what `speaker` just said. */
  private reply(view: AgentView, speaker: Other, last: Said): [string, Said] {
    const { traits, role, id } = view.self
    const harsh = Math.random() < traits.aggression
    const subject = view.others.find((o) => o.id === last.about)
    let out: [string, Said]

    if (role === 'jester' && Math.random() < 0.4) {
      out = [this.line(D.JESTER), { tone: 'friendly' }]
    } else if (last.tone === 'accuse' && last.about === id) {
      // I was just accused to my face.
      out = [this.line(harsh ? D.DEFEND_HARSH : D.DEFEND_MILD, speaker), { tone: 'accuse', about: speaker.id }]
    } else if (last.tone === 'accuse' && subject) {
      // They named a third fruit: back them up, stand up for the fruit, or sit on the fence.
      if (this.knownInnocent(view, subject)) out = [this.line(D.SEER_CLEAR, subject), { tone: 'vouch', about: subject.id }]
      else if (this.isPackmate(view, subject) || (subject.id === this.mostTrusted(view).id && Math.random() < 0.3 + traits.honesty * 0.4)) {
        out = [this.line(D.VOUCH, subject), { tone: 'vouch', about: subject.id }]
      } else if (this.knownWolf(view, subject) || subject.id === this.topSuspect(view).id || Math.random() < traits.suspicion * 0.5) {
        out = [this.line(D.AGREE, subject), { tone: 'accuse', about: subject.id }]
      } else out = [this.line(D.UNSURE, subject), { tone: 'friendly' }]
    } else if (Math.random() < 0.3 + traits.suspicion * 0.5) {
      // Nothing to react to: bring up its own suspicion.
      const suspect = this.topSuspect(view)
      out =
        suspect.id === speaker.id
          ? [this.line(D.CONFRONT, speaker), { tone: 'accuse', about: speaker.id }]
          : [this.line(harsh ? D.ACCUSE_HARSH : D.ACCUSE_MILD, suspect), { tone: 'accuse', about: suspect.id }]
    } else {
      out = [this.line(D.SMALL_TALK), { tone: 'friendly' }]
    }

    if (Math.random() < traits.talkativeness * 0.5) out[0] += ` ${this.line(D.EXTRA)}`
    return out
  }

  private vote(view: AgentView): { target: string; reason: string } {
    const target = this.topSuspect(view)
    const harsh = Math.random() < view.self.traits.aggression
    const pool = this.knownWolf(view, target)
      ? D.VOTE_KNOWN
      : this.mentions(view, target.name, view.self.name) > 0 && harsh
        ? D.VOTE_GRUDGE
        : this.heat(view, target) >= 3 && !harsh
          ? D.VOTE_FOLLOW
          : harsh
            ? D.VOTE_HARSH
            : D.VOTE_MILD
    return { target: target.id, reason: this.withTic(view.self, this.line(pool)) }
  }

  private nightAction(view: AgentView, candidates: Other[]): string {
    const { role, traits, id } = view.self
    if (role === 'werewolf') {
      // Silence anyone it heard claim to be the seer, otherwise whoever threatens the pack most.
      const claimedSeer = candidates.find((c) => view.log.some((l) => l.startsWith(`${c.name}:`) && l.includes('I am the seer')))
      return (claimedSeer ?? best(candidates, (c) => this.suspicionOf(view, c))).id
    }
    if (role === 'seer') {
      // Check the biggest suspect not already inspected.
      const fresh = candidates.filter((c) => !this.knownWolf(view, c) && !this.knownInnocent(view, c))
      return best(fresh.length ? fresh : candidates, (c) => this.suspicionOf(view, c)).id
    }
    // Doctor: a selfish (dishonest) doctor guards itself; otherwise it guards whoever it trusts most.
    const others = candidates.filter((c) => c.id !== id)
    const selfish = Math.random() > traits.honesty * 0.8 + 0.1
    return selfish || !others.length ? id : best(others, (c) => -this.suspicionOf(view, c)).id
  }

  /** One fruit's inner state, derived from the same scoring its decisions use. */
  private mind(view: AgentView): NightScript['minds'][number] {
    const feelings = view.others.map((o) => {
      const note = this.isPackmate(view, o)
        ? 'Pack.'
        : this.knownWolf(view, o)
          ? 'I saw it. Werewolf.'
          : this.knownInnocent(view, o)
            ? 'I checked. Clean.'
            : this.mentions(view, o.name, view.self.name) > 0
              ? 'Had words with me.'
              : this.heat(view, o) >= 2
                ? 'I keep hearing their name.'
                : ''
      return { about: o.id, trust: clamp(Math.round(2 - this.suspicionOf(view, o) * 1.5), -5, 5), note }
    })
    const worst = feelings.length ? feelings.reduce((a, b) => (b.trust < a.trust ? b : a)) : undefined
    const worstFruit = view.others.find((o) => o.id === worst?.about)
    return {
      id: view.self.id,
      thought: worstFruit ? this.line(view.self.role === 'werewolf' ? D.THOUGHT_WOLF : D.THOUGHT_VILLAGER, worstFruit) : '',
      feelings,
    }
  }

  private view(world: WorldView, self: FruitState, extra: string[] = []): AgentView {
    const log = [...world.publicLog, ...self.heard, ...extra]
    const text = world.publicLog.join('\n')
    const dead = world.fruits.filter((f) => !f.alive)
    return {
      self,
      others: world.fruits.filter((f) => f.alive && f.id !== self.id).map((f) => ({ id: f.id, name: f.name })),
      // The newest death is the last one announced in the public log.
      lastDead: dead.sort((a, b) => text.lastIndexOf(a.name) - text.lastIndexOf(b.name)).at(-1)?.name,
      log,
    }
  }

  async playNight(world: WorldView): Promise<NightScript> {
    const living = world.fruits.filter((f) => f.alive)
    const options = (list: FruitState[]) => list.map((f) => ({ id: f.id, name: f.name }))
    const view = (f: FruitState) => this.view(world, f)

    // Every wolf has its own idea of who should go. The most aggressive one gets its way.
    const wolves = living.filter((f) => f.role === 'werewolf')
    const prey = options(living.filter((f) => f.role !== 'werewolf'))
    const picks = wolves.map((w) => this.nightAction(view(w), prey))
    const lead = wolves.indexOf(best(wolves, (w) => w.traits.aggression))
    const doctor = living.find((f) => f.role === 'doctor')
    const seer = living.find((f) => f.role === 'seer')
    const hunter = living.find((f) => f.role === 'hunter')
    return {
      kill: picks[lead],
      wolfChat: wolves.length > 1 ? this.wolfChat(wolves, picks, lead, prey) : undefined,
      protect: doctor ? this.nightAction(view(doctor), options(living)) : null,
      inspect: seer ? this.nightAction(view(seer), options(living.filter((f) => f.id !== seer.id))) : null,
      revenge: hunter ? this.topSuspect(view(hunter)).id : null,
      minds: living.map((f) => this.mind(view(f))),
    }
  }

  /** The pack's whispered argument over the victim. It always ends on the lead wolf's choice. */
  private wolfChat(wolves: FruitState[], picks: string[], lead: number, prey: Other[]): NightScript['wolfChat'] {
    const named = (id: string) => prey.find((p) => p.id === id)
    const other = lead === 0 ? 1 : 0
    const target = named(picks[lead])
    const lines = [{ id: wolves[other].id, say: this.line(D.WOLF_PROPOSE, named(picks[other])) }]
    if (picks[other] === picks[lead]) {
      lines.push({ id: wolves[lead].id, say: this.line(D.WOLF_AGREE, target) })
    } else {
      lines.push({ id: wolves[lead].id, say: this.line(D.WOLF_COUNTER, target) })
      lines.push({ id: wolves[other].id, say: this.line(D.WOLF_GIVE_IN, target) })
    }
    lines.push({ id: wolves[lead].id, say: this.line(D.WOLF_SETTLE, target) })
    return lines
  }

  /** Now and then a fruit's quirk shows: a little phrase of its own on the end of the line. */
  private withTic(fruit: FruitState, say: string): string {
    const tics = fruit.traits.quirks.flatMap((q) => presetOf(q)?.tics ?? [])
    return tics.length && Math.random() < 0.4 ? `${say} ${pick(tics)}` : say
  }

  /** What a fruit cries out if it is the one voted out. */
  private lastCry(fruit: FruitState): string {
    if (fruit.role === 'werewolf') return this.line(D.LAST_WOLF)
    if (fruit.role === 'jester') return this.line(D.LAST_JESTER)
    return this.line(Math.random() < fruit.traits.aggression ? D.LAST_CURSE : D.LAST_PLEA)
  }

  /** Split the living into pairs (one trio if the count is odd), each fruit seeking out who it wants to talk to. */
  private groupUp(world: WorldView, living: FruitState[], extra: Map<string, string[]>, met: Set<string>): FruitState[][] {
    const free = new Set(living.map((f) => f.id))
    const groups: FruitState[][] = []
    const key = (a: string, b: string) => [a, b].sort().join('|')
    for (const fruit of shuffle(living)) {
      if (!free.has(fruit.id)) continue
      free.delete(fruit.id)
      if (!free.size) {
        // Odd one out joins an existing pair.
        if (groups.length) pick(groups).push(fruit)
        break
      }
      const view = this.view(world, fruit, extra.get(fruit.id))
      // Aggressive fruits seek out their suspect; gentler ones seek out a friend.
      const wanted = Math.random() < fruit.traits.aggression ? this.topSuspect(view) : this.mostTrusted(view)
      const open = living.filter((f) => free.has(f.id))
      const unmet = open.filter((f) => !met.has(key(fruit.id, f.id)))
      const partner = unmet.find((f) => f.id === wanted.id) ?? (unmet.length ? pick(unmet) : pick(open))
      free.delete(partner.id)
      met.add(key(fruit.id, partner.id))
      groups.push([fruit, partner])
    }
    return groups
  }

  /** Write one small conversation, speakers taking turns and reacting to the line before. */
  private converse(world: WorldView, members: FruitState[], extra: Map<string, string[]>): Conversation {
    const lines: Conversation['lines'] = []
    const said: string[] = []
    let last: Said = { tone: 'friendly' }
    const turns = members.length === 2 ? 4 : 5
    for (let t = 0; t < turns; t++) {
      const speaker = members[t % members.length]
      const previous = members[(t + members.length - 1) % members.length]
      const next = members[(t + 1) % members.length]
      const view = this.view(world, speaker, [...(extra.get(speaker.id) ?? []), ...said])
      const [plain, meta] = t === 0 ? this.opener(view, next) : this.reply(view, previous, last)
      const say = this.withTic(speaker, plain)
      last = meta
      lines.push({ id: speaker.id, say, accuses: meta.tone === 'accuse' ? meta.about : undefined })
      said.push(`${speaker.name}: ${say}`)
    }
    for (const m of members) extra.set(m.id, [...(extra.get(m.id) ?? []), ...said])
    return { members: members.map((m) => m.id), lines }
  }

  async playDay(world: WorldView): Promise<DayScript> {
    const living = world.fruits.filter((f) => f.alive)
    const nameOf = (id: string) => world.fruits.find((f) => f.id === id)?.name ?? id
    // What each fruit hears as the day is written, so later rounds build on earlier ones.
    const extra = new Map<string, string[]>()
    const met = new Set<string>()

    const rounds: Conversation[][] = []
    for (let r = 0; r < world.rules.rounds; r++) {
      rounds.push(this.groupUp(world, living, extra, met).map((members) => this.converse(world, members, extra)))
    }

    const votes: DayScript['votes'] = []
    const cast: string[] = []
    for (const f of living) {
      const choice = this.vote(this.view(world, f, [...(extra.get(f.id) ?? []), ...cast]))
      votes.push({ id: f.id, ...choice, lastWords: this.lastCry(f) })
      // Votes are public, so later voters can follow the crowd.
      cast.push(`${f.name}: I vote ${nameOf(choice.target)}.`)
    }
    return { rounds, votes }
  }

  /** What a ghost thinks of something that just happened. A dead werewolf still roots for the pack. */
  ghostThought(ghost: FruitState, event: GhostEvent, about?: Other): string {
    if (ghost.role === 'werewolf') {
      if (event === 'tie') return this.line(D.GHOST_TIE)
      const bad = event === 'saved' || event === 'ballot-right' || event === 'out-right'
      return this.line(bad ? D.GHOST_WOLF_SORE : D.GHOST_WOLF_GLAD, about)
    }
    const pools: Record<GhostEvent, string[]> = {
      death: D.GHOST_DEATH,
      saved: D.GHOST_SAVED,
      'ballot-wrong': D.GHOST_BALLOT_WRONG,
      'ballot-right': D.GHOST_BALLOT_RIGHT,
      'out-wrong': D.GHOST_OUT_WRONG,
      'out-right': D.GHOST_OUT_RIGHT,
      tie: D.GHOST_TIE,
      whisper: D.GHOST_WHISPER,
    }
    return this.line(pools[event], about)
  }

  /** The hunter's last words. */
  lastWords(target: Other): string {
    return this.line(D.HUNTER_SHOT, target)
  }
}
