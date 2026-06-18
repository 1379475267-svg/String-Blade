import type { ChordName } from '../audio/AudioChordDetector'

export type Difficulty = 'easy' | 'normal' | 'hard'

export type GuitarChordShape = {
  frets: Array<number | 'x'>
  fingers: string[]
  baseFret?: number
}

export type ProgressionLevel = {
  id: string
  name: string
  difficulty: Difficulty
  chords: ChordName[]
  beatSeconds: number
}

export const progressionLevels: ProgressionLevel[] = [
  { id: 'campfire', name: 'Campfire I-V-vi-IV', difficulty: 'easy', chords: ['C', 'G', 'Am', 'F'], beatSeconds: 2.6 },
  { id: 'bright', name: 'Bright Pop Loop', difficulty: 'easy', chords: ['G', 'D', 'Em', 'C'], beatSeconds: 2.5 },
  { id: 'minor-road', name: 'Minor Road', difficulty: 'normal', chords: ['Am', 'F', 'C', 'G'], beatSeconds: 2.05 },
  { id: 'classic', name: 'Classic Turnaround', difficulty: 'normal', chords: ['C', 'Am', 'F', 'G'], beatSeconds: 2.0 },
  { id: 'drive', name: 'Driving Minor Pop', difficulty: 'hard', chords: ['Em', 'C', 'G', 'D'], beatSeconds: 1.65 },
  { id: 'shadow', name: 'Shadow Cadence', difficulty: 'hard', chords: ['Dm', 'F', 'A', 'E'], beatSeconds: 1.55 },
]

export const guitarChordShapes: Record<ChordName, GuitarChordShape> = {
  C: { frets: ['x', 3, 2, 0, 1, 0], fingers: ['', '3', '2', '', '1', ''] },
  G: { frets: [3, 2, 0, 0, 0, 3], fingers: ['2', '1', '', '', '', '3'] },
  Am: { frets: ['x', 0, 2, 2, 1, 0], fingers: ['', '', '2', '3', '1', ''] },
  Em: { frets: [0, 2, 2, 0, 0, 0], fingers: ['', '2', '3', '', '', ''] },
  D: { frets: ['x', 'x', 0, 2, 3, 2], fingers: ['', '', '', '1', '3', '2'] },
  Dm: { frets: ['x', 'x', 0, 2, 3, 1], fingers: ['', '', '', '2', '3', '1'] },
  E: { frets: [0, 2, 2, 1, 0, 0], fingers: ['', '2', '3', '1', '', ''] },
  A: { frets: ['x', 0, 2, 2, 2, 0], fingers: ['', '', '1', '2', '3', ''] },
  F: { frets: [1, 3, 3, 2, 1, 1], fingers: ['1', '3', '4', '2', '1', '1'] },
}

export const getLevelForDifficulty = (difficulty: Difficulty) =>
  progressionLevels.find((level) => level.difficulty === difficulty) ?? progressionLevels[0]
