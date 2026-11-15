import { buildPersona, GeminiBrain } from './geminiBrain'
import { MockBrain } from './mockBrain'
import { babble, dawnChime, nightChime, thud, voteTick } from './sfx'
import { fruitPositions, layout, useSim } from './store'
import type { Brain, DayScript, FruitState, LogEntry, NightScript, Phase, Role, WorldView } from './types'

const ROLE_LABEL: Record<Role, string> = {
  werewolf: 'a werewolf',
  villager: 'a villager',
  seer: 'the seer',
  doctor: 'the doctor',
}

let controller: AbortController | null = null

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

function setPhase(phase: Phase) {
  set({ phase })
}

function sendTo(spot: (f: FruitState) => [number, number]) {
  set((s) => ({ follow: {}, targets: Object.fromEntries(s.fruits.map((f) => [f.id, spot(f)])) }))
}

/** Snapshot handed to the brain for one batched decision. */
function world(): WorldView {
  const s = get()
  return {
    day: s.day,
    fruits: s.fruits,
    publicLog: s.log
      .filter((e) => e.kind !== 'whisper')
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

async function say(fruit: FruitState, text: string, kind: LogEntry['kind'], signal: AbortSignal) {
  const duration = 1500 + text.length * 40
  set((s) => ({ speech: { ...s.speech, [fruit.id]: text }, focusId: fruit.id }))
  log({ kind, name: fruit.name, text })
  babble(get().fruits.findIndex((f) => f.id === fruit.id), duration / get().speed)
  await wait(duration, signal)
  set((s) => ({ speech: { ...s.speech, [fruit.id]: undefined } }))
  await wait(250, signal)
}

function kill(id: string) {
  set((s) => ({
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

function winner(): 'village' | 'werewolves' | null {
  const living = alive()
  const wolves = living.filter((f) => f.role === 'werewolf').length
  if (wolves === 0) return 'village'
  if (wolves >= living.length - wolves) return 'werewolves'
  return null
}

function dealRoles(count: number): Role[] {
  const roles: Role[] = Array(count).fill('villager')
  const wolves = count >= 8 ? 2 : 1
  for (let i = 0; i < wolves; i++) roles[i] = 'werewolf'
  roles[wolves] = 'seer'
  if (count >= 5) roles[wolves + 1] = 'doctor'
  return shuffle(roles)
}

async function night(brain: Brain, signal: AbortSignal) {
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
  const hunter = wolves[0]
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

  // Act it out: the wolf creeps over to its victim.
  set((s) => ({ follow: { ...s.follow, [hunter.id]: victim.id } }))
  await until(() => near(hunter.id, victim.id, 2), 9000, signal)
  await wait(500, signal)
  const saved = script.protect === victim.id
  if (!saved) kill(victim.id)
  await wait(1200, signal)
  sendTo((f) => f.home)
  await wait(1800, signal)

  setPhase('dawn')
  dawnChime()
  if (saved) {
    log({ kind: 'system', text: `Dawn of day ${day}. Someone was attacked in the night, but the doctor saved them.` })
    if (doctor) remember(doctor.id, `Your protection saved ${victim.name} on night ${day}.`)
  } else {
    log({ kind: 'system', text: `Dawn of day ${day}. ${victim.name} was found dead. They were ${ROLE_LABEL[victim.role]}.` })
  }
  await wait(2500, signal)
}

async function mingle(plans: DayScript['plans'], signal: AbortSignal) {
  log({ kind: 'system', text: 'The fruits mill about before the meeting.' })
  const chats: Promise<void>[] = []
  for (const plan of shuffle(plans)) {
    const fruit = byId(plan.id)
    const partner = byId(plan.approach)
    chats.push(
      (async () => {
        set((s) => ({ follow: { ...s.follow, [fruit.id]: partner.id } }))
        await until(() => near(fruit.id, partner.id, 2.2), 7000, signal)
        await say(fruit, plan.line, 'whisper', signal)
        remember(fruit.id, `Day ${get().day}: you privately told ${partner.name}: "${plan.line}"`)
        remember(partner.id, `Day ${get().day}: ${fruit.name} privately told you: "${plan.line}"`)
        // Done chatting: wander back to its own spot so the plaza doesn't collapse into one huddle.
        set((s) => ({ follow: { ...s.follow, [fruit.id]: undefined } }))
      })(),
    )
    await wait(900, signal)
  }
  await Promise.all(chats)
  await wait(600, signal)
}

async function discussion(lines: DayScript['discussion'], signal: AbortSignal) {
  setPhase('discussion')
  log({ kind: 'system', text: 'Everyone gathers at the campfire.' })
  sendTo((f) => f.seat)
  await until(() => arrived(alive().map((f) => f.id)), 10000, signal)
  for (const line of lines) await say(byId(line.id), line.say, 'say', signal)
}

async function vote(votes: DayScript['votes'], signal: AbortSignal) {
  setPhase('vote')
  set({ votes: {} })
  log({ kind: 'system', text: 'Time to vote.' })
  for (const ballot of votes) {
    const target = byId(ballot.target)
    set((s) => ({ votes: { ...s.votes, [ballot.id]: target.id } }))
    voteTick()
    await say(byId(ballot.id), `I vote ${target.name}. ${ballot.reason}`.trim(), 'vote', signal)
  }

  const tally = new Map<string, number>()
  Object.values(get().votes).forEach((id) => tally.set(id, (tally.get(id) ?? 0) + 1))
  const top = Math.max(...tally.values())
  const leaders = [...tally].filter(([, n]) => n === top).map(([id]) => id)
  if (leaders.length > 1) {
    log({ kind: 'system', text: `The vote is tied between ${leaders.map((id) => byId(id).name).join(' and ')}. Nobody is eliminated.` })
  } else {
    const out = byId(leaders[0])
    kill(out.id)
    log({ kind: 'system', text: `${out.name} is voted out with ${top} votes. They were ${ROLE_LABEL[out.role]}.` })
  }
  await wait(3000, signal)
  set({ votes: {} })
}

/** One batched call writes the whole day; the engine then plays it out. */
async function daytime(brain: Brain, signal: AbortSignal) {
  setPhase('mingle')
  // Spread everyone around the plaza while the day is being decided.
  const living = shuffle(alive())
  const spots = new Map(
    living.map((f, i) => {
      const angle = (i / living.length) * Math.PI * 2 + Math.random() * 0.5
      const radius = 5 + Math.random() * 3
      return [f.id, [Math.cos(angle) * radius, Math.sin(angle) * radius] as [number, number]]
    }),
  )
  sendTo((f) => spots.get(f.id) ?? f.home)
  const [script] = await Promise.all([think(() => brain.playDay(world())), wait(1500, signal)])

  await mingle(script.plans, signal)
  await discussion(script.discussion, signal)
  await vote(script.votes, signal)
}

function finish(side: 'village' | 'werewolves') {
  set({ phase: 'over', winner: side, revealRoles: true, focusId: null })
  sendTo((f) => f.seat)
  dawnChime()
  log({ kind: 'system', text: side === 'village' ? 'Every werewolf is dead. The village wins!' : 'The werewolves have taken over. The werewolves win!' })
}

async function run(signal: AbortSignal) {
  const s = get()
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

  const roles = dealRoles(s.roster.length)
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
    focusId: null,
    calls: 0,
    paused: false,
    revealRoles: false,
  })
  log({
    kind: 'system',
    text: `${fruits.length} fruits, ${wolves.length} werewolf${wolves.length > 1 ? 'es' : ''} among them. Brain: ${useGemini ? `Gemini (${s.settings.model})` : 'no AI (personality rules)'}.`,
  })

  for (let day = 1; ; day++) {
    set({ day })
    await night(brain, signal)
    let side = winner()
    if (side) return finish(side)
    await daytime(brain, signal)
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
  get().backToSetup()
}
