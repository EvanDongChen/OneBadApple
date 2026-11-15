import type { Brain, DayScript, FruitState, NightScript, WorldView } from './types'

type Other = { id: string; name: string }

/** What one fruit is allowed to know when it decides something. */
interface AgentView {
  self: FruitState
  /** Living fruits other than self. */
  others: Other[]
  publicLog: string[]
}

interface DayPlan {
  approach: string
  line: string
}

interface Speech {
  say: string
}

interface Choice {
  target: string
  reason: string
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function best<T>(items: T[], score: (item: T) => number): T {
  return items.reduce((a, b) => (score(b) > score(a) ? b : a))
}

const ACCUSE_HARSH = [
  "It's {x}. I'd bet my stem on it.",
  '{x}, you are rotten to the core and everyone can smell it.',
  'Stop wasting daylight. {x} is the wolf.',
  "Look at {x} squirm. That's guilt.",
]
const ACCUSE_MILD = [
  "I don't want to point fingers, but {x} seems a little off.",
  'Has anyone else noticed {x} acting strange?',
  "I could be wrong, but I'd keep an eye on {x}.",
  'Something about {x} is bruising my trust.',
]
const DEFEND_HARSH = [
  "Me? That's rich coming from {x}.",
  "Accuse me again, {x}, and see what happens.",
  '{x} is pointing at me so nobody looks at them.',
]
const DEFEND_MILD = [
  "Please, {x}, I'm just a normal fruit. I was asleep.",
  "I understand why you'd wonder, {x}, but it isn't me.",
  "I promise I'm innocent. Ask anyone.",
]
const IDLE = [
  "I don't have anything solid yet.",
  'Can we all stay calm and stay juicy?',
  "I'm just listening for now.",
  'Honestly, I have no idea who it is.',
]
const EXTRA = [
  'Think about it.',
  "I've been watching all morning.",
  "And I won't be quiet about it.",
  'Mark my words.',
  'That is all I am saying. For now.',
]
const CONFRONT = ["I've got my eye on you, {x}.", 'Where were you last night, {x}?', "Don't think I haven't noticed, {x}."]
const GOSSIP = ['Psst. Do you trust {y}?', "Between us, I think it's {y}.", 'Stick with me today. {y} worries me.']

/**
 * The non-AI brain. No network: every decision is computed from the fruit's
 * personality sliders and what it has seen, so different traits play differently.
 *
 * - suspicion: how readily it acts on hunches and thin evidence
 * - aggression: how hard it retaliates against accusers, and how harshly it talks
 * - honesty: whether it shares what it truly knows, or bluffs and invents claims
 * - talkativeness: how much it says (the engine also gives chatty fruits more turns)
 */
export class MockBrain implements Brain {
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
    return view.publicLog.filter((line) => line.startsWith(`${speaker}:`) && line.slice(speaker.length).includes(subject)).length
  }

  /** How much this fruit wants `other` gone, given its personality. */
  private suspicionOf(view: AgentView, other: Other): number {
    const { traits, role, name } = view.self
    if (this.isPackmate(view, other)) return -100
    if (this.knownWolf(view, other)) return 50
    if (this.knownInnocent(view, other)) return -20

    // Heat: how often the rest of the village has named them.
    const heat = view.others
      .filter((o) => o.id !== other.id)
      .reduce((sum, o) => sum + this.mentions(view, o.name, other.name), 0)
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

  /** Who (if anyone) accused this fruit in the last few public lines. */
  private recentAccuser(view: AgentView): Other | undefined {
    const recent = view.publicLog.slice(-4)
    return view.others.find((o) => recent.some((line) => line.startsWith(`${o.name}:`) && line.includes(view.self.name)))
  }

  private phrase(templates: string[], x: Other, y?: Other) {
    return pick(templates).replaceAll('{x}', x.name).replaceAll('{y}', (y ?? x).name)
  }

  async planDay(view: AgentView): Promise<DayPlan> {
    const suspect = this.topSuspect(view)
    // Aggressive fruits march up to their suspect; gentler ones go gossip with someone they trust.
    if (Math.random() < view.self.traits.aggression) {
      return { approach: suspect.id, line: this.phrase(CONFRONT, suspect) }
    }
    const ally = this.mostTrusted(view)
    return { approach: ally.id, line: this.phrase(GOSSIP, ally, suspect.id === ally.id ? pick(view.others) : suspect) }
  }

  async speak(view: AgentView): Promise<Speech> {
    const { traits, role } = view.self
    const harsh = Math.random() < traits.aggression
    const accuser = this.recentAccuser(view)
    const suspect = this.topSuspect(view)
    let line: string

    const seerFind = view.others.find((o) => this.knownWolf(view, o))
    if (seerFind && Math.random() < 0.3 + traits.honesty * 0.7) {
      // An honest seer shares what it saw.
      line = `I am the seer. I looked at ${seerFind.name} last night and saw a werewolf.`
    } else if (role === 'werewolf' && Math.random() > traits.honesty && Math.random() < 0.5) {
      // A dishonest wolf invents evidence against an innocent.
      line = `I saw ${suspect.name} sneaking around the huts last night. Explain that.`
    } else if (accuser && Math.random() < 0.7) {
      line = this.phrase(harsh ? DEFEND_HARSH : DEFEND_MILD, accuser)
    } else if (Math.random() < 0.25 + traits.suspicion * 0.6 + traits.aggression * 0.2) {
      line = this.phrase(harsh ? ACCUSE_HARSH : ACCUSE_MILD, suspect)
    } else {
      line = pick(IDLE)
    }

    if (Math.random() < traits.talkativeness * 0.8) line += ` ${pick(EXTRA)}`
    return { say: line }
  }

  async vote(view: AgentView): Promise<Choice> {
    const target = this.topSuspect(view)
    const harsh = Math.random() < view.self.traits.aggression
    const reason = this.knownWolf(view, target)
      ? 'I know what I saw.'
      : this.mentions(view, target.name, view.self.name) > 0 && harsh
        ? 'Nobody accuses me and walks away.'
        : harsh
          ? 'Good riddance.'
          : 'Sorry. Just a feeling.'
    return { target: target.id, reason }
  }

  async nightAction(view: AgentView, candidates: Other[]): Promise<Choice> {
    const { role, traits, id } = view.self
    if (role === 'werewolf') {
      // Silence anyone claiming to be the seer, otherwise whoever threatens the pack most.
      const claimedSeer = candidates.find((c) => view.publicLog.some((l) => l.startsWith(`${c.name}: I am the seer`)))
      const target = claimedSeer ?? best(candidates, (c) => this.suspicionOf(view, c))
      return { target: target.id, reason: '' }
    }
    if (role === 'seer') {
      // Check the biggest suspect not already inspected.
      const fresh = candidates.filter((c) => !this.knownWolf(view, c) && !this.knownInnocent(view, c))
      const pool = fresh.length ? fresh : candidates
      return { target: best(pool, (c) => this.suspicionOf(view, c)).id, reason: '' }
    }
    // Doctor: a selfish (dishonest) doctor guards itself; otherwise it guards whoever it trusts most.
    const others = candidates.filter((c) => c.id !== id)
    const selfish = Math.random() > traits.honesty * 0.8 + 0.1
    const target = selfish || !others.length ? candidates.find((c) => c.id === id) ?? pick(candidates) : best(others, (c) => -this.suspicionOf(view, c))
    return { target: target.id, reason: '' }
  }

  private view(world: WorldView, self: FruitState, publicLog: string[]): AgentView {
    return {
      self,
      others: world.fruits.filter((f) => f.alive && f.id !== self.id).map((f) => ({ id: f.id, name: f.name })),
      publicLog,
    }
  }

  /** One fruit's inner state, derived from the same scoring its decisions use. */
  private mind(view: AgentView): NightScript['minds'][number] {
    const feelings = view.others.map((o) => {
      const grudge = this.mentions(view, o.name, view.self.name)
      const note = this.isPackmate(view, o)
        ? 'Pack.'
        : this.knownWolf(view, o)
          ? 'I saw it. Werewolf.'
          : this.knownInnocent(view, o)
            ? 'I checked. Clean.'
            : grudge > 0
              ? 'Accused me.'
              : ''
      return { about: o.id, trust: clamp(Math.round(2 - this.suspicionOf(view, o) * 1.5), -5, 5), note }
    })
    const worst = feelings.reduce((a, b) => (b.trust < a.trust ? b : a), feelings[0])
    const worstName = view.others.find((o) => o.id === worst?.about)?.name
    return {
      id: view.self.id,
      thought: !worstName ? '' : view.self.role === 'werewolf' ? `If I can pin this on ${worstName}, I'm safe.` : `I don't trust ${worstName}.`,
      feelings,
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
      kill: (await this.nightAction(view(wolf), options(living.filter((f) => f.role !== 'werewolf')))).target,
      protect: doctor ? (await this.nightAction(view(doctor), options(living))).target : null,
      inspect: seer ? (await this.nightAction(view(seer), options(living.filter((f) => f.id !== seer.id)))).target : null,
      minds: living.map((f) => this.mind(view(f))),
    }
  }

  async playDay(world: WorldView): Promise<DayScript> {
    const living = world.fruits.filter((f) => f.alive)
    const nameOf = (id: string) => world.fruits.find((f) => f.id === id)?.name ?? id
    // The log grows as the day is written, so later speakers react to earlier ones.
    const log = [...world.publicLog]
    const view = (f: FruitState) => this.view(world, f, log)

    const plans: DayScript['plans'] = []
    for (const f of living) plans.push({ id: f.id, ...(await this.planDay(view(f))) })

    const discussion: DayScript['discussion'] = []
    const turns = clamp(Math.round(living.length * 1.5), 4, 12)
    let last = ''
    for (let i = 0; i < turns; i++) {
      // Chattier fruits get the floor more often.
      const pool = living.filter((f) => f.id !== last)
      let roll = Math.random() * pool.reduce((sum, f) => sum + 0.25 + f.traits.talkativeness, 0)
      const speaker = pool.find((f) => (roll -= 0.25 + f.traits.talkativeness) <= 0) ?? pool[0]
      last = speaker.id
      const { say } = await this.speak(view(speaker))
      discussion.push({ id: speaker.id, say })
      log.push(`${speaker.name}: ${say}`)
    }

    const votes: DayScript['votes'] = []
    for (const f of living) {
      const choice = await this.vote(view(f))
      votes.push({ id: f.id, ...choice })
      log.push(`${f.name}: I vote ${nameOf(choice.target)}.`)
    }
    return { plans, discussion, votes }
  }
}
