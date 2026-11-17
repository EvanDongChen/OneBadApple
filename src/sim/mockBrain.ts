import * as D from './dialog'
import { absorb, cloneMind, episodesOf, evidence, suspectedBy, trustOf } from './mind'
import { presetOf } from './quirks'
import type { Brain, Conversation, DayScript, Episode, FruitState, NightScript, WorldView } from './types'

type Named = { name: string }

/** What a spoken line was doing, so the next speaker can react to it and the listeners can remember it. */
interface Said {
  tone: 'accuse' | 'vouch' | 'plea' | 'friendly'
  /** Who the line was about, if anyone. */
  about?: string
  /** A statement about a night: "I saw Pip out", or (saw: null) "I slept through it". */
  claim?: { night: number; saw: string | null }
}

/** Something the dead might have an opinion on. */
export type GhostEvent = 'death' | 'saved' | 'ballot-wrong' | 'ballot-right' | 'out-wrong' | 'out-right' | 'tie' | 'whisper' | 'apology'

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
 * The no-AI brain. No network: every decision comes from the fruit's own mind (see mind.ts)
 * and its personality, so different fruits play differently. Lines come from dialog.ts.
 *
 * - beliefs decide who it suspects, accuses, confronts and votes for
 * - memory lets it quote specific events back at other fruits
 * - its read of who suspects IT sends it looking for allies before the vote
 * - its personal goal, mood and way of thinking bend all of the above
 * - a werewolf's lies about each night are tracked, and a careless one contradicts itself
 *
 * A whole day is planned in one go on scratch copies of every fruit, which are updated
 * with each planned line exactly as the real fruits will be when the line is spoken.
 */
export class MockBrain implements Brain {
  /** Templates already used this game, so lines don't repeat until a pool runs dry. */
  private used = new Set<string>()
  /** For each werewolf, the fruit it first claimed to have seen on each night. */
  private lies = new Map<string, Map<number, string>>()
  /** Whether each werewolf is the careless kind that forgets its own story. */
  private sloppy = new Map<string, boolean>()
  /** Lies already called out, as "catcher:liar", so a fruit only springs it once. */
  private voiced = new Set<string>()

  private line(pool: string[], x?: Named, y?: Named, dead?: string, n?: number): string {
    const fresh = pool.filter((t) => !this.used.has(t))
    const template = pick(fresh.length ? fresh : pool)
    this.used.add(template)
    return (
      template
        // With no {x} given, drop the name and its commas ("I trust you, {x}." becomes "I trust you.").
        .replace(/,?\s*\{x\},?/g, (m) => (x ? m.replace('{x}', x.name) : ''))
        .replaceAll('{y}', (y ?? x)?.name ?? '')
        .replaceAll('{d}', dead ?? '')
        .replaceAll('{n}', n === undefined ? '' : String(n))
    )
  }

  // ---------- Personality ----------

  /** Does this fruit have one of these preset quirks? */
  private is(fruit: FruitState, ...quirks: string[]) {
    return quirks.some((q) => fruit.traits.quirks.includes(q))
  }

  /** Whether the fruit goes for the harsh version of a line. Quirks and anger push this up or down. */
  private harsh(fruit: FruitState) {
    const push = (this.is(fruit, 'sassy', 'grumpy') ? 0.3 : 0) + (this.is(fruit, 'royal') ? 0.15 : 0) - (this.is(fruit, 'polite', 'cheerful') ? 0.35 : 0)
    return Math.random() < fruit.traits.aggression + push + fruit.mood.anger * 0.4
  }

  /** Idle chat: a stock pleasantry, or now and then the fruit's own backstory. */
  private smallTalk(fruit: FruitState, pool: string[]): string {
    const { backstory } = fruit.traits
    return backstory && Math.random() < 0.3 ? this.line(D.BACKSTORY_TALK).replace('{b}', backstory) : this.line(pool)
  }

  /** Now and then a fruit's quirk shows: a little phrase of its own on the end of the line. */
  private withTic(fruit: FruitState, say: string): string {
    const tics = fruit.traits.quirks.flatMap((q) => presetOf(q)?.tics ?? [])
    return tics.length && Math.random() < 0.4 ? `${say} ${pick(tics)}` : say
  }

  private isSloppy(wolf: FruitState) {
    if (!this.sloppy.has(wolf.id)) this.sloppy.set(wolf.id, Math.random() < 0.4 + (1 - wolf.traits.suspicion) * 0.5)
    return this.sloppy.get(wolf.id)!
  }

  // ---------- Reading the room ----------

  private pack(self: FruitState, other: FruitState) {
    return self.role === 'werewolf' && other.role === 'werewolf'
  }

  /** How much this fruit wants `other` gone: its belief, bent by its goal, its anger and who is after it. */
  private score(self: FruitState, other: FruitState): number {
    // The jester has no real opinions; it just wants attention.
    if (self.role === 'jester') return Math.random() * 100
    if (this.pack(self, other)) return -1000
    let score = self.beliefs[other.id] ?? 0
    // Goals beyond winning: a friend is spared unless the case is overwhelming, and a grudge counts as evidence.
    if (self.goal.kind === 'protect' && self.goal.target === other.id && score < 85) score -= 30
    if (self.goal.kind === 'revenge' && self.goal.target === other.id) score += 18
    // Theory of mind: a fruit that seems to be after me is a fruit I would like gone, more so when I am angry.
    score += (suspectedBy(self)[other.id] ?? 0) * (0.1 + self.mood.anger * 0.25)
    return score + Math.random() * 3
  }

  private topSuspect(self: FruitState, others: FruitState[]): FruitState {
    return best(others, (o) => this.score(self, o))
  }

  private mostTrusted(self: FruitState, others: FruitState[]): FruitState {
    return best(others, (o) => -this.score(self, o))
  }

  /** The living fruits this one believes suspect it, worst first. */
  private threats(self: FruitState, others: FruitState[]): FruitState[] {
    const by = suspectedBy(self)
    return others.filter((o) => (by[o.id] ?? 0) >= 30).sort((a, b) => by[b.id] - by[a.id])
  }

  /** The strongest thing it remembers against `about`, as a line: to their face, or to someone else. */
  private cite(self: FruitState, about: FruitState, face: boolean, all: FruitState[]): string | undefined {
    const found = evidence(self, about.id, true)
    if (!found) return undefined
    const other = 'other' in found ? all.find((f) => f.id === found.other) : undefined
    const day = 'day' in found ? found.day : undefined
    const pools = {
      caught: [D.FACE_CAUGHT, D.CITE_CAUGHT],
      votedInnocent: [D.FACE_VOTED_INNOCENT, D.CITE_VOTED_INNOCENT],
      defendedWolf: [D.FACE_DEFENDED_WOLF, D.CITE_DEFENDED_WOLF],
      accusedDead: [D.FACE_ACCUSED_DEAD, D.CITE_ACCUSED_DEAD],
      accusedMe: [D.FACE_ACCUSED_ME, D.CITE_ACCUSED_ME],
      votedMe: [D.FACE_VOTED_ME, D.CITE_VOTED_ME],
    } as const
    if (!(found.kind in pools) || ('other' in found && !other)) return undefined
    return this.line(pools[found.kind as keyof typeof pools][face ? 0 : 1], about, other, undefined, day)
  }

  /** Has it caught `other` changing its story and not yet said so? Marks it as said. */
  private springs(self: FruitState, other: FruitState): boolean {
    const key = `${self.id}:${other.id}`
    if (this.voiced.has(key) || !self.events.some((e) => e.kind === 'caught' && e.actor === other.id)) return false
    this.voiced.add(key)
    return true
  }

  /** Name of the fruit most recently killed in the night, as far as this fruit knows. */
  private mourned(self: FruitState, all: FruitState[]): string | undefined {
    const death = [...self.events].reverse().find((e) => e.kind === 'death' && e.by === 'wolf')
    return death && 'target' in death ? all.find((f) => f.id === death.target)?.name : undefined
  }

  // ---------- Talking ----------

  /**
   * A werewolf claims to have seen someone out last night. A careful wolf names the same fruit
   * every time it tells the story; a careless one names whoever suits it now.
   */
  private wolfLie(self: FruitState, partner: FruitState, others: FruitState[], day: number): [string, Said] | undefined {
    const mine = this.lies.get(self.id) ?? new Map<number, string>()
    this.lies.set(self.id, mine)
    const told = mine.get(day)
    const options = others.filter((o) => o.id !== partner.id && o.role !== 'werewolf')
    if (!options.length) return undefined
    const fresh = this.topSuspect(self, options)
    let saw = options.find((o) => o.id === told)
    if (told && !saw && !this.isSloppy(self)) return undefined
    if (!saw || (this.isSloppy(self) && fresh.id !== saw.id && Math.random() < 0.8)) saw = fresh
    if (!told) mine.set(day, saw.id)
    return [this.line(D.WOLF_SAW, saw), { tone: 'accuse', about: saw.id, claim: { night: day, saw: saw.id } }]
  }

  /** Opening line of a conversation, said to `partner`. */
  private opener(self: FruitState, partner: FruitState, others: FruitState[], world: WorldView): [string, Said] {
    const { traits, role } = self
    const all = world.fruits
    const suspect = this.topSuspect(self, others)
    const found = role === 'werewolf' ? undefined : others.find((o) => self.beliefs[o.id] === 100)

    if (role === 'jester' && Math.random() < 0.5) return [this.line(D.JESTER), { tone: 'friendly' }]
    if (found && found.id !== partner.id && Math.random() < 0.3 + traits.honesty * 0.7) {
      // An honest seer shares what it saw.
      return [this.line(D.SEER_REVEAL, found), { tone: 'accuse', about: found.id }]
    }
    // Caught this fruit telling two stories: say so to its face.
    if (this.springs(self, partner)) return [this.line(D.FACE_CAUGHT, partner), { tone: 'accuse', about: partner.id }]

    // Theory of mind: someone has it in for me, so sound out a possible ally before the vote.
    const threats = this.threats(self, others)
    if (threats.length && !threats.includes(partner) && (self.beliefs[partner.id] ?? 0) < 55 && Math.random() < 0.65) {
      return [this.line(D.ALLY_PLEA, partner, threats[0]), { tone: 'plea', about: threats[0].id }]
    }
    // A dishonest wolf invents a sighting.
    if (role === 'werewolf' && Math.random() > traits.honesty && Math.random() < 0.7) {
      const lie = this.wolfLie(self, partner, others, world.day)
      if (lie) return lie
    }
    if (suspect.id === partner.id) {
      // Face to face with its own suspect: the bold and the angry confront, the timid and the scared play nice.
      const bold = Math.random() < traits.aggression + 0.15 + self.mood.anger * 0.4 - self.mood.fear * 0.3
      if (bold) return [this.cite(self, partner, true, all) ?? this.line(D.CONFRONT, partner), { tone: 'accuse', about: partner.id }]
      return [this.smallTalk(self, D.ALLY), { tone: 'friendly' }]
    }
    // Grief fixes on whoever it blames.
    const dead = this.mourned(self, all)
    if (self.mood.grief > 0.4 && dead) return [this.line(D.GRIEF_TALK, suspect, undefined, dead), { tone: 'accuse', about: suspect.id }]
    // Smugness: it voted for a wolf and wants everyone to know.
    if (self.mood.smug > 0.4 && role !== 'werewolf') {
      const win = [...self.events].reverse().find((e) => e.kind === 'death' && e.by === 'vote' && e.role === 'werewolf')
      const wolf = win && 'target' in win ? all.find((f) => f.id === win.target) : undefined
      if (wolf && Math.random() < 0.6) return [this.line(D.TOLD_YOU, undefined, wolf), { tone: 'friendly' }]
    }
    // Gossips spread rumours at every chance; know-it-alls and detectives like to share a theory.
    const chatty = (this.is(self, 'gossip') ? 0.4 : 0) + (this.is(self, 'know-it-all', 'detective') ? 0.2 : 0)
    if (Math.random() < 0.35 + traits.suspicion * 0.6 + chatty - self.mood.fear * 0.3) {
      // Quote something it actually remembers, if it has anything.
      const quoted = Math.random() < 0.7 ? this.cite(self, suspect, false, all) : undefined
      return [quoted ?? this.line(D.GOSSIP, partner, suspect), { tone: 'accuse', about: suspect.id }]
    }
    if (dead && Math.random() < 0.3) return [this.line(D.MOURN, undefined, undefined, dead), { tone: 'friendly' }]
    return [this.smallTalk(self, D.ALLY), { tone: 'friendly' }]
  }

  /** A reply inside a conversation, reacting to what `speaker` just said. */
  private reply(self: FruitState, speaker: FruitState, last: Said, others: FruitState[], world: WorldView): [string, Said] {
    const { traits, role, id } = self
    const all = world.fruits
    const harsh = this.harsh(self)
    const accused = last.tone === 'accuse' && last.about === id
    const subject = others.find((o) => o.id === last.about)
    const lie = role === 'werewolf' && !accused && last.tone !== 'plea' && Math.random() > traits.honesty && Math.random() < 0.45 ? this.wolfLie(self, speaker, others, world.day) : undefined
    let out: [string, Said]

    if (role === 'jester' && Math.random() < 0.4) {
      out = [this.line(D.JESTER), { tone: 'friendly' }]
    } else if (this.springs(self, speaker)) {
      // It has just heard this fruit contradict an earlier story.
      out = [this.line(D.FACE_CAUGHT, speaker), { tone: 'accuse', about: speaker.id }]
    } else if (last.tone === 'plea') {
      // Asked to stand with them at the vote.
      const willing = (self.beliefs[speaker.id] ?? 50) < 40 || (self.goal.kind === 'protect' && self.goal.target === speaker.id)
      out = willing ? [this.line(D.PLEA_YES), { tone: 'vouch', about: speaker.id }] : [this.line(D.PLEA_NO), { tone: 'friendly' }]
    } else if (lie) {
      out = lie
    } else if (this.is(self, 'sleepy') && !accused && Math.random() < 0.35) {
      // Too drowsy to follow the argument.
      out = [this.smallTalk(self, D.SMALL_TALK), { tone: 'friendly' }]
    } else if (accused) {
      // I was just accused to my face.
      if (role === 'werewolf' && this.isSloppy(self) && this.lies.get(id)?.has(world.day) && Math.random() < 0.4) {
        // A careless wolf forgets it claimed to have been up and about last night.
        out = [this.line(D.WOLF_SLIP), { tone: 'friendly', claim: { night: world.day, saw: null } }]
      } else if (self.mood.fear > 0.5 && !harsh) {
        out = [this.line(D.DEFEND_SCARED), { tone: 'friendly' }]
      } else {
        const quoted = Math.random() < 0.4 ? this.cite(self, speaker, true, all) : undefined
        out = [quoted ?? this.line(harsh ? D.DEFEND_HARSH : D.DEFEND_MILD, speaker), { tone: 'accuse', about: speaker.id }]
      }
    } else if (last.tone === 'accuse' && subject) {
      // They named a third fruit: back them up, stand up for the fruit, or sit on the fence.
      const belief = self.beliefs[subject.id] ?? 0
      const accusers = new Set(self.events.filter((e) => e.kind === 'accuse' && e.target === subject.id).map((e) => ('actor' in e ? e.actor : '')))
      const friend = self.goal.kind === 'protect' && self.goal.target === subject.id
      if (belief === 0 && role !== 'werewolf') out = [this.line(D.SEER_CLEAR, subject), { tone: 'vouch', about: subject.id }]
      else if (this.pack(self, subject) || friend || (subject.id === this.mostTrusted(self, others).id && Math.random() < 0.3 + traits.honesty * 0.4)) {
        out = [this.line(D.VOUCH, subject), { tone: 'vouch', about: subject.id }]
      } else if (traits.temper === 'contrarian' && accusers.size >= 2) {
        // Everyone is saying it, which is exactly why this fruit will not.
        out = [this.line(D.CONTRARY, subject), { tone: 'vouch', about: subject.id }]
      } else if (belief >= 55 || subject.id === this.topSuspect(self, others).id || (traits.temper === 'gullible' && Math.random() < 0.7) || Math.random() < traits.suspicion * 0.5) {
        out = [this.line(D.AGREE, subject), { tone: 'accuse', about: subject.id }]
      } else out = [this.line(D.UNSURE, subject), { tone: 'friendly' }]
    } else if (Math.random() < 0.3 + traits.suspicion * 0.5 + (this.is(self, 'detective', 'know-it-all', 'paranoid') ? 0.25 : 0) + self.mood.anger * 0.3 - self.mood.fear * 0.25) {
      // Nothing to react to: bring up its own suspicion, with a memory to back it if it has one.
      const suspect = this.topSuspect(self, others)
      const face = suspect.id === speaker.id
      const quoted = Math.random() < 0.7 ? this.cite(self, suspect, face, all) : undefined
      out = [quoted ?? (face ? this.line(D.CONFRONT, speaker) : this.line(harsh ? D.ACCUSE_HARSH : D.ACCUSE_MILD, suspect)), { tone: 'accuse', about: suspect.id }]
    } else {
      out = [this.smallTalk(self, D.SMALL_TALK), { tone: 'friendly' }]
    }

    // Sleepy and frightened fruits rarely add anything; gossips and drama queens can't help themselves.
    const more = traits.talkativeness * 0.5 * (this.is(self, 'sleepy') ? 0.3 : 1) * (1 - self.mood.fear * 0.6) + (this.is(self, 'gossip', 'dramatic') ? 0.2 : 0)
    if (Math.random() < more) out[0] += ` ${this.line(D.EXTRA)}`
    return out
  }

  /** Split the living into pairs (one trio if the count is odd), each fruit seeking out who it wants to talk to. */
  private groupUp(living: FruitState[], met: Set<string>): FruitState[][] {
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
      const others = living.filter((f) => f.id !== fruit.id)
      // The aggressive, the grieving and detectives go and find their suspect. A fruit that
      // feels hunted, and gentler ones, go and find a friend.
      const hunted = this.threats(fruit, others).length > 0
      const seeks = Math.random() < fruit.traits.aggression + (this.is(fruit, 'detective') ? 0.5 : 0) + fruit.mood.grief * 0.5 - (hunted ? 0.4 : 0)
      const wanted = seeks ? this.topSuspect(fruit, others) : this.mostTrusted(fruit, others)
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
  private converse(world: WorldView, members: FruitState[], living: FruitState[]): Conversation {
    const lines: Conversation['lines'] = []
    let last: Said = { tone: 'friendly' }
    const turns = members.length === 2 ? 4 : 5
    for (let t = 0; t < turns; t++) {
      const speaker = members[t % members.length]
      const previous = members[(t + members.length - 1) % members.length]
      const next = members[(t + 1) % members.length]
      const others = living.filter((f) => f.id !== speaker.id)
      const [plain, meta] = t === 0 ? this.opener(speaker, next, others, world) : this.reply(speaker, previous, last, others, world)
      last = meta
      const line = {
        id: speaker.id,
        say: this.withTic(speaker, plain),
        accuses: meta.tone === 'accuse' ? meta.about : undefined,
        vouches: meta.tone === 'vouch' ? meta.about : undefined,
        claim: meta.claim,
      }
      lines.push(line)
      // Everyone in the group remembers the line, exactly as they will when it is really spoken.
      for (const episode of episodesOf(line, world.day)) members.forEach((m) => absorb(m, episode))
    }
    return { members: members.map((m) => m.id), lines }
  }

  // ---------- Voting ----------

  private vote(self: FruitState, others: FruitState[], tally: Map<string, number>, world: WorldView): { target: string; reason: string; claim?: Said['claim'] } {
    const own = this.topSuspect(self, others)
    const allowed = (o: FruitState) => !this.pack(self, o) && !(self.goal.kind === 'protect' && self.goal.target === o.id)
    const leader = others.filter((o) => allowed(o) && tally.get(o.id)).sort((a, b) => tally.get(b.id)! - tally.get(a.id)!)[0]
    const hunted = this.threats(self, others).length > 0
    const afraid = self.mood.fear > 0.5
    const guilty = self.mood.guilt > 0.4 && self.role !== 'werewolf'
    // The frightened, the guilty, the gullible and those just trying to stay alive go with the crowd.
    const follows =
      !!leader && leader.id !== own.id && self.role !== 'jester' && (afraid || guilty || (self.goal.kind === 'survive' && hunted) || (self.traits.temper === 'gullible' && tally.get(leader.id)! >= 2))
    let target = follows ? leader : own
    // A contrarian will not pile onto a fruit the whole village has already picked.
    if (self.traits.temper === 'contrarian' && !follows && (tally.get(target.id) ?? 0) >= 3) {
      const rest = others.filter((o) => o.id !== target.id && allowed(o))
      if (rest.length) target = this.topSuspect(self, rest)
    }

    const belief = Math.round(self.beliefs[target.id] ?? 0)
    const harsh = this.harsh(self)
    let reason: string
    let claim: Said['claim']
    // A dishonest wolf backs its vote with a sighting, in front of everyone. A careful one only does
    // so if it fits the story it has already told; a careless one says it anyway, and may be caught out.
    const story = this.lies.get(self.id) ?? new Map<number, string>()
    const told = story.get(world.day)
    const lies = self.role === 'werewolf' && !follows && Math.random() > self.traits.honesty * 0.7 && (told === undefined || told === target.id || this.isSloppy(self))
    if (lies) {
      if (told === undefined) this.lies.set(self.id, story.set(world.day, target.id))
      reason = this.line(D.WOLF_SAW, target)
      claim = { night: world.day, saw: target.id }
    } else if (guilty) reason = this.line(D.VOTE_GUILT)
    else if (follows && afraid) reason = this.line(D.VOTE_AFRAID)
    else if (follows) reason = this.line(D.VOTE_FOLLOW)
    else if (belief === 100) reason = this.line(D.VOTE_KNOWN)
    else {
      reason = this.cite(self, target, true, world.fruits) ?? this.line((suspectedBy(self)[target.id] ?? 0) >= 30 && harsh ? D.VOTE_GRUDGE : harsh ? D.VOTE_HARSH : D.VOTE_MILD)
      // Confidence, out loud.
      if (self.role !== 'werewolf' && self.role !== 'jester' && belief >= 60 && Math.random() < 0.4) reason += ` I am ${belief}% sure.`
    }
    return { target: target.id, reason: this.withTic(self, reason), claim }
  }

  /** What a fruit cries out if it is the one voted out. */
  private lastCry(fruit: FruitState): string {
    if (fruit.role === 'werewolf') return this.line(D.LAST_WOLF)
    if (fruit.role === 'jester') return this.line(D.LAST_JESTER)
    return this.line(Math.random() < fruit.traits.aggression + fruit.mood.anger * 0.4 ? D.LAST_CURSE : D.LAST_PLEA)
  }

  async playDay(world: WorldView): Promise<DayScript> {
    // Scratch copies: the day is planned on these, so later lines and votes build on earlier ones.
    const living = world.fruits.filter((f) => f.alive).map(cloneMind)
    const met = new Set<string>()

    const rounds: Conversation[][] = []
    for (let r = 0; r < world.rules.rounds; r++) {
      rounds.push(this.groupUp(living, met).map((members) => this.converse(world, members, living)))
    }

    // Votes are public and cast in order, so later voters see how it is going.
    const votes: DayScript['votes'] = []
    const tally = new Map<string, number>()
    for (const fruit of living) {
      const choice = this.vote(
        fruit,
        living.filter((f) => f.id !== fruit.id),
        tally,
        world,
      )
      votes.push({ id: fruit.id, ...choice, lastWords: this.lastCry(fruit) })
      tally.set(choice.target, (tally.get(choice.target) ?? 0) + 1)
      const episodes: Episode[] = [{ kind: 'vote', day: world.day, actor: fruit.id, target: choice.target }]
      if (choice.claim) episodes.push({ kind: 'claim', day: world.day, actor: fruit.id, ...choice.claim })
      for (const episode of episodes) living.forEach((f) => absorb(f, episode))
    }
    return { rounds, votes }
  }

  // ---------- Night ----------

  /** The pack's whispered argument over the victim. It always ends on the lead wolf's choice. */
  private wolfChat(wolves: FruitState[], picks: FruitState[], lead: number): NightScript['wolfChat'] {
    const other = lead === 0 ? 1 : 0
    const target = picks[lead]
    const lines = [{ id: wolves[other].id, say: this.line(D.WOLF_PROPOSE, picks[other]) }]
    if (picks[other].id === target.id) {
      lines.push({ id: wolves[lead].id, say: this.line(D.WOLF_AGREE, target) })
    } else {
      lines.push({ id: wolves[lead].id, say: this.line(D.WOLF_COUNTER, target) })
      lines.push({ id: wolves[other].id, say: this.line(D.WOLF_GIVE_IN, target) })
    }
    lines.push({ id: wolves[lead].id, say: this.line(D.WOLF_SETTLE, target) })
    return lines
  }

  /** One fruit's inner state for the mind reader: a thought, and how it feels about everyone else. */
  private mind(self: FruitState, others: FruitState[]): NightScript['minds'][number] {
    const wolf = self.role === 'werewolf'
    const feelings = others.map((o) => {
      const belief = self.beliefs[o.id]
      const against = evidence(self, o.id, true)
      const forThem = evidence(self, o.id, false)
      const note = this.pack(self, o)
        ? 'Pack.'
        : belief === 100
          ? 'I saw it. Werewolf.'
          : belief === 0
            ? 'I checked. Clean.'
            : self.goal.kind === 'protect' && self.goal.target === o.id
              ? 'My friend.'
              : self.goal.kind === 'revenge' && self.goal.target === o.id
                ? 'We have history.'
                : against?.kind === 'caught'
                  ? 'Its story changed.'
                  : against?.kind === 'votedInnocent'
                    ? 'Voted out an innocent.'
                    : against?.kind === 'defendedWolf'
                      ? 'Stood up for a wolf.'
                      : against?.kind === 'accusedMe' || against?.kind === 'votedMe'
                        ? 'Came after me.'
                        : against?.kind === 'accusedDead'
                          ? 'Named the victim.'
                          : forThem?.kind === 'votedWolf'
                            ? 'Voted for a real wolf.'
                            : forThem?.kind === 'defendedMe'
                              ? 'Stood by me.'
                              : ''
      return { about: o.id, trust: this.pack(self, o) ? 5 : trustOf(belief), note }
    })

    // The thought is whatever is weighing on it most.
    let thought = ''
    if (others.length && self.role !== 'jester') {
      const suspect = this.topSuspect(self, others)
      const liar = others.find((o) => self.events.some((e) => e.kind === 'caught' && e.actor === o.id))
      const threat = this.threats(self, others)[0]
      const goal = self.goal
      const target = 'target' in goal ? others.find((o) => o.id === goal.target) : undefined
      const belief = Math.round(self.beliefs[suspect.id] ?? 0)
      if (liar && !wolf) thought = this.line(D.THOUGHT_CAUGHT, liar)
      else if (self.mood.grief > 0.4) thought = this.line(D.THOUGHT_GRIEF, suspect)
      else if (self.mood.guilt > 0.4 && !wolf) thought = this.line(D.THOUGHT_GUILT)
      else if (threat) thought = this.line(D.THOUGHT_THREAT, threat)
      else if (goal.kind === 'protect' && target && Math.random() < 0.6) thought = this.line(D.THOUGHT_PROTECT, target)
      else if (goal.kind === 'revenge' && target && Math.random() < 0.6) thought = this.line(D.THOUGHT_REVENGE, target)
      else if (goal.kind === 'survive' && Math.random() < 0.5) thought = this.line(D.THOUGHT_SURVIVE)
      else if (wolf) thought = this.line(D.THOUGHT_WOLF, suspect)
      else thought = belief >= 50 ? this.line(D.THOUGHT_SURE, suspect, undefined, undefined, belief) : this.line(D.THOUGHT_VILLAGER, suspect)
    }
    return { id: self.id, thought, feelings }
  }

  async playNight(world: WorldView): Promise<NightScript> {
    const living = world.fruits.filter((f) => f.alive)
    const without = (f: FruitState) => living.filter((o) => o.id !== f.id)
    const wolves = living.filter((f) => f.role === 'werewolf')
    const prey = living.filter((f) => f.role !== 'werewolf')
    const doctor = living.find((f) => f.role === 'doctor')
    const seer = living.find((f) => f.role === 'seer')
    const hunter = living.find((f) => f.role === 'hunter')

    // Each wolf wants rid of whoever it thinks is on to it, but will not touch a friend if it can help it.
    const picks = wolves.map((wolf) => {
      const spared = prey.filter((p) => !(wolf.goal.kind === 'protect' && wolf.goal.target === p.id))
      const by = suspectedBy(wolf)
      return best(spared.length ? spared : prey, (p) => (wolf.beliefs[p.id] ?? 0) + (by[p.id] ?? 0) * 0.6 + Math.random() * 3)
    })
    // The most aggressive wolf gets its way.
    const lead = wolves.indexOf(best(wolves, (w) => w.traits.aggression))

    let protect: string | null = null
    if (doctor) {
      const others = without(doctor)
      const friend = doctor.goal.kind === 'protect' ? others.find((o) => 'target' in doctor.goal && o.id === doctor.goal.target) : undefined
      // A doctor guards its friend if it has one. Otherwise a selfish (dishonest) one guards itself,
      // and an honest one guards whoever it trusts most.
      const selfish = Math.random() > doctor.traits.honesty * 0.8 + 0.1 || doctor.goal.kind === 'survive'
      protect = friend ? friend.id : selfish || !others.length ? doctor.id : this.mostTrusted(doctor, others).id
    }

    let inspect: string | null = null
    if (seer) {
      // Check the biggest suspect not already inspected.
      const others = without(seer)
      const unknown = others.filter((o) => seer.beliefs[o.id] !== 0 && seer.beliefs[o.id] !== 100)
      inspect = best(unknown.length ? unknown : others, (o) => seer.beliefs[o.id] ?? 0).id
    }

    return {
      kill: picks[lead].id,
      wolfChat: wolves.length > 1 ? this.wolfChat(wolves, picks, lead) : undefined,
      protect,
      inspect,
      revenge: hunter ? this.topSuspect(hunter, without(hunter)).id : null,
      fromBeliefs: true,
      minds: living.map((f) => this.mind(f, without(f))),
    }
  }

  // ---------- Stock lines the engine asks for directly ----------

  /** What a ghost thinks of something that just happened. A dead werewolf still roots for the pack. */
  ghostThought(ghost: FruitState, event: GhostEvent, about?: Named): string {
    if (event === 'apology') return this.line(D.GHOST_APOLOGY)
    if (ghost.role === 'werewolf') {
      if (event === 'tie') return this.line(D.GHOST_TIE)
      const bad = event === 'saved' || event === 'ballot-right' || event === 'out-right'
      return this.line(bad ? D.GHOST_WOLF_SORE : D.GHOST_WOLF_GLAD, about)
    }
    const pools: Record<Exclude<GhostEvent, 'apology'>, string[]> = {
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

  /** A guilty fruit saying sorry to the ghost of a fruit it helped vote out. */
  apology(ghost: Named): string {
    return this.line(D.APOLOGY, ghost)
  }

  /** The hunter's last words. */
  lastWords(target: Named): string {
    return this.line(D.HUNTER_SHOT, target)
  }
}
