import type { FruitKind, Role } from '../sim/types'

/** Skin colour, inside (flesh) colour and squash per fruit kind. Shared by the 3D fruit and the UI. */
export const LOOKS: Record<FruitKind, { color: string; flesh: string; scale: [number, number, number] }> = {
  apple: { color: '#d8342c', flesh: '#fff3d6', scale: [1, 0.92, 1] },
  orange: { color: '#f08a1c', flesh: '#ffc266', scale: [1, 0.95, 1] },
  lemon: { color: '#f2d43a', flesh: '#fff6a8', scale: [0.85, 0.9, 1.15] },
  plum: { color: '#6b3fa0', flesh: '#f2c078', scale: [0.92, 1, 0.92] },
  pear: { color: '#a9c94a', flesh: '#fbf6d0', scale: [0.9, 1.15, 0.9] },
  lime: { color: '#58b033', flesh: '#d9f29a', scale: [0.9, 0.88, 1.05] },
  peach: { color: '#f7a072', flesh: '#ffd08a', scale: [1, 0.97, 0.95] },
  blueberry: { color: '#3d58b8', flesh: '#b9a3d9', scale: [0.95, 0.88, 0.95] },
  cherry: { color: '#a8102a', flesh: '#e0566f', scale: [0.9, 0.9, 0.9] },
  kiwi: { color: '#8a6a3b', flesh: '#9bd45a', scale: [0.88, 1.05, 0.88] },
}

export const ROLE_TAG: Record<Role, string> = {
  werewolf: 'Wolf',
  villager: 'Villager',
  seer: 'Seer',
  doctor: 'Doctor',
  hunter: 'Hunter',
  jester: 'Jester',
}
