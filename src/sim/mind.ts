import type { Conversation, Episode, FruitState, Goal, Mood, Temper } from './types'

/**
 * Each fruit's inner life, shared by both brains.
 *
 * - memory: a list of specific things it witnessed (`events`)
 * - beliefs: how sure it is, 0 to 100, that each other fruit is a werewolf
 * - mood: fear, anger, grief, guilt and smugness, which build up from events and fade overnight
 * - goal: something personal it wants besides its side winning
 * - temper: how it changes its mind (in its traits, chosen on the setup screen)
 *
 * Everything here is deterministic. The No AI brain plans a whole day in advance by running
 * these same updates on a scratch copy, so its plan and what later happens on stage agree.
 */

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

export const MOODS = ['fear', 'anger', 'grief', 'guilt', 'smug'] as const

export const TEMPERS: Record<Temper, { label: string; text: string }> = {
  steady: { label: 'Steady', text: 'Weighs what it hears and changes its mind when the evidence does.' },
  stubborn: { label: 'Stubborn', text: 'Makes up its mind early and almost never changes it.' },
  gullible: { label: 'Gullible', text: 'Believes the last thing it was told.' },
  contrarian: { label: 'Contrarian', text: 'Distrusts whatever everyone else agrees on.' },
}

export function emptyMood(): Mood {
  return { fear: 0, anger: 0, grief: 0, guilt: 0, smug: 0 }
}

/** A belief of exactly 0 or 100 is knowledge (a packmate, or what the seer saw) and never moves. */
const known = (belief: number | undefined) => belief === 0 || belief === 100

/** The state a fruit starts the game with. Random, so call it once and keep the result. */
export function startMind(fruit: FruitState, all: FruitState[]): Pick<FruitState, 'beliefs' | 'mood' | 'goal' | 'events'> {
  const others = all.filter((f) => f.id !== fruit.id)
  const wolves = all.filter((f) => f.role === 'werewolf').length
  // With no evidence, every stranger is equally likely to be a wolf. Personality adds a hunch on top.
  const base = (wolves / Math.max(1, others.length)) * 100
  const paranoid = fruit.traits.quirks.includes('paranoid')
  const beliefs: Record<string, number> = {}
  for (const other of others) {
    const packmate = fruit.role === 'werewolf' && other.role === 'werewolf'
    beliefs[other.id] = packmate ? 0 : clamp(Math.round(base + (Math.random() - 0.5) * (10 + fruit.traits.suspicion * 30) + (paranoid ? 10 : 0)), 3, 90)
  }

  // A personal goal: a friend to keep safe, an old grudge, or simply staying alive.
  const strangers = others.filter((o) => !(fruit.role === 'werewolf' && o.role === 'werewolf'))
  const someone = strangers[Math.floor(Math.random() * strangers.length)]
  const roll = Math.random()
  let goal: Goal = { kind: 'truth' }
  if (fruit.role !== 'jester' && someone) {
    if (roll < 0.3) goal = { kind: 'protect', target: someone.id }
    else if (roll < 0.5) goal = { kind: 'revenge', target: someone.id }
    else if (roll < 0.7) goal = { kind: 'survive' }
  }
  if (goal.kind === 'protect') beliefs[goal.target] = Math.min(beliefs[goal.target], 8)
  if (goal.kind === 'revenge') beliefs[goal.target] = clamp(beliefs[goal.target] + 15, 3, 90)
  return { beliefs, mood: emptyMood(), goal, events: [] }
}

/** A copy that can be changed without touching the original. */
export function cloneMind(fruit: FruitState): FruitState {
  return { ...fruit, beliefs: { ...fruit.beliefs }, mood: { ...fruit.mood }, goal: { ...fruit.goal }, events: [...fruit.events] }
}

/** What a spoken line gives its listeners to remember. */
export function episodesOf(line: Conversation['lines'][number], day: number): Episode[] {
  const out: Episode[] = []
  // Saying you saw someone out at night is itself an accusation, so it is not counted twice.
  if (line.claim) out.push({ kind: 'claim', day, actor: line.id, night: line.claim.night, saw: line.claim.saw })
  else if (line.accuses) out.push({ kind: 'accuse', day, actor: line.id, target: line.accuses })
  if (line.vouches) out.push({ kind: 'vouch', day, actor: line.id, target: line.vouches })
  return out
}

const distinct = (ids: string[]) => [...new Set(ids)]

/**
 * A fruit witnesses something: it goes into its memory and shifts its beliefs and mood.
 * Changes `self` in place, so pass a copy.
 */
export function absorb(self: FruitState, ep: Episode): void {
  self.events = [...self.events, ep].slice(-80)
  const me = self.id
  const t = self.traits
  const b = self.beliefs
  const wolf = self.role === 'werewolf'
  const past = self.events
  // Being wrong in character: the stubborn barely move, the gullible lurch.
  const gain = t.temper === 'stubborn' ? 0.4 : t.temper === 'gullible' ? 1.8 : 1
  const bump = (id: string, delta: number) => {
    if (id === me || !(id in b) || known(b[id])) return
    b[id] = clamp(b[id] + delta * gain, 2, 98)
  }
  /** How much weight a fruit's word carries: more if I trust it. */
  const weight = (id: string) => 0.4 + (1 - (b[id] ?? 50) / 100)
  const feel = (mood: keyof Mood, delta: number) => {
    self.mood[mood] = clamp(self.mood[mood] + delta, 0, 1)
  }
  const accusersOf = (id: string) => distinct(past.filter((e) => e.kind === 'accuse' && e.target === id && e.actor !== me).map((e) => (e as { actor: string }).actor))

  switch (ep.kind) {
    case 'accuse': {
      if (ep.actor === me) return
      if (ep.target === me) {
        // Accused to my face: a grudge, and a fright.
        bump(ep.actor, 10 + t.aggression * 12)
        feel('anger', 0.25)
        feel('fear', 0.12 + (1 - t.aggression) * 0.12)
        return
      }
      // A contrarian starts doubting an accusation as soon as it becomes popular.
      if (t.temper === 'contrarian' && accusersOf(ep.target).length >= 2) {
        bump(ep.target, -7)
        bump(ep.actor, 4)
      } else {
        bump(ep.target, (6 + t.suspicion * 6) * weight(ep.actor))
      }
      if (self.goal.kind === 'protect' && self.goal.target === ep.target) {
        bump(ep.actor, 9)
        feel('anger', 0.15)
      }
      return
    }
    case 'vouch': {
      if (ep.actor === me) return
      if (ep.target === me) {
        bump(ep.actor, -10)
        feel('fear', -0.1)
      } else if ((b[ep.target] ?? 0) > 65) {
        // Standing up for someone I am nearly sure about looks bad.
        bump(ep.actor, 7)
      } else {
        bump(ep.target, -5 * weight(ep.actor))
      }
      return
    }
    case 'claim': {
      if (ep.actor === me) return
      // Keeping a story straight: has this fruit told me something different about the same night?
      const before = past.find((e) => e !== ep && e.kind === 'claim' && e.actor === ep.actor && e.night === ep.night && e.saw !== ep.saw)
      const sharp = t.suspicion >= 0.45 || ['detective', 'know-it-all', 'paranoid'].some((q) => t.quirks.includes(q))
      const already = past.some((e) => e.kind === 'caught' && e.actor === ep.actor)
      if (before && sharp && !already) {
        self.events = [...self.events, { kind: 'caught', day: ep.day, actor: ep.actor }]
        bump(ep.actor, 38)
      } else if (ep.saw === me) {
        bump(ep.actor, 14)
        feel('anger', 0.2)
      } else if (ep.saw) {
        bump(ep.saw, 8 * weight(ep.actor))
      }
      return
    }
    case 'vote': {
      if (ep.actor === me || ep.target !== me) return
      bump(ep.actor, 12)
      feel('anger', 0.2)
      feel('fear', 0.2)
      return
    }
    case 'death': {
      const dead = ep.target
      if (ep.by === 'vote') {
        const voters = distinct(past.filter((e) => e.kind === 'vote' && e.day === ep.day && e.target === dead).map((e) => (e as { actor: string }).actor))
        const iVoted = voters.includes(me)
        if (ep.role === 'werewolf') {
          // Whoever voted for a real wolf has earned some trust; whoever stood up for it has lost some.
          voters.forEach((id) => bump(id, -14))
          distinct(past.filter((e) => e.kind === 'vouch' && e.target === dead).map((e) => (e as { actor: string }).actor)).forEach((id) => bump(id, 12))
          if (wolf) feel('fear', 0.4)
          else {
            if (iVoted) feel('smug', 0.5)
            feel('fear', -0.3)
          }
        } else {
          voters.forEach((id) => bump(id, 6))
          accusersOf(dead).forEach((id) => bump(id, 5))
          if (wolf) feel('smug', 0.5)
          else if (iVoted) feel('guilt', 0.65)
        }
      } else {
        // Killed in the night: anyone who kept naming them looks a little worse.
        accusersOf(dead).forEach((id) => bump(id, 6))
        if (!wolf) feel('fear', 0.2)
        const lowest = Math.min(...Object.values(b))
        const friend = (self.goal.kind === 'protect' && self.goal.target === dead) || (b[dead] !== undefined && b[dead] === lowest && b[dead] <= 25)
        if (friend && !wolf) {
          // Grief. It fixes on whoever it already suspected most and wants them to pay.
          feel('grief', 0.75)
          const blame = Object.keys(b)
            .filter((id) => id !== dead)
            .sort((x, y) => b[y] - b[x])[0]
          if (blame) {
            bump(blame, 14)
            self.goal = { kind: 'revenge', target: blame }
          }
        }
      }
      delete b[dead]
      if ('target' in self.goal && self.goal.target === dead) self.goal = { kind: 'truth' }
      return
    }
  }
}

/** Night falls: feelings fade, though not all the way. */
export function nightfall(self: FruitState): void {
  for (const mood of MOODS) self.mood[mood] = Math.round(self.mood[mood] * 0.55 * 100) / 100
}

/**
 * Theory of mind: how much this fruit thinks each other fruit suspects IT, 0 to 100,
 * worked out from what they have said and done to it.
 */
export function suspectedBy(self: FruitState): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of self.events) {
    if (e.kind === 'accuse' && e.target === self.id) out[e.actor] = (out[e.actor] ?? 0) + 30
    else if (e.kind === 'vote' && e.target === self.id) out[e.actor] = (out[e.actor] ?? 0) + 35
    else if (e.kind === 'claim' && e.saw === self.id) out[e.actor] = (out[e.actor] ?? 0) + 30
    else if (e.kind === 'vouch' && e.target === self.id) out[e.actor] = (out[e.actor] ?? 0) - 25
  }
  for (const id in out) out[id] = clamp(out[id], 0, 100)
  return out
}

/** Belief as the old -5 to +5 trust score. */
export function trustOf(belief: number | undefined): number {
  return clamp(Math.round((50 - (belief ?? 50)) / 10), -5, 5)
}

/** The strongest thing this fruit remembers about another, for quoting back at them. */
export type Evidence =
  | { kind: 'caught' }
  | { kind: 'votedInnocent' | 'defendedWolf' | 'accusedDead' | 'votedWolf'; other: string; day: number }
  | { kind: 'accusedMe' | 'votedMe' | 'defendedMe'; day: number }

/** `against` picks evidence that counts against the fruit; otherwise evidence in its favour. */
export function evidence(self: FruitState, about: string, against: boolean): Evidence | undefined {
  const events = self.events
  const deaths = events.filter((e): e is Extract<Episode, { kind: 'death' }> => e.kind === 'death')
  const mine = events.filter((e) => 'actor' in e && e.actor === about)
  if (against) {
    if (mine.some((e) => e.kind === 'caught')) return { kind: 'caught' }
    for (const e of mine) {
      if (e.kind !== 'vote') continue
      const death = deaths.find((d) => d.target === e.target && d.by === 'vote' && d.day === e.day && d.role !== 'werewolf')
      if (death) return { kind: 'votedInnocent', other: e.target, day: e.day }
    }
    for (const e of mine) {
      if (e.kind === 'vouch' && deaths.some((d) => d.target === e.target && d.role === 'werewolf')) return { kind: 'defendedWolf', other: e.target, day: e.day }
    }
    for (const e of mine) {
      if (e.kind === 'vote' && e.target === self.id) return { kind: 'votedMe', day: e.day }
    }
    for (const e of mine) {
      if (e.kind === 'accuse' && e.target === self.id) return { kind: 'accusedMe', day: e.day }
    }
    for (const e of mine) {
      if (e.kind === 'accuse' && deaths.some((d) => d.target === e.target && d.by === 'wolf')) return { kind: 'accusedDead', other: e.target, day: e.day }
    }
    return undefined
  }
  for (const e of mine) {
    if (e.kind === 'vote' && deaths.some((d) => d.target === e.target && d.day === e.day && d.role === 'werewolf')) return { kind: 'votedWolf', other: e.target, day: e.day }
  }
  for (const e of mine) {
    if (e.kind === 'vouch' && e.target === self.id) return { kind: 'defendedMe', day: e.day }
  }
  return undefined
}

/** One remembered event in plain words, as the fruit itself would recall it. */
export function describe(ep: Episode, self: FruitState, nameOf: (id: string) => string): string {
  const who = (id: string) => (id === self.id ? 'you' : nameOf(id))
  switch (ep.kind) {
    case 'accuse':
      return `Day ${ep.day}: ${who(ep.actor)} accused ${who(ep.target)}.`
    case 'vouch':
      return `Day ${ep.day}: ${who(ep.actor)} stood up for ${who(ep.target)}.`
    case 'claim':
      return ep.saw ? `Day ${ep.day}: ${who(ep.actor)} said it saw ${who(ep.saw)} out on night ${ep.night}.` : `Day ${ep.day}: ${who(ep.actor)} said it slept through night ${ep.night} and saw nothing.`
    case 'caught':
      return `Day ${ep.day}: you noticed ${who(ep.actor)}'s story had changed.`
    case 'vote':
      return `Day ${ep.day}: ${who(ep.actor)} voted for ${who(ep.target)}.`
    case 'death':
      return ep.by === 'vote'
        ? `Day ${ep.day}: ${who(ep.target)} was voted out and was ${ep.role === 'werewolf' ? 'a werewolf' : 'innocent'}.`
        : `Day ${ep.day}: ${who(ep.target)} was killed${ep.by === 'hunter' ? ' by the hunter' : ' in the night'}.`
  }
}

/** A personal goal in a few words. */
export function describeGoal(goal: Goal, nameOf: (id: string) => string, wolf = false): string {
  switch (goal.kind) {
    case 'protect':
      return `Keep ${nameOf(goal.target)} safe, whatever it takes.`
    case 'revenge':
      return `See ${nameOf(goal.target)} gone.`
    case 'survive':
      return 'Stay alive, even if that means going along with the crowd.'
    case 'truth':
      return wolf ? 'Not get caught.' : 'Find out who did it.'
  }
}
