import { useEffect } from 'react'

const GAP = 8 // pixels kept between two bubbles
const EASE = 0.25

/**
 * Keeps speech and thought bubbles from covering each other. Every bubble is drawn over its
 * own fruit, so when fruits stand close together, or line up from where the camera is, their
 * bubbles land on the same patch of screen. This looks at where the bubbles actually are on
 * screen and lifts the overlapping ones up into a stack, each joined to its fruit by a line.
 * Because it works on screen positions, it follows the camera as it moves.
 */
export default function BubbleLayout() {
  useEffect(() => {
    let frame = 0
    const lifts = new WeakMap<HTMLElement, number>()

    const tick = () => {
      frame = requestAnimationFrame(tick)
      const boxes = [...document.querySelectorAll<HTMLElement>('.fruit-tag .bubble')].map((el) => {
        const lift = lifts.get(el) ?? 0
        const rect = el.getBoundingClientRect()
        // Where the bubble would be if it had not been lifted.
        return { el, left: rect.left, right: rect.right, top: rect.top + lift, bottom: rect.bottom + lift, lift, want: 0 }
      })
      // Other fruits' name tags never move, and a bubble should not sit under one either.
      const names = [...document.querySelectorAll<HTMLElement>('.fruit-tag .name')].map((el) => {
        const rect = el.getBoundingClientRect()
        return { el, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, lift: 0, want: 0 }
      })
      // The lowest bubble on screen stays put; the ones above it make room.
      boxes.sort((a, b) => b.bottom - a.bottom)
      boxes.forEach((box, i) => {
        const tag = box.el.closest('.fruit-tag')
        const obstacles = [...names.filter((name) => name.el.closest('.fruit-tag') !== tag), ...boxes.slice(0, i)]
        for (let pass = 0; pass < obstacles.length; pass++) {
          let moved = false
          for (const other of obstacles) {
            const sideBySide = box.right + GAP < other.left || other.right + GAP < box.left
            const clear = box.bottom - box.want + GAP <= other.top - other.want || box.top - box.want >= other.bottom - other.want + GAP
            if (sideBySide || clear) continue
            box.want = box.bottom - (other.top - other.want) + GAP
            moved = true
          }
          if (!moved) break
        }
      })
      for (const box of boxes) {
        const next = Math.abs(box.want - box.lift) < 0.5 ? box.want : box.lift + (box.want - box.lift) * EASE
        if (next === box.lift) continue
        lifts.set(box.el, next)
        box.el.style.transform = next ? `translateY(${-next}px)` : ''
        box.el.style.setProperty('--lift', `${next}px`)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])
  return null
}
