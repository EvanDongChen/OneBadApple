import { useState } from 'react'
import { startGame } from '../sim/engine'
import { listGeminiModels } from '../sim/geminiBrain'
import { unlockAudio } from '../sim/sfx'
import { MAX_FRUITS, MIN_FRUITS, useSim } from '../sim/store'
import { FRUIT_KINDS, TRAIT_KEYS } from '../sim/types'
import type { FruitKind } from '../sim/types'
import { LOOKS } from './fruitLooks'

const TRAIT_LABELS: Record<(typeof TRAIT_KEYS)[number], string> = {
  aggression: 'Aggression',
  honesty: 'Honesty',
  talkativeness: 'Talkative',
  suspicion: 'Suspicion',
}

/** Pre-game screen: pick the brain, edit each fruit's personality, start the simulation. */
export default function SetupPanel() {
  const roster = useSim((s) => s.roster)
  const settings = useSim((s) => s.settings)
  const { updateFruit, addFruit, removeFruit, randomizeRoster, setSettings } = useSim.getState()
  const [openId, setOpenId] = useState<string | null>(roster[0]?.id ?? null)
  const [models, setModels] = useState<string[]>([])
  const [modelStatus, setModelStatus] = useState('')

  const needsKey = settings.brain === 'gemini' && !settings.apiKey.trim()

  async function loadModels() {
    setModelStatus('Loading...')
    try {
      const found = await listGeminiModels(settings.apiKey.trim())
      setModels(found)
      setModelStatus(`${found.length} models available`)
    } catch (err) {
      setModelStatus(`Could not load models: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  function start() {
    unlockAudio()
    startGame()
  }

  return (
    <aside className="panel setup">
      <h1>One Bad Apple</h1>
      <p className="muted">A village of fruit plays Werewolf. Set them up, then watch.</p>

      <section>
        <h2>Brain</h2>
        <div className="segmented">
          <button className={settings.brain === 'gemini' ? 'on' : ''} onClick={() => setSettings({ brain: 'gemini' })}>
            Gemini AI
          </button>
          <button className={settings.brain === 'test' ? 'on' : ''} onClick={() => setSettings({ brain: 'test' })}>
            Test mode
          </button>
        </div>
        {settings.brain === 'test' ? (
          <p className="muted">Canned lines and random decisions. No key, no cost.</p>
        ) : (
          <>
            <label>
              Gemini API key
              <input
                type="password"
                value={settings.apiKey}
                placeholder="Paste your key"
                autoComplete="off"
                onChange={(e) => setSettings({ apiKey: e.target.value })}
              />
            </label>
            <p className="muted">Stored only in this browser and sent only to Google.</p>
            <label>
              Model
              <div className="row">
                <select value={settings.model} onChange={(e) => setSettings({ model: e.target.value })}>
                  {[...new Set([settings.model, ...models])].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <button onClick={loadModels} disabled={needsKey}>
                  List
                </button>
              </div>
            </label>
            {modelStatus && <p className="muted">{modelStatus}</p>}
            <div className="row">
              <label>
                Calls per minute
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={settings.requestsPerMinute}
                  onChange={(e) => setSettings({ requestsPerMinute: Math.max(1, Number(e.target.value) || 1) })}
                />
              </label>
              <label>
                Max calls per game
                <input
                  type="number"
                  min={10}
                  value={settings.maxCalls}
                  onChange={(e) => setSettings({ maxCalls: Math.max(10, Number(e.target.value) || 10) })}
                />
              </label>
            </div>
          </>
        )}
      </section>

      <section>
        <div className="row spread">
          <h2>Fruits ({roster.length})</h2>
          <div className="row">
            <button onClick={randomizeRoster}>Shuffle</button>
            <button onClick={addFruit} disabled={roster.length >= MAX_FRUITS}>
              + Add
            </button>
          </div>
        </div>
        {roster.map((fruit) => {
          const open = openId === fruit.id
          return (
            <div key={fruit.id} className="card">
              <button className="card-head" onClick={() => setOpenId(open ? null : fruit.id)}>
                <span className="dot" style={{ background: LOOKS[fruit.kind].color }} />
                <b>{fruit.name}</b>
                <span className="muted">{fruit.kind}</span>
                <span className="chev">{open ? '−' : '+'}</span>
              </button>
              {open && (
                <div className="card-body">
                  <div className="row">
                    <label>
                      Name
                      <input value={fruit.name} maxLength={14} onChange={(e) => updateFruit(fruit.id, { name: e.target.value })} />
                    </label>
                    <label>
                      Fruit
                      <select value={fruit.kind} onChange={(e) => updateFruit(fruit.id, { kind: e.target.value as FruitKind })}>
                        {FRUIT_KINDS.map((k) => (
                          <option key={k}>{k}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {TRAIT_KEYS.map((key) => (
                    <label key={key} className="slider">
                      <span>{TRAIT_LABELS[key]}</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.1}
                        value={fruit.traits[key]}
                        onChange={(e) => updateFruit(fruit.id, { traits: { [key]: Number(e.target.value) } })}
                      />
                      <span className="num">{Math.round(fruit.traits[key] * 10)}</span>
                    </label>
                  ))}
                  <label>
                    Quirk
                    <input
                      value={fruit.traits.quirk}
                      maxLength={120}
                      placeholder="e.g. Talks like a pirate"
                      onChange={(e) => updateFruit(fruit.id, { traits: { quirk: e.target.value } })}
                    />
                  </label>
                  <button className="danger" onClick={() => removeFruit(fruit.id)} disabled={roster.length <= MIN_FRUITS}>
                    Remove {fruit.name}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </section>

      <button className="primary" onClick={start} disabled={needsKey}>
        {needsKey ? 'Enter a Gemini key to start' : 'Start simulation'}
      </button>
    </aside>
  )
}
