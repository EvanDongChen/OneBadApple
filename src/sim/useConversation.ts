import { useEffect } from 'react'
import { useSim } from './store'
import type { Brain } from './types'

const GATHER_DELAY_MS = 5000
const GAP_MS = 700

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Drives the talk loop: pick a speaker, ask the brain for a line, show it, repeat. */
export function useConversation(brain: Brain) {
  useEffect(() => {
    let cancelled = false

    async function run() {
      await sleep(GATHER_DELAY_MS)
      let lastSpeakerId = ''
      while (!cancelled) {
        const { fruits, log, paused, say, clearSpeech } = useSim.getState()
        if (paused) {
          await sleep(250)
          continue
        }
        const candidates = fruits.filter((f) => f.id !== lastSpeakerId)
        const speaker = candidates[Math.floor(Math.random() * candidates.length)]
        const text = await brain.speak({
          speaker,
          others: fruits.filter((f) => f.id !== speaker.id),
          history: log.slice(-8),
        })
        if (cancelled) return
        lastSpeakerId = speaker.id
        say({ speakerId: speaker.id, name: speaker.name, text })
        await sleep(1600 + text.length * 45)
        if (cancelled) return
        clearSpeech()
        await sleep(GAP_MS)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [brain])
}
