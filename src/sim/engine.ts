import { buildPersona, GeminiBrain } from './geminiBrain'
import { MockBrain } from './mockBrain'
import type { GhostEvent } from './mockBrain'
import { babble, cheer, clang, dawnChime, gasp, gunshot, nightChime, slice, startParty, stopParty, sulk, thud, voteTick } from './sfx'
import { fruitPositions, layout, maxWolves, useSim } from './store'
import type { Brain, Conversation, DayScript, FruitState, LogEntry, NightScript, Phase, Reaction, RecapEvent, Role, Rules, Winner, WorldView } from './types'

const ROLE_LABEL: Record<Role, string> = {
  werewolf: 'a werewolf',
  villager: 'a villager',
  seer: 'the seer',
  doctor: 'the doctor',
  hunter: 'the hunter',
  jester: 'the jester',
}

const HEARD_LIMIT = 40
const TALK_RING = 6.5

let controller: AbortController | null = null
/** Used only for the hunter's stock last words. */
const stockLines = new MockBrain()

const get = () => useSim.getState()
const set = useSim.setState
const alive = () => get().fruits.filter((f) => f.alive)
const byId = (id: string) => get().fruits.find((f) => f.id === id)!

function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function abortError() {
  return new DOMException('Aborted', 'AbortError')
}

/** Game-time sleep: stretches with pause, shrinks with speed, rejects when the game is stopped. */
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let left = ms
    const timer = setInterval(() => {
      if (signal.aborted) {
        clearInterval(timer)
        reject(abortError())
        return
      }
      const { paused, speed } = get()
      if (!paused) left -= 50 * speed
      if (left <= 0) {
        clearInterval(timer)
        resolve()
      }
    }, 50)
  })
}

/** Real-time poll until a condition holds or the timeout passes. */
async function until(condition: () => boolean, timeoutMs: number, signal: AbortSignal) {
  const start = Date.now()
  while (!condition() && Date.now() - start < timeoutMs) {
    if (signal.aborted) throw abortError()
    await new Promise((r) => setTimeout(r, 100))
  }
  if (signal.aborted) throw abortError()
}

function distance(id: string, x: number, z: number) {
  const p = fruitPositions.get(id)
  return p ? Math.hypot(p.x - x, p.z - z) : 0
}

function arrived(ids: string[]) {
  const { targets } = get()
  return ids.every((id) => !targets[id] || distance(id, targets[id][0], targets[id][1]) < 1)
}

function near(a: string, b: string, range: number) {
  const p = fruitPositions.get(b)
  return !p || distance(a, p.x, p.z) < range
}

function log(entry: LogEntry) {
  get().addLog(entry)
}

/** Note something down for the end-of-game recap. */
function record(event: RecapEvent) {
  set((s) => ({ recap: [...s.recap, event] }))
}

/** Give some fruits a burst of body language that wears off by itself. */
function react(ids: string[], reaction: Reaction, ms: number, signal: AbortSignal) {
  if (!ids.length) return
  set((s) => ({ reactions: { ...s.reactions, ...Object.fromEntries(ids.map((id) => [id, reaction])) } }))
  wait(ms, signal).then(
    () =>
      set((s) => ({
        // Only clear the ones still showing this reaction; a newer one may have replaced it.
        reactions: { ...s.reactions, ...Object.fromEntries(ids.filter((id) => s.reactions[id] === reaction).map((id) => [id, undefined])) },
      })),
    () => {},
  )
}

const ACCUSING = /\b(wol(f|ves)|suspect|suspicious|liar|lying|lies|guilty|rotten|killer|murder|did it|don'?t trust|can'?t trust|vot(e|ing) (for|out)|hiding something|shifty|fishy)\b/i

/**
 * Who a spoken line points the finger at. The No AI brain says so itself; for Gemini's lines
 * it is guessed from an accusing word next to the name of someone standing in the group.
 */
function accusedBy(line: Conversation['lines'][number], members: string[]): string | undefined {
  if (line.accuses) return members.includes(line.accuses) ? line.accuses : undefined
  if (!ACCUSING.test(line.say)) return undefined
  const text = line.say.toLowerCase()
  return members.find((id) => id !== line.id && new RegExp(`\\b${byId(id).name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text))
}

/** Clear trust (+1), clear distrust (-1) or neither. A change of band is a change of heart. */
const band = (trust: number) => (trust <= -2 ? -1 : trust >= 2 ? 1 : 0)

function remember(id: string, note: string) {
  set((s) => ({ fruits: s.fruits.map((f) => (f.id === id ? { ...f, memory: [...f.memory, note] } : f)) }))
}

/** Record a spoken line in the memory of everyone who was there to hear it. */
function hear(ids: string[], line: string) {
  set((s) => ({ fruits: s.fruits.map((f) => (ids.includes(f.id) ? { ...f, heard: [...f.heard, line].slice(-HEARD_LIMIT) } : f)) }))
}

function setPhase(phase: Phase) {
  set({ phase })
}

function sendTo(spot: (f: FruitState) => [number, number]) {
  set((s) => ({ follow: {}, lookAt: {}, targets: Object.fromEntries(s.fruits.map((f) => [f.id, spot(f)])) }))
}

/** Snapshot handed to the brain for one batched decision. */
function world(): WorldView {
  const s = get()
  return {
    day: s.day,
    rules: s.settings.rules,
    fruits: s.fruits,
    // Conversations are private, so only events and votes count as public.
    publicLog: s.log
      .filter((e) => e.kind !== 'say' && e.kind !== 'ghost')
      .slice(-40)
      .map((e) => (e.name ? `${e.name}: ${e.text}` : `[${e.text}]`)),
  }
}

/** Run one batched brain call, with every living fruit showing a "thinking" bubble meanwhile. */
async function think<T>(decide: () => Promise<T>): Promise<T> {
  set({ thinking: Object.fromEntries(alive().map((f) => [f.id, true])) })
  try {
    return await decide()
  } finally {
    set({ thinking: {} })
  }
}

async function say(fruit: FruitState, text: string, entry: Pick<LogEntry, 'kind' | 'to'>, signal: AbortSignal) {
  const duration = 1500 + text.length * 40
  set((s) => ({ speech: { ...s.speech, [fruit.id]: text }, focusId: fruit.id }))
  log({ ...entry, name: fruit.name, text })
  babble(fruit, get().fruits.findIndex((f) => f.id === fruit.id), text, duration / get().speed)
  await wait(duration, signal)
  set((s) => ({ speech: { ...s.speech, [fruit.id]: undefined } }))
  await wait(250, signal)
}

let burstKey = 0

/** Flash a comic sound word over a fruit, or over the middle of the stage if none is given. */
function burst(text: string, fruitId?: string) {
  const p = fruitId ? fruitPositions.get(fruitId) : undefined
  const key = ++burstKey
  set((s) => ({ bursts: [...s.bursts, { key, text, at: p ? [p.x, p.y + 1.5, p.z] : [0, 3.4, 0] }] }))
  // Real time, not game time: the word should not hang about when the game is paused.
  setTimeout(() => set((s) => ({ bursts: s.bursts.filter((b) => b.key !== key) })), 1100)
}

/** Kill a fruit. `chop` makes it fall apart in slices; otherwise it is flung whole. */
function kill(id: string, chop: boolean) {
  const p = fruitPositions.get(id)
  const fruit = byId(id)
  set((s) => ({
    // Juice on the floor where it happened.
    splats: p ? [...s.splats, { x: p.x, z: p.z, kind: fruit.kind, size: chop ? 1 : 1.5, seed: Math.random() * 100 }] : s.splats,
    chopped: { ...s.chopped, [id]: chop },
    fruits: s.fruits.map((f) => (f.id === id ? { ...f, alive: false } : f)),
    follow: { ...s.follow, [id]: undefined },
  }))
  thud()
}

/** Store each fruit's new thought and feelings so the next prompt (and the UI) can use them. */
function applyMinds(minds: NightScript['minds']) {
  const { day, fruits } = get()
  for (const mind of minds) {
    const fruit = fruits.find((f) => f.id === mind.id)
    if (!fruit) continue
    for (const feel of mind.feelings) {
      const from = fruit.feelings[feel.about]?.trust ?? 0
      // A big enough swing into clear trust or distrust is worth retelling in the recap.
      if (band(feel.trust) !== 0 && band(feel.trust) !== band(from) && Math.abs(feel.trust - from) >= 3 && fruits.some((f) => f.id === feel.about)) {
        record({ kind: 'turn', day, who: fruit.id, about: feel.about, from, to: feel.trust, note: feel.note })
      }
    }
  }
  set((s) => ({
    fruits: s.fruits.map((f) => {
      const mind = minds.find((m) => m.id === f.id)
      if (!mind) return f
      const feelings = { ...f.feelings }
      for (const feel of mind.feelings) feelings[feel.about] = { trust: feel.trust, note: feel.note }
      return { ...f, thought: mind.thought || f.thought, feelings }
    }),
  }))
}

function winner(): Winner | null {
  const living = alive()
  const wolves = living.filter((f) => f.role === 'werewolf').length
  if (wolves === 0) return 'village'
  if (wolves >= living.length - wolves) return 'werewolves'
  return null
}

/** Deal roles for the chosen rules, dropping optional roles if the village is too small for them. */
function dealRoles(count: number, rules: Rules): Role[] {
  const wolves = Math.max(1, Math.min(rules.wolves, maxWolves(count)))
  const specials: Role[] = []
  if (rules.seer) specials.push('seer')
  if (rules.doctor) specials.push('doctor')
  if (rules.hunter) specials.push('hunter')
  if (rules.jester) specials.push('jester')
  const roles: Role[] = [...Array<Role>(wolves).fill('werewolf'), ...specials].slice(0, count)
  while (roles.length < count) roles.push('villager')
  return shuffle(roles)
}

/**
 * If the fruit that just died was the hunter, it takes its chosen target down with it.
 * `revenge` is the choice it made the night before; if that fruit is already gone,
 * it picks whoever it trusts least.
 */
async function hunterShot(dead: FruitState, revenge: string | null, signal: AbortSignal) {
  if (dead.role !== 'hunter') return
  const options = alive()
  if (!options.length) return
  const chosen = options.find((f) => f.id === revenge)
  const target = chosen ?? options.reduce((a, b) => ((dead.feelings[b.id]?.trust ?? 0) < (dead.feelings[a.id]?.trust ?? 0) ? b : a))
  await wait(900, signal)
  log({ kind: 'say', name: dead.name, to: target.name, text: stockLines.lastWords(target) })
  slice()
  await wait(500, signal)
  kill(target.id, false)
  burst('BANG!', target.id)
  record({ kind: 'shot', day: get().day, hunter: dead.id, target: target.id })
  gasp()
  react(alive().map((f) => f.id), 'gasp', 1400, signal)
  log({ kind: 'system', text: `${dead.name} was the hunter and takes ${target.name} down too. ${target.name} was ${ROLE_LABEL[target.role]}.` })
  await wait(2200, signal)
}

/** The dead watch the vote. They know who everyone really was, and take it personally. */
function ghostsReact(targetIsWolf: boolean, ms: number, signal: AbortSignal, except?: string) {
  const dead = get().fruits.filter((f) => !f.alive && f.id !== except)
  // Village ghosts are pleased when a wolf is in trouble; a wolf's ghost is pleased when an innocent is.
  react(dead.filter((f) => (f.role === 'werewolf') !== targetIsWolf).map((f) => f.id), 'cheer', ms, signal)
  react(dead.filter((f) => (f.role === 'werewolf') === targetIsWolf).map((f) => f.id), 'sulk', ms, signal)
}

/**
 * A ghost or two thinks something about what just happened. The thought floats over the
 * ghost for a few seconds and goes in the log; no living fruit ever hears it.
 */
function ghostsThink(event: GhostEvent, about: FruitState | undefined, signal: AbortSignal, opts: { max?: number; except?: string } = {}) {
  const ghosts = shuffle(get().fruits.filter((f) => !f.alive && f.id !== opts.except && f.id !== about?.id)).slice(0, opts.max ?? 2)
  ghosts.forEach((ghost, i) => {
    const text = stockLines.ghostThought(ghost, event, about)
    wait(200 + i * 700, signal)
      .then(() => {
        set((s) => ({ ghostThoughts: { ...s.ghostThoughts, [ghost.id]: text } }))
        log({ kind: 'ghost', name: ghost.name, text })
        return wait(3600, signal)
      })
      .then(
        () => set((s) => (s.ghostThoughts[ghost.id] === text ? { ghostThoughts: { ...s.ghostThoughts, [ghost.id]: undefined } } : s)),
        () => {},
      )
  })
}

/** With more than one werewolf, the pack slips out to argue in whispers over who to kill. */
async function wolfHuddle(wolves: FruitState[], lines: NonNullable<NightScript['wolfChat']>, signal: AbortSignal) {
  log({ kind: 'system', text: 'The werewolves slip out to whisper.' })
  ghostsThink('whisper', undefined, signal, { max: 1 })
  const ids = wolves.map((w) => w.id)
  const angle = Math.atan2(wolves[0].home[1], wolves[0].home[0])
  const targets: Record<string, [number, number]> = {}
  const lookAt: Record<string, string> = {}
  wolves.forEach((wolf, i) => {
    const a = angle + Math.PI / 2 + (i / wolves.length) * Math.PI * 2
    targets[wolf.id] = [Math.cos(angle) * TALK_RING + Math.cos(a) * 0.95, Math.sin(angle) * TALK_RING + Math.sin(a) * 0.95]
    lookAt[wolf.id] = ids[(i + 1) % ids.length]
  })
  set((s) => ({ follow: {}, lookAt, targets: { ...s.targets, ...targets } }))
  await until(() => arrived(ids), 9000, signal)
  for (const line of lines) {
    const speaker = wolves.find((w) => w.id === line.id)
    if (!speaker) continue
    const listeners = ids.filter((id) => id !== speaker.id)
    set((s) => ({ lookAt: { ...s.lookAt, ...Object.fromEntries(listeners.map((id) => [id, speaker.id])) } }))
    hear(ids, `${speaker.name}: ${line.say}`)
    await say(speaker, line.say, { kind: 'say', to: listeners.map((id) => byId(id).name).join(' & ') }, signal)
  }
  await wait(300, signal)
}

/** Returns the hunter's standing revenge choice, for use if it dies during the coming day. */
async function night(brain: Brain, signal: AbortSignal): Promise<string | null> {
  const { day } = get()
  setPhase('night')
  nightChime()
  log({ kind: 'system', text: `Night ${day} falls. Everyone heads home.` })
  sendTo((f) => f.home)
  // One batched call decides the whole night while the fruits walk home.
  const [script] = await Promise.all([
    think(() => brain.playNight(world())),
    until(() => arrived(alive().map((f) => f.id)), 10000, signal),
  ])
  applyMinds(script.minds)

  const living = alive()
  const wolves = living.filter((f) => f.role === 'werewolf')
  const attacker = wolves[Math.floor(Math.random() * wolves.length)]
  const victim = byId(script.kill)
  wolves.forEach((w) => remember(w.id, `Night ${day}: the werewolves chose to attack ${victim.name}.`))

  const doctor = living.find((f) => f.role === 'doctor')
  if (doctor && script.protect) remember(doctor.id, `Night ${day}: you protected ${byId(script.protect).name}.`)

  const seer = living.find((f) => f.role === 'seer')
  if (seer && script.inspect) {
    const seen = byId(script.inspect)
    record({ kind: 'inspect', day, seer: seer.id, target: seen.id, wolf: seen.role === 'werewolf' })
    remember(
      seer.id,
      `Night ${day}: you inspected ${seen.name}. ${seen.name} is ${seen.role === 'werewolf' ? 'a WEREWOLF' : 'NOT a werewolf'}.`,
    )
  }

  if (wolves.length > 1 && script.wolfChat?.length) await wolfHuddle(wolves, script.wolfChat, signal)

  // The doctor's protection shows as a bubble around whoever it chose.
  if (doctor && script.protect) set({ shield: { id: script.protect, hit: false } })

  // Act it out: the wolf hurries over with a knife, lunges, and the victim is chopped.
  set((s) => ({ follow: { ...s.follow, [attacker.id]: victim.id }, attack: { attackerId: attacker.id, victimId: victim.id, striking: false } }))
  await until(() => near(attacker.id, victim.id, 2), 9000, signal)
  await wait(600, signal)
  set((s) => ({ attack: s.attack && { ...s.attack, striking: true } }))
  slice()
  await wait(280, signal)
  const saved = script.protect === victim.id
  if (saved) {
    // The knife rings off the bubble. The victim is left with a plaster to show for it.
    set((s) => ({ shield: s.shield && { ...s.shield, hit: true }, bandaged: { ...s.bandaged, [victim.id]: true } }))
    clang()
    burst('CLANG!', victim.id)
  } else {
    kill(victim.id, true)
    burst('CHOP!', victim.id)
  }
  record(saved ? { kind: 'saved', day, wolf: attacker.id, victim: victim.id, doctor: doctor?.id ?? '' } : { kind: 'kill', day, wolf: attacker.id, victim: victim.id })
  await wait(1400, signal)
  // Day only breaks once the wolf has hurried back to its own spot.
  set((s) => ({ attack: s.attack && { ...s.attack, striking: false } }))
  sendTo((f) => f.home)
  await until(() => arrived(wolves.map((w) => w.id)), 10000, signal)
  set({ attack: null, shield: null })
  await wait(700, signal)

  setPhase('dawn')
  dawnChime()
  if (saved) {
    log({ kind: 'system', text: `Dawn of day ${day}. Someone was attacked in the night, but the doctor saved them.` })
    if (doctor) remember(doctor.id, `Your protection saved ${victim.name} on night ${day}.`)
    // Relief all round.
    cheer()
    react(alive().map((f) => f.id), 'cheer', 1500, signal)
    ghostsThink('saved', undefined, signal, { max: 1 })
  } else {
    log({ kind: 'system', text: `Dawn of day ${day}. ${victim.name} was found dead. They were ${ROLE_LABEL[victim.role]}.` })
    // Everyone turns to the body and flinches.
    set({ focusId: victim.id })
    gasp()
    burst('GASP!')
    react(get().fruits.filter((f) => f.id !== victim.id).map((f) => f.id), 'gasp', 1800, signal)
    ghostsThink('death', victim, signal)
    await hunterShot(victim, script.revenge, signal)
  }
  await wait(2500, signal)
  return script.revenge
}

/** One round: every group walks to its own patch of the stage, then all the groups talk at once. */
async function talkRound(groups: Conversation[], round: number, total: number, signal: AbortSignal) {
  log({ kind: 'system', text: total > 1 ? `Round ${round} of ${total}: the fruits pair off to talk.` : 'The fruits pair off to talk.' })
  const offset = Math.random() * Math.PI * 2
  const targets: Record<string, [number, number]> = {}
  const lookAt: Record<string, string> = {}
  groups.forEach((group, g) => {
    const angle = offset + (g / groups.length) * Math.PI * 2
    const cx = Math.cos(angle) * TALK_RING
    const cz = Math.sin(angle) * TALK_RING
    group.members.forEach((id, m) => {
      // Members stand in a small ring around their group's spot, facing inward.
      const a = angle + Math.PI / 2 + (m / group.members.length) * Math.PI * 2
      targets[id] = [cx + Math.cos(a) * 0.95, cz + Math.sin(a) * 0.95]
      lookAt[id] = group.members[(m + 1) % group.members.length]
    })
  })
  set((s) => ({ follow: {}, lookAt, targets: { ...s.targets, ...targets } }))
  await until(() => arrived(Object.keys(targets)), 9000, signal)

  await Promise.all(
    groups.map(async (group, g) => {
      // Stagger the groups a little so they don't all start on the same beat.
      await wait(g * 350, signal)
      for (const line of group.lines) {
        const speaker = byId(line.id)
        const listeners = group.members.filter((id) => id !== speaker.id)
        // Everyone in the group turns to whoever is speaking.
        set((s) => ({ lookAt: { ...s.lookAt, ...Object.fromEntries(listeners.map((id) => [id, speaker.id])) } }))
        hear(group.members, `${speaker.name}: ${line.say}`)
        // A fruit accused to its face shakes while it is being talked about.
        const accused = accusedBy(line, group.members)
        if (accused) react([accused], 'shake', 1500 + line.say.length * 40, signal)
        await say(speaker, line.say, { kind: 'say', to: listeners.map((id) => byId(id).name).join(' & ') }, signal)
      }
    }),
  )
  await wait(500, signal)
}

/** Returns the jester if it was voted out, which ends the game. */
async function vote(votes: DayScript['votes'], revenge: string | null, signal: AbortSignal): Promise<FruitState | null> {
  setPhase('vote')
  set({ votes: {} })
  log({ kind: 'system', text: 'Everyone gathers in the circle to vote.' })
  sendTo((f) => f.seat)
  await until(() => arrived(alive().map((f) => f.id)), 10000, signal)

  for (const ballot of votes) {
    const target = byId(ballot.target)
    // The voter turns and points at its choice; the tally shows over the target's head.
    set((s) => ({ votes: { ...s.votes, [ballot.id]: target.id }, lookAt: { ...s.lookAt, [ballot.id]: target.id } }))
    voteTick()
    react([target.id], 'shake', 1500, signal)
    ghostsReact(target.role === 'werewolf', 1400, signal)
    if (Math.random() < 0.4) ghostsThink(target.role === 'werewolf' ? 'ballot-right' : 'ballot-wrong', target, signal, { max: 1 })
    await say(byId(ballot.id), `I vote ${target.name}. ${ballot.reason}`.trim(), { kind: 'vote' }, signal)
  }

  const tally = new Map<string, number>()
  Object.values(get().votes).forEach((id) => tally.set(id, (tally.get(id) ?? 0) + 1))
  const top = Math.max(...tally.values())
  const leaders = [...tally].filter(([, n]) => n === top).map(([id]) => id)
  await wait(1200, signal)
  let jester: FruitState | null = null
  const ballots = Object.entries(get().votes).map(([voter, target]) => ({ voter, target }))
  if (leaders.length > 1) {
    record({ kind: 'vote', day: get().day, ballots, out: null, tied: leaders })
    log({ kind: 'system', text: `The vote is tied between ${leaders.map((id) => byId(id).name).join(' and ')}. Nobody is eliminated.` })
    // Nobody, living or dead, knows what to make of that.
    react(get().fruits.map((f) => f.id), 'puzzle', 2200, signal)
    ghostsThink('tie', undefined, signal)
  } else {
    const out = byId(leaders[0])
    // The condemned fruit gets a last word before it is flung out.
    const lastWords = votes.find((v) => v.id === out.id)?.lastWords
    if (lastWords) await say(out, lastWords, { kind: 'vote' }, signal)
    // The sentence is carried out by the most aggressive fruit that voted for it.
    const voters = alive().filter((f) => f.id !== out.id && get().votes[f.id] === out.id)
    const shooter = voters.length ? voters.reduce((a, b) => (b.traits.aggression > a.traits.aggression ? b : a)) : undefined
    if (shooter) {
      set((s) => ({ execution: { shooterId: shooter.id, targetId: out.id, firing: false }, focusId: out.id, lookAt: { ...s.lookAt, [shooter.id]: out.id } }))
      await wait(1100, signal)
      set((s) => ({ execution: s.execution && { ...s.execution, firing: true } }))
      gunshot()
      burst('BANG!', shooter.id)
    }
    kill(out.id, false)
    if (shooter) {
      await wait(140, signal)
      set((s) => ({ execution: s.execution && { ...s.execution, firing: false } }))
    }
    record({ kind: 'vote', day: get().day, ballots, out: out.id, tied: [] })
    log({ kind: 'system', text: `${out.name} is voted out with ${top} votes. They were ${ROLE_LABEL[out.role]}.` })
    if (out.role === 'jester') jester = out
    else {
      const living = alive()
      if (out.role === 'werewolf') {
        // Caught one: the village celebrates and any wolves left look glum.
        cheer()
        react(living.filter((f) => f.role !== 'werewolf').map((f) => f.id), 'cheer', 2400, signal)
        react(living.filter((f) => f.role === 'werewolf').map((f) => f.id), 'sulk', 2400, signal)
      } else {
        // An innocent fruit: whoever voted for it hangs its head.
        sulk()
        react(living.filter((f) => get().votes[f.id] === out.id).map((f) => f.id), 'sulk', 2400, signal)
      }
      ghostsReact(out.role === 'werewolf', 2400, signal, out.id)
      ghostsThink(out.role === 'werewolf' ? 'out-right' : 'out-wrong', out, signal)
      await hunterShot(out, revenge, signal)
    }
  }
  await wait(2800, signal)
  set({ votes: {}, lookAt: {}, execution: null })
  return jester
}

/** One batched call writes the whole day; the engine then plays it out. Returns true if the jester won. */
async function daytime(brain: Brain, revenge: string | null, signal: AbortSignal): Promise<boolean> {
  setPhase('talk')
  // Drift toward the middle while the day is being decided.
  const living = shuffle(alive())
  const spots = new Map(
    living.map((f, i) => {
      const angle = (i / living.length) * Math.PI * 2 + Math.random() * 0.5
      return [f.id, [Math.cos(angle) * TALK_RING, Math.sin(angle) * TALK_RING] as [number, number]]
    }),
  )
  sendTo((f) => spots.get(f.id) ?? f.home)
  const [script] = await Promise.all([think(() => brain.playDay(world())), wait(1200, signal)])

  for (let r = 0; r < script.rounds.length; r++) await talkRound(script.rounds[r], r + 1, script.rounds.length, signal)
  return !!(await vote(script.votes, revenge, signal))
}

function finish(side: Winner) {
  // The jester was just voted out, so it gets back up for its own party.
  if (side === 'jester') set((s) => ({ fruits: s.fruits.map((f) => (f.role === 'jester' ? { ...f, alive: true } : f)) }))
  const dancers = alive()
    .filter((f) => (side === 'werewolves' ? f.role === 'werewolf' : side === 'jester' ? f.role === 'jester' : f.role !== 'werewolf' && f.role !== 'jester'))
    .map((f) => f.id)
  set({ phase: 'over', winner: side, revealRoles: true, focusId: null, reactions: {}, execution: null, party: { at: performance.now(), dancers } })
  sendTo((f) => f.seat)
  startParty()
  const text: Record<Winner, string> = {
    village: 'Every werewolf is dead. The village wins!',
    werewolves: 'The werewolves have taken over. The werewolves win!',
    jester: 'The village voted out the jester, which is exactly what it wanted. The jester wins!',
  }
  log({ kind: 'system', text: text[side] })
}

async function run(signal: AbortSignal) {
  stopParty()
  const s = get()
  const { rules } = s.settings
  const useGemini = s.settings.brain === 'gemini' && s.settings.apiKey
  const brain: Brain = useGemini
    ? new GeminiBrain({
        apiKey: s.settings.apiKey,
        model: s.settings.model,
        requestsPerMinute: s.settings.requestsPerMinute,
        maxCalls: s.settings.maxCalls,
        signal,
        onCall: (calls) => set({ calls }),
        onProblem: (text) => log({ kind: 'system', text }),
      })
    : new MockBrain()

  const roles = dealRoles(s.roster.length, rules)
  const fruits = layout(s.roster).map((f, i) => ({ ...f, role: roles[i] }))
  const wolves = fruits.filter((f) => f.role === 'werewolf')
  for (const f of fruits) {
    // Personas are written once here and reused, unchanged, in every prompt.
    f.persona = buildPersona(f)
    f.memory = wolves.filter((w) => f.role === 'werewolf' && w.id !== f.id).map((w) => `Fellow werewolf: ${w.name}`)
  }
  set({
    screen: 'game',
    fruits,
    day: 0,
    winner: null,
    log: [],
    votes: {},
    speech: {},
    thinking: {},
    follow: {},
    lookAt: {},
    chopped: {},
    focusId: null,
    attack: null,
    party: null,
    reactions: {},
    execution: null,
    shield: null,
    bandaged: {},
    splats: [],
    bursts: [],
    ghostThoughts: {},
    recap: [],
    calls: 0,
    paused: false,
    revealRoles: false,
  })
  const extras = (['seer', 'doctor', 'hunter', 'jester'] as const).filter((r) => roles.includes(r))
  log({
    kind: 'system',
    text: `${fruits.length} fruits. ${wolves.length} werewolf${wolves.length > 1 ? 'es' : ''}${extras.length ? `, plus ${extras.map((r) => `a ${r}`).join(', ')}` : ''}. Brain: ${useGemini ? `Gemini (${s.settings.model})` : 'no AI'}.`,
  })

  for (let day = 1; ; day++) {
    set({ day })
    const revenge = await night(brain, signal)
    let side = winner()
    if (side) return finish(side)
    if (await daytime(brain, revenge, signal)) return finish('jester')
    side = winner()
    if (side) return finish(side)
  }
}

export function startGame() {
  controller?.abort()
  controller = new AbortController()
  const { signal } = controller
  run(signal).catch((err) => {
    if (signal.aborted) return
    console.error(err)
    log({ kind: 'system', text: `The simulation crashed: ${err instanceof Error ? err.message : String(err)}` })
  })
}

export function stopGame() {
  controller?.abort()
  controller = null
  stopParty()
  get().backToSetup()
}
