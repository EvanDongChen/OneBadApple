import type { AgentView, Brain, Choice, DayPlan, Speech } from './types'

const OPENERS = [
  'Did anyone else hear rustling last night?',
  '{other} has been staring at me. I saw it.',
  "I'm not saying it's {other}. I'm saying it's suspicious.",
  'Can we all agree to stay calm and stay juicy?',
  "It's {other}. It's always {other}.",
  'I was asleep. Like a normal fruit.',
  'I dreamt {other} had very big teeth...',
  "I'm sure {other} is innocent. Look at that face!",
  'Somebody here smells like wolf.',
  'Vote already. My legs are tired.',
]

const WHISPERS = [
  'Psst. Do you trust {other}?',
  "Between us, I think it's {other}.",
  "Stick with me today, okay? I've got a bad feeling.",
  'You looked nervous this morning. Just saying.',
  "If I go missing tonight, it was {other}.",
]

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

/** Random-but-legal decisions and canned lines. No network, no key. */
export class MockBrain implements Brain {
  private knownWolf(view: AgentView) {
    // A seer who has found a wolf acts on it.
    return view.others.find((o) => view.self.memory.some((m) => m.includes(`${o.name} is a WEREWOLF`)))
  }

  private packmate(view: AgentView, id: string) {
    const name = view.others.find((o) => o.id === id)?.name
    return view.self.role === 'werewolf' && view.self.memory.some((m) => m.includes(`Fellow werewolf: ${name}`))
  }

  private suspect(view: AgentView) {
    const options = view.others.filter((o) => !this.packmate(view, o.id))
    return this.knownWolf(view) ?? pick(options.length ? options : view.others)
  }

  async planDay(view: AgentView): Promise<DayPlan> {
    const approach = pick(view.others)
    const about = pick(view.others.filter((o) => o.id !== approach.id).concat(approach))
    return { approach: approach.id, line: pick(WHISPERS).replaceAll('{other}', about.name) }
  }

  async speak(view: AgentView): Promise<Speech> {
    return { say: pick(OPENERS).replaceAll('{other}', this.suspect(view).name) }
  }

  async vote(view: AgentView): Promise<Choice> {
    return { target: this.suspect(view).id, reason: 'Just a feeling.' }
  }

  async nightAction(_view: AgentView, candidates: { id: string; name: string }[]): Promise<Choice> {
    return { target: pick(candidates).id, reason: '' }
  }
}
