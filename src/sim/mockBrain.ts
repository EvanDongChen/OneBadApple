import * as D from './dialog'
import type { Brain, DayScript, FruitState, NightScript, WorldView } from './types'

type Other = { id: string; name: string }

/** What one fruit is allowed to know when it decides something. */
interface AgentView {
  self: FruitState
  /** Living fruits other than self. */
  others: Other[]
  /** Name of the fruit that died most recently, if any. */
  lastDead?: string
  publicLog: string[]
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
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
 * - talkativeness: how much it says (and how often it gets the floor)
 */
export class MockBrain implements Brain {
  /** Templates already used this game, so lines don't repeat until a pool runs dry. */
  private used = new Set<string>()

  private line(pool: string[], x?: Other, y?: Other, dead?: string): string {
    const fresh = pool.filter((t) => !this.used.has(t))
    const template = pick(fresh.length ? fresh : pool)
    this.used.add(template)
    return template
      .replaceAll('{x}', x?.name ?? '')
      .replaceAll('{y}', (y ?? x)?.name ?? '')
      .replaceAll('{d}', dead ?? '')
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

  /** Public lines spoken by `speaker` that mention `subject`. */
  private mentions(view: AgentView, speaker: string, subject: string) {
    return view.publicLog.filter((l) => l.startsWith(`${speaker}:`) && l.slice(speaker.length).includes(subject)).length
  }

  /** How often the rest of the village has named this fruit. */
  private heat(view: AgentView, other: Other) {
    return view.others.filter((o) => o.id !== other.id).reduce((sum, o) => sum + this.mentions(view, o.name, other.name), 0)
  }

  /** How much this fruit wants `other` gone, given its personality. */
  private suspicionOf(view: AgentView, other: Other): number {
    const { traits, role, name } = view.self
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

  /** Who (if anyone) named this fruit in the last few public lines. */
  private recentAccuser(view: AgentView): Other | undefined {
    const recent = view.publicLog.slice(-4)
    return view.others.find((o) => recent.some((l) => l.startsWith(`${o.name}:`) && l.includes(view.self.name)))
  }

  /** The fruit most recently named by someone else at the meeting, if it isn't a friend. */
  private underFire(view: AgentView): Other | undefined {
    const recent = view.publicLog.slice(-3).filter((l) => !l.startsWith(`${view.self.name}:`) && !l.startsWith('['))
    return view.others.find((o) => recent.some((l) => !l.startsWith(`${o.name}:`) && l.includes(o.name)))
  }

  private planDay(view: AgentView): { approach: string; line: string } {
    const { traits } = view.self
    const suspect = this.topSuspect(view)
    // Aggressive fruits march up to their suspect; gentler ones go and talk to someone they trust.
    if (Math.random() < traits.aggression) return { approach: suspect.id, line: this.line(D.CONFRONT, suspect) }
    const ally = this.mostTrusted(view)
    if (ally.id === suspect.id || Math.random() > 0.35 + traits.suspicion * 0.6) return { approach: ally.id, line: this.line(D.ALLY, ally) }
    return { approach: ally.id, line: this.line(D.GOSSIP, ally, suspect) }
  }

  private speak(view: AgentView): string {
    const { traits, role } = view.self
    const harsh = Math.random() < traits.aggression
    const accuser = this.recentAccuser(view)
    const target = this.underFire(view)
    const suspect = this.topSuspect(view)
    const trusted = this.mostTrusted(view)
    const seerFind = view.others.find((o) => this.knownWolf(view, o))
    const seerCleared = view.others.find((o) => this.knownInnocent(view, o))
    let line: string

    if (seerFind && Math.random() < 0.3 + traits.honesty * 0.7) {
      // An honest seer shares what it saw.
      line = this.line(D.SEER_REVEAL, seerFind)
    } else if (role === 'werewolf' && Math.random() > traits.honesty && Math.random() < 0.45) {
      // A dishonest wolf invents evidence against an innocent.
      line = this.line(D.WOLF_LIE, suspect)
    } else if (accuser && Math.random() < 0.7) {
      line = this.line(harsh ? D.DEFEND_HARSH : D.DEFEND_MILD, accuser)
    } else if (target && target.id === seerCleared?.id && Math.random() < 0.8) {
      line = this.line(D.SEER_CLEAR, target)
    } else if (target && target.id === trusted.id && Math.random() < 0.3 + traits.honesty * 0.4) {
      // Stand up for a friend who is being accused.
      line = this.line(D.VOUCH, target)
    } else if (target && target.id === suspect.id && Math.random() < 0.6) {
      // Someone else already said it: pile on.
      line = this.line(D.AGREE, target)
    } else if (Math.random() < 0.25 + traits.suspicion * 0.6 + traits.aggression * 0.2) {
      line = this.line(harsh ? D.ACCUSE_HARSH : D.ACCUSE_MILD, suspect)
    } else if (view.lastDead && Math.random() < 0.3) {
      line = this.line(D.MOURN, undefined, undefined, view.lastDead)
    } else {
      line = this.line(D.IDLE)
    }

    if (Math.random() < traits.talkativeness * 0.7) line += ` ${this.line(D.EXTRA)}`
    return line
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
    return { target: target.id, reason: this.line(pool) }
  }

  private nightAction(view: AgentView, candidates: Other[]): string {
    const { role, traits, id } = view.self
    if (role === 'werewolf') {
      // Silence anyone claiming to be the seer, otherwise whoever threatens the pack most.
      const claimedSeer = candidates.find((c) => view.publicLog.some((l) => l.startsWith(`${c.name}:`) && l.includes('I am the seer')))
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
              ? 'Accused me.'
              : this.heat(view, o) >= 3
                ? 'Everyone is talking about them.'
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

  private view(world: WorldView, self: FruitState, publicLog: string[]): AgentView {
    const dead = world.fruits.filter((f) => !f.alive)
    return {
      self,
      others: world.fruits.filter((f) => f.alive && f.id !== self.id).map((f) => ({ id: f.id, name: f.name })),
      // The newest death is the last one announced in the log.
      lastDead: dead.sort((a, b) => publicLog.join('\n').lastIndexOf(a.name) - publicLog.join('\n').lastIndexOf(b.name)).at(-1)?.name,
      publicLog,
    }
  }

  async playNight(world: WorldView): Promise<NightScript> {
    const living = world.fruits.filter((f) => f.alive)
    const options = (list: FruitState[]) => list.map((f) => ({ id: f.id, name: f.name }))
    const view = (f: FruitState) => this.view(world, f, world.publicLog)

    const wolf = living.find((f) => f.role === 'werewolf')!
    const doctor = living.find((f) => f.role === 'doctor')
    const seer = living.find((f) => f.role === 'seer')
    return {
      kill: this.nightAction(view(wolf), options(living.filter((f) => f.role !== 'werewolf'))),
      protect: doctor ? this.nightAction(view(doctor), options(living)) : null,
      inspect: seer ? this.nightAction(view(seer), options(living.filter((f) => f.id !== seer.id))) : null,
      minds: living.map((f) => this.mind(view(f))),
    }
  }

  async playDay(world: WorldView): Promise<DayScript> {
    const living = world.fruits.filter((f) => f.alive)
    const nameOf = (id: string) => world.fruits.find((f) => f.id === id)?.name ?? id
    // The log grows as the day is written, so later speakers react to earlier ones.
    const log = [...world.publicLog]
    const view = (f: FruitState) => this.view(world, f, log)

    const plans = living.map((f) => ({ id: f.id, ...this.planDay(view(f)) }))

    const discussion: DayScript['discussion'] = []
    const turns = clamp(Math.round(living.length * 1.7), 5, 14)
    let last = ''
    for (let i = 0; i < turns; i++) {
      // Chattier fruits get the floor more often.
      const pool = living.filter((f) => f.id !== last)
      let roll = Math.random() * pool.reduce((sum, f) => sum + 0.25 + f.traits.talkativeness, 0)
      const speaker = pool.find((f) => (roll -= 0.25 + f.traits.talkativeness) <= 0) ?? pool[0]
      last = speaker.id
      const say = this.speak(view(speaker))
      discussion.push({ id: speaker.id, say })
      log.push(`${speaker.name}: ${say}`)
    }

    const votes: DayScript['votes'] = []
    for (const f of living) {
      const choice = this.vote(view(f))
      votes.push({ id: f.id, ...choice })
      log.push(`${f.name}: I vote ${nameOf(choice.target)}.`)
    }
    return { plans, discussion, votes }
  }
}
