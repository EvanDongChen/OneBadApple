import { GeminiBrain } from './geminiBrain'
import { MockBrain } from './mockBrain'
import { babble, dawnChime, nightChime, thud, voteTick } from './sfx'
import { fruitPositions, layout, useSim } from './store'
import type { AgentView, Brain, FruitState, LogEntry, Phase, Role } from './types'

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

function viewOf(fruit: FruitState): AgentView {
  const s = get()
  return {
    self: byId(fruit.id),
    day: s.day,
    others: s.fruits.filter((f) => f.alive && f.id !== fruit.id).map((f) => ({ id: f.id, name: f.name })),
    publicLog: s.log
      .filter((e) => e.kind !== 'whisper')
      .slice(-30)
      .map((e) => (e.name ? `${e.name}: ${e.text}` : `[${e.text}]`)),
  }
}

/** Run one brain decision for a fruit, showing a "thinking" bubble while it is pending. */
async function think<T>(fruit: FruitState, decide: (view: AgentView) => Promise<T>): Promise<T> {
  set((s) => ({ thinking: { ...s.thinking, [fruit.id]: true } }))
  try {
    return await decide(viewOf(fruit))
  } finally {
    set((s) => ({ thinking: { ...s.thinking, [fruit.id]: false } }))
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
  await until(() => arrived(alive().map((f) => f.id)), 10000, signal)
  await wait(800, signal)

  const living = alive()
  const wolves = living.filter((f) => f.role === 'werewolf')
  const prey = living.filter((f) => f.role !== 'werewolf').map((f) => ({ id: f.id, name: f.name }))
  const hunter = wolves[0]
  const victimId = (await think(hunter, (v) => brain.nightAction(v, prey))).target
  const victim = byId(victimId)
  wolves.forEach((w) => remember(w.id, `Night ${day}: the werewolves chose to attack ${victim.name}.`))

  let protectedId: string | null = null
  const doctor = living.find((f) => f.role === 'doctor')
  if (doctor) {
    const options = living.map((f) => ({ id: f.id, name: f.name }))
    protectedId = (await think(doctor, (v) => brain.nightAction(v, options))).target
    remember(doctor.id, `Night ${day}: you protected ${byId(protectedId).name}.`)
  }

  const seer = living.find((f) => f.role === 'seer')
  if (seer) {
    const options = living.filter((f) => f.id !== seer.id).map((f) => ({ id: f.id, name: f.name }))
    const seen = byId((await think(seer, (v) => brain.nightAction(v, options))).target)
    remember(
      seer.id,
      `Night ${day}: you inspected ${seen.name}. ${seen.name} is ${seen.role === 'werewolf' ? 'a WEREWOLF' : 'NOT a werewolf'}.`,
    )
  }

  // Act it out: the wolf creeps over to its victim.
  set((s) => ({ follow: { ...s.follow, [hunter.id]: victimId } }))
  await until(() => near(hunter.id, victimId, 2), 9000, signal)
  await wait(500, signal)
  const saved = protectedId === victimId
  if (!saved) kill(victimId)
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
  await wait(2800, signal)
}

async function mingle(brain: Brain, signal: AbortSignal) {
  setPhase('mingle')
  log({ kind: 'system', text: 'The fruits mill about before the meeting.' })
  const living = shuffle(alive())
  // Spread everyone around the plaza first.
  const spots = new Map(
    living.map((f, i) => {
      const angle = (i / living.length) * Math.PI * 2 + Math.random() * 0.5
      const radius = 5 + Math.random() * 3
      return [f.id, [Math.cos(angle) * radius, Math.sin(angle) * radius] as [number, number]]
    }),
  )
  sendTo((f) => spots.get(f.id) ?? f.home)
  await wait(1500, signal)

  const chats: Promise<void>[] = []
  for (const fruit of living) {
    const plan = await think(fruit, (v) => brain.planDay(v))
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
    await wait(500, signal)
  }
  await Promise.all(chats)
  await wait(600, signal)
}

async function discussion(brain: Brain, signal: AbortSignal) {
  setPhase('discussion')
  log({ kind: 'system', text: 'Everyone gathers at the campfire.' })
  sendTo((f) => f.seat)
  await until(() => arrived(alive().map((f) => f.id)), 10000, signal)

  const turns = Math.max(4, Math.min(12, Math.round(alive().length * 1.5)))
  let last = ''
  for (let i = 0; i < turns; i++) {
    // Chattier fruits get the floor more often.
    const pool = alive().filter((f) => f.id !== last)
    const total = pool.reduce((sum, f) => sum + 0.25 + f.traits.talkativeness, 0)
    let roll = Math.random() * total
    const speaker = pool.find((f) => (roll -= 0.25 + f.traits.talkativeness) <= 0) ?? pool[0]
    last = speaker.id
    const { say: line } = await think(speaker, (v) => brain.speak(v))
    await say(speaker, line, 'say', signal)
  }
}

async function vote(brain: Brain, signal: AbortSignal) {
  setPhase('vote')
  set({ votes: {} })
  log({ kind: 'system', text: 'Time to vote.' })
  for (const voter of alive()) {
    const choice = await think(voter, (v) => brain.vote(v))
    const target = byId(choice.target)
    set((s) => ({ votes: { ...s.votes, [voter.id]: target.id } }))
    voteTick()
    await say(voter, `I vote ${target.name}. ${choice.reason}`.trim(), 'vote', signal)
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
    text: `${fruits.length} fruits, ${wolves.length} werewolf${wolves.length > 1 ? 'es' : ''} among them. Brain: ${useGemini ? `Gemini (${s.settings.model})` : 'test mode (canned)'}.`,
  })

  for (let day = 1; ; day++) {
    set({ day })
    await night(brain, signal)
    let side = winner()
    if (side) return finish(side)
    await mingle(brain, signal)
    await discussion(brain, signal)
    await vote(brain, signal)
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
