import { useState } from 'react'
import { startGame } from '../sim/engine'
import { listGeminiModels } from '../sim/geminiBrain'
import { unlockAudio } from '../sim/sfx'
import { TEMPERS } from '../sim/mind'
import { MAX_QUIRKS, presetOf, QUIRK_PRESETS, quirkLabel, quirkText } from '../sim/quirks'
import { MAX_FRUITS, MIN_FRUITS, maxWolves, useSim } from '../sim/store'
import { FRUIT_KINDS, TRAIT_KEYS } from '../sim/types'
import type { FruitKind, Temper } from '../sim/types'
import { LOOKS } from './fruitLooks'

const TRAIT_LABELS: Record<(typeof TRAIT_KEYS)[number], string> = {
  aggression: 'Aggression',
  honesty: 'Honesty',
  talkativeness: 'Talkative',
  suspicion: 'Suspicion',
}

/** What a dragged quirk carries: which quirk, and which villager it came off, if any. */
interface Carried {
  quirk: string
  from?: string
}

function carried(event: React.DragEvent): Carried | null {
  try {
    const data = JSON.parse(event.dataTransfer.getData('text/plain'))
    return typeof data?.quirk === 'string' ? data : null
  } catch {
    return null
  }
}

/** A quirk as a pill you can drag. In the tray it can also be tapped to pick it up; on a villager it has a remove button. */
function Chip({ quirk, from, held, onPick, onRemove }: { quirk: string; from?: string; held?: boolean; onPick?(): void; onRemove?(): void }) {
  return (
    <span
      className={`chip${presetOf(quirk) ? '' : ' custom'}${held ? ' held' : ''}`}
      style={{ '--tint': presetOf(quirk)?.tint } as React.CSSProperties}
      title={quirkText(quirk)}
      draggable
      role={onPick ? 'button' : undefined}
      tabIndex={onPick ? 0 : undefined}
      aria-pressed={onPick ? !!held : undefined}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ quirk, from }))
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onPick}
      onKeyDown={(e) => {
        if (onPick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onPick()
        }
      }}
    >
      {quirkLabel(quirk)}
      {onRemove && (
        <button
          className="chip-x"
          aria-label={`Remove ${quirkLabel(quirk)}`}
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          ×
        </button>
      )}
    </span>
  )
}

/** Pre-game screen: pick the brain, edit each fruit's personality, start the simulation. */
export default function SetupPanel() {
  const roster = useSim((s) => s.roster)
  const settings = useSim((s) => s.settings)
  const { updateFruit, addFruit, removeFruit, randomizeRoster, setSettings, setRules } = useSim.getState()
  const { rules } = settings
  const wolfLimit = maxWolves(roster.length)
  const wolves = Math.min(rules.wolves, wolfLimit)
  // Special roles that won't fit once the wolves are seated are dropped, last ticked first.
  const specials = (['seer', 'doctor', 'hunter', 'jester'] as const).filter((r) => rules[r])
  const dropped = specials.slice(Math.max(0, roster.length - wolves))
  const [openId, setOpenId] = useState<string | null>(roster[0]?.id ?? null)
  const [models, setModels] = useState<string[]>([])
  const [modelStatus, setModelStatus] = useState('')
  // Quirks: the one picked up by tapping, the ones the user has written, and the card being dragged over.
  const [held, setHeld] = useState<string | null>(null)
  const [custom, setCustom] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [overId, setOverId] = useState<string | null>(null)

  function take(id: string, quirk: string) {
    const fruit = roster.find((f) => f.id === id)
    if (fruit) updateFruit(id, { traits: { quirks: fruit.traits.quirks.filter((q) => q !== quirk) } })
  }

  /** Give a villager a quirk. If it was dragged off another villager, it moves rather than copies. */
  function give(id: string, quirk: string, from?: string) {
    const fruit = roster.find((f) => f.id === id)
    if (!fruit || from === id || fruit.traits.quirks.includes(quirk) || fruit.traits.quirks.length >= MAX_QUIRKS) return
    updateFruit(id, { traits: { quirks: [...fruit.traits.quirks, quirk] } })
    if (from) take(from, quirk)
  }

  function makeQuirk() {
    const text = draft.trim()
    if (!text) return
    if (!presetOf(text) && !custom.includes(text)) setCustom([...custom, text])
    // Pick the new quirk up straight away, ready to hand to a villager.
    setHeld(text)
    setDraft('')
  }

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
      <div className="brand">
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" />
        <h1>
          One Bad
          <br />
          Apple
        </h1>
      </div>
      <p className="tagline">A village of fruit plays Werewolf. One of them is rotten.</p>

      <section>
        <h2>Who does the thinking?</h2>
        <div className="segmented">
          <button className={settings.brain === 'gemini' ? 'on' : ''} onClick={() => setSettings({ brain: 'gemini' })}>
            Gemini AI
          </button>
          <button className={settings.brain === 'test' ? 'on' : ''} onClick={() => setSettings({ brain: 'test' })}>
            No AI
          </button>
        </div>
        {settings.brain === 'test' ? (
          <p className="muted">Each fruit decides from its personality sliders and what it has seen, and speaks from stock lines. No key, no cost.</p>
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

      {/* Near the top, so the game can be started without scrolling past every villager. */}
      <button className="primary" onClick={start} disabled={needsKey}>
        {needsKey ? 'Paste a Gemini key first' : 'Wake the village'}
      </button>

      <section>
        <h2>House rules</h2>
        <div className="row">
          <label>
            Werewolves
            <select value={wolves} onChange={(e) => setRules({ wolves: Number(e.target.value) })}>
              {Array.from({ length: wolfLimit }, (_, i) => (
                <option key={i + 1}>{i + 1}</option>
              ))}
            </select>
          </label>
          <label>
            Rounds of talk per day
            <select value={rules.rounds} onChange={(e) => setRules({ rounds: Number(e.target.value) })}>
              {[1, 2, 3, 4].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="checks">
          {(
            [
              ['seer', 'Seer', 'Learns one fruit\'s side each night'],
              ['doctor', 'Doctor', 'Saves one fruit each night'],
              ['hunter', 'Hunter', 'Takes someone down when it dies'],
              ['jester', 'Jester', 'Wins alone if voted out'],
            ] as const
          ).map(([key, label, hint]) => (
            <label key={key} className="check">
              <input type="checkbox" checked={rules[key]} onChange={(e) => setRules({ [key]: e.target.checked })} />
              <span>
                <b>{label}</b>
                <small>{hint}</small>
              </span>
            </label>
          ))}
        </div>
        {dropped.length > 0 && <p className="muted">Not enough fruits for: {dropped.join(', ')}. Add more villagers or untick a role.</p>}
      </section>

      <section>
        <div className="row spread">
          <h2>The villagers ({roster.length})</h2>
          <div className="row">
            <button onClick={randomizeRoster}>Shuffle</button>
            <button onClick={addFruit} disabled={roster.length >= MAX_FRUITS}>
              + Add
            </button>
          </div>
        </div>
        <div
          className="tray"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            // Dragging a quirk off a villager and back to the tray removes it.
            e.preventDefault()
            const drop = carried(e)
            if (drop?.from) take(drop.from, drop.quirk)
          }}
        >
          <h2>Quirks</h2>
          <p className="muted">
            {held
              ? `Now tap a villager to give it "${quirkLabel(held)}". Tap the quirk again to put it down.`
              : 'Drag a quirk onto a villager, or tap a quirk and then a villager. Up to three each.'}
          </p>
          <div className="chips">
            {[...QUIRK_PRESETS.map((p) => p.id), ...custom].map((quirk) => (
              <Chip key={quirk} quirk={quirk} held={held === quirk} onPick={() => setHeld(held === quirk ? null : quirk)} />
            ))}
          </div>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault()
              makeQuirk()
            }}
          >
            <input value={draft} maxLength={80} placeholder="Or write your own: Only speaks in questions" onChange={(e) => setDraft(e.target.value)} />
            <button type="submit" disabled={!draft.trim()}>
              Make
            </button>
          </form>
        </div>

        {roster.map((fruit) => {
          const open = openId === fruit.id
          const { quirks } = fruit.traits
          const room = quirks.length < MAX_QUIRKS
          return (
            <div
              key={fruit.id}
              className={`card${overId === fruit.id ? ' over' : ''}${held && room && !quirks.includes(held) ? ' target' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setOverId(fruit.id)
              }}
              onDragLeave={() => setOverId((id) => (id === fruit.id ? null : id))}
              onDrop={(e) => {
                e.preventDefault()
                setOverId(null)
                const drop = carried(e)
                if (drop) give(fruit.id, drop.quirk, drop.from)
              }}
            >
              {/* While a quirk is picked up, tapping a villager hands it over instead of opening the card. */}
              <button className="card-head" onClick={() => (held ? give(fruit.id, held) : setOpenId(open ? null : fruit.id))}>
                <span className="dot" style={{ background: LOOKS[fruit.kind].color }} />
                <b>{fruit.name}</b>
                <span className="muted">{fruit.kind}</span>
                <span className="chev">{open ? '−' : '+'}</span>
              </button>
              <div className="card-quirks">
                {quirks.map((quirk) => (
                  <Chip key={quirk} quirk={quirk} from={fruit.id} onRemove={() => take(fruit.id, quirk)} />
                ))}
                {!quirks.length && <span className="muted">No quirks yet. Drop one here.</span>}
                {!room && <span className="muted">Full</span>}
              </div>
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
                    How it changes its mind
                    <select value={fruit.traits.temper} onChange={(e) => updateFruit(fruit.id, { traits: { temper: e.target.value as Temper } })}>
                      {(Object.keys(TEMPERS) as Temper[]).map((temper) => (
                        <option key={temper} value={temper}>
                          {TEMPERS[temper].label}: {TEMPERS[temper].text}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Backstory, in its own words
                    <input
                      value={fruit.traits.backstory}
                      maxLength={100}
                      placeholder="I used to be in a pie. I got out."
                      onChange={(e) => updateFruit(fruit.id, { traits: { backstory: e.target.value } })}
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
    </aside>
  )
}
