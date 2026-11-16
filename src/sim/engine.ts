import { buildPersona, GeminiBrain } from './geminiBrain'
import { MockBrain } from './mockBrain'
import { babble, dawnChime, nightChime, slice, startParty, stopParty, thud, voteTick } from './sfx'
import { fruitPositions, layout, maxWolves, useSim } from './store'
import type { Brain, Conversation, DayScript, FruitState, LogEntry, NightScript, Phase, Role, Rules, Winner, WorldView } from './types'

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
      .filter((e) => e.kind !== 'say')
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
  babble(get().fruits.findIndex((f) => f.id === fruit.id), duration / get().speed)
  await wait(duration, signal)
  set((s) => ({ speech: { ...s.speech, [fruit.id]: undefined } }))
  await wait(250, signal)
}

/** Kill a fruit. `chop` makes it fall apart in slices; otherwise it is flung whole. */
function kill(id: string, chop: boolean) {
  set((s) => ({
    chopped: { ...s.chopped, [id]: chop },
    fruits: s.fruits.map((f) => (f.id === id ? { ...f, alive: false } : f)),
    follow: { ...s.follow, [id]: undefined },
  }))
  thud()
}

/** Store each fruit's new thought and feelings so the next prompt (and the UI) can use them. */
function applyMinds(minds: NightScript['minds']) {
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
  log({ kind: 'system', text: `${dead.name} was the hunter and takes ${target.name} down too. ${target.name} was ${ROLE_LABEL[target.role]}.` })
  await wait(2200, signal)
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
    remember(
      seer.id,
      `Night ${day}: you inspected ${seen.name}. ${seen.name} is ${seen.role === 'werewolf' ? 'a WEREWOLF' : 'NOT a werewolf'}.`,
    )
  }

  // Act it out: the wolf hurries over with a knife, lunges, and the victim is chopped.
  set((s) => ({ follow: { ...s.follow, [attacker.id]: victim.id }, attack: { attackerId: attacker.id, victimId: victim.id, striking: false } }))
  await until(() => near(attacker.id, victim.id, 2), 9000, signal)
  await wait(600, signal)
  set((s) => ({ attack: s.attack && { ...s.attack, striking: true } }))
  slice()
  await wait(280, signal)
  const saved = script.protect === victim.id
  if (!saved) kill(victim.id, true)
  await wait(1400, signal)
  // Day only breaks once the wolf has hurried back to its own spot.
  set((s) => ({ attack: s.attack && { ...s.attack, striking: false } }))
  sendTo((f) => f.home)
  await until(() => arrived([attacker.id]), 10000, signal)
  set({ attack: null })
  await wait(700, signal)

  setPhase('dawn')
  dawnChime()
  if (saved) {
    log({ kind: 'system', text: `Dawn of day ${day}. Someone was attacked in the night, but the doctor saved them.` })
    if (doctor) remember(doctor.id, `Your protection saved ${victim.name} on night ${day}.`)
  } else {
    log({ kind: 'system', text: `Dawn of day ${day}. ${victim.name} was found dead. They were ${ROLE_LABEL[victim.role]}.` })
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
    await say(byId(ballot.id), `I vote ${target.name}. ${ballot.reason}`.trim(), { kind: 'vote' }, signal)
  }

  const tally = new Map<string, number>()
  Object.values(get().votes).forEach((id) => tally.set(id, (tally.get(id) ?? 0) + 1))
  const top = Math.max(...tally.values())
  const leaders = [...tally].filter(([, n]) => n === top).map(([id]) => id)
  await wait(1200, signal)
  let jester: FruitState | null = null
  if (leaders.length > 1) {
    log({ kind: 'system', text: `The vote is tied between ${leaders.map((id) => byId(id).name).join(' and ')}. Nobody is eliminated.` })
  } else {
    const out = byId(leaders[0])
    kill(out.id, false)
    log({ kind: 'system', text: `${out.name} is voted out with ${top} votes. They were ${ROLE_LABEL[out.role]}.` })
    if (out.role === 'jester') jester = out
    else await hunterShot(out, revenge, signal)
  }
  await wait(2800, signal)
  set({ votes: {}, lookAt: {} })
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
  set({ phase: 'over', winner: side, revealRoles: true, focusId: null, party: { at: performance.now(), dancers } })
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
