import type { FruitKind, Role } from '../sim/types'

/** Body colour and squash per fruit kind. Shared by the 3D fruit, its hut roof and the UI. */
export const LOOKS: Record<FruitKind, { color: string; scale: [number, number, number] }> = {
  apple: { color: '#d8342c', scale: [1, 0.92, 1] },
  orange: { color: '#f08a1c', scale: [1, 0.95, 1] },
  lemon: { color: '#f2d43a', scale: [0.85, 0.9, 1.15] },
  plum: { color: '#6b3fa0', scale: [0.92, 1, 0.92] },
  pear: { color: '#a9c94a', scale: [0.9, 1.15, 0.9] },
  lime: { color: '#58b033', scale: [0.9, 0.88, 1.05] },
  peach: { color: '#f7a072', scale: [1, 0.97, 0.95] },
  blueberry: { color: '#3d58b8', scale: [0.95, 0.88, 0.95] },
  cherry: { color: '#a8102a', scale: [0.9, 0.9, 0.9] },
  kiwi: { color: '#8a6a3b', scale: [0.88, 1.05, 0.88] },
}

export const ROLE_TAG: Record<Role, string> = { werewolf: 'Wolf', villager: 'Villager', seer: 'Seer', doctor: 'Doctor' }
