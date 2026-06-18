import type { ChordName } from '../game/audio/AudioChordDetector'
import { guitarChordShapes } from '../game/music/ChordLibrary'

export class ChordChartRenderer {
  private readonly chordLabel: HTMLElement
  private readonly chartContainer: HTMLElement

  constructor(chordLabel: HTMLElement, chartContainer: HTMLElement) {
    this.chordLabel = chordLabel
    this.chartContainer = chartContainer
  }

  render(chord: ChordName) {
    const shape = guitarChordShapes[chord]
    const strings = 6
    const frets = 5
    const width = 210
    const height = 160
    const left = 34
    const top = 26
    const gridWidth = 142
    const gridHeight = 104
    const stringGap = gridWidth / (strings - 1)
    const fretGap = gridHeight / frets
    const dots = shape.frets
      .map((fret, index) => {
        const x = left + index * stringGap
        if (fret === 'x') {
          return `<text x="${x}" y="17" text-anchor="middle" class="muted">x</text>`
        }
        if (fret === 0) {
          return `<text x="${x}" y="17" text-anchor="middle" class="open">o</text>`
        }
        const y = top + (fret - 0.5) * fretGap
        const finger = shape.fingers[index]
        return `<g><circle cx="${x}" cy="${y}" r="10" class="finger"/><text x="${x}" y="${y + 4}" text-anchor="middle" class="finger-text">${finger}</text></g>`
      })
      .join('')
    const stringLines = Array.from({ length: strings }, (_, index) => {
      const x = left + index * stringGap
      return `<line x1="${x}" y1="${top}" x2="${x}" y2="${top + gridHeight}" class="string"/>`
    }).join('')
    const fretLines = Array.from({ length: frets + 1 }, (_, index) => {
      const y = top + index * fretGap
      return `<line x1="${left}" y1="${y}" x2="${left + gridWidth}" y2="${y}" class="${index === 0 ? 'nut' : 'fret'}"/>`
    }).join('')

    this.chordLabel.textContent = chord
    this.chartContainer.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${chord} guitar chord chart">
        <text x="${width / 2}" y="148" text-anchor="middle" class="chart-title">${chord}</text>
        ${stringLines}
        ${fretLines}
        ${dots}
      </svg>
    `
  }
}
