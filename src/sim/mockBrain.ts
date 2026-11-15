import type { Brain, Mood, SpeakContext } from './types'

const OPENERS: Record<Mood, string[]> = {
  paranoid: [
    'Did anyone else hear rustling last night?',
    '{other} has been staring at me. I saw it.',
    "I'm not saying it's {other}. I'm saying it's suspicious.",
    'Nobody move. Somebody here smells like wolf.',
  ],
  cheerful: [
    'Lovely morning! Apart from the, you know, incident.',
    "I'm sure {other} is innocent. Look at that face!",
    'Can we all agree to stay calm and stay juicy?',
    'I believe in us! Mostly!',
  ],
  grumpy: [
    'This is a waste of daylight.',
    "It's {other}. It's always {other}.",
    'I was asleep. Like a normal fruit.',
    'Vote already. My legs are tired.',
  ],
  sleepy: [
    'Mm? Is it day already?',
    'I dreamt {other} had very big teeth...',
    "Wake me when it's time to vote.",
    'Sorry, what are we accusing me of?',
  ],
}

const REPLIES: Record<Mood, string[]> = {
  paranoid: [
    "That's exactly what a werewolf would say, {last}.",
    'Why so defensive, {last}?',
    '{last} is deflecting. Write that down.',
  ],
  cheerful: [
    'Good point, {last}! I think!',
    "Aw, {last}, don't be like that.",
    "Let's hear {last} out, friends.",
  ],
  grumpy: [
    'Rich, coming from {last}.',
    'Nobody asked, {last}.',
    'Fine. {last} might have a point. Might.',
  ],
  sleepy: [
    'Wait, what did {last} say?',
    '{last} sounds confident. Too confident? ...zzz.',
    'I agree with {last}. Or the other one.',
  ],
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

/** Canned dialogue for test talk mode. No network, no key. */
export class MockBrain implements Brain {
  async speak({ speaker, others, history }: SpeakContext): Promise<string> {
    const last = history[history.length - 1]
    const replying = last && last.speakerId !== speaker.id && Math.random() < 0.55
    const template = pick(replying ? REPLIES[speaker.mood] : OPENERS[speaker.mood])
    return template
      .replaceAll('{other}', pick(others).name)
      .replaceAll('{last}', last?.name ?? pick(others).name)
  }
}
