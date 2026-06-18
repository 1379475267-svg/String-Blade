import { type ChordName, chordOrder } from '../game/audio/AudioChordDetector'
import type { BattleHudState } from '../game/scenes/BattleScene'
import { type BestStats, loadBestStats, saveBestStats } from '../storage/bestStats'
import { ChordChartRenderer } from './ChordChartRenderer'

export type InputHudState = {
  micMessage: string
  micState: string
  midiMessage: string
  midiState: string
  calibrationMessage: string
}

type HudElements = {
  shell: HTMLElement
  score: HTMLElement
  combo: HTMLElement
  wave: HTMLElement
  bestScore: HTMLElement
  bestWave: HTMLElement
  bestCombo: HTMLElement
  mode: HTMLElement
  level: HTMLElement
  progression: HTMLElement
  rhythm: HTMLElement
  rhythmMeter: HTMLElement
  rhythmRating: HTMLElement
  pauseButton: HTMLButtonElement
  pauseState: HTMLElement
  chartChord: HTMLElement
  chordChart: HTMLElement
  target: HTMLElement
  defense: HTMLElement
  status: HTMLElement
  detected: HTMLElement
  confidence: HTMLElement
  volume: HTMLElement
  mic: HTMLElement
  midi: HTMLElement
  calibration: HTMLElement
  chordButtons: Record<ChordName, HTMLElement>
}

const requireElement = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector)
  if (!element) {
    throw new Error(`Missing UI element: ${selector}`)
  }
  return element
}

export class HudController {
  private readonly elements: HudElements
  private readonly chartRenderer: ChordChartRenderer
  private bestStats: BestStats

  constructor() {
    const chordButtons = {} as Record<ChordName, HTMLElement>
    for (const chord of chordOrder) {
      chordButtons[chord] = requireElement(`#pad${chord}`)
    }

    this.elements = {
      shell: requireElement('.game-shell'),
      score: requireElement('#score'),
      combo: requireElement('#combo'),
      wave: requireElement('#wave'),
      bestScore: requireElement('#bestScore'),
      bestWave: requireElement('#bestWave'),
      bestCombo: requireElement('#bestCombo'),
      mode: requireElement('#modeLabel'),
      level: requireElement('#levelName'),
      progression: requireElement('#progressionSteps'),
      rhythm: requireElement('#rhythmMeter i'),
      rhythmMeter: requireElement('#rhythmMeter'),
      rhythmRating: requireElement('#rhythmRating'),
      pauseButton: requireElement('#pauseButton'),
      pauseState: requireElement('#pauseState'),
      chartChord: requireElement('#chartChord'),
      chordChart: requireElement('#chordChart'),
      target: requireElement('#target'),
      defense: requireElement('#defense'),
      status: requireElement('#battleStatus'),
      detected: requireElement('#detected'),
      confidence: requireElement('#confidence'),
      volume: requireElement('#volume'),
      mic: requireElement('#micState'),
      midi: requireElement('#midiState'),
      calibration: requireElement('#calibrationState'),
      chordButtons,
    }
    this.chartRenderer = new ChordChartRenderer(this.elements.chartChord, this.elements.chordChart)
    this.bestStats = loadBestStats()
    this.writeBestStats()
    this.chartRenderer.render('C')
  }

  update(state: BattleHudState, inputState: InputHudState) {
    this.updateBestStats(state)

    this.elements.score.textContent = String(state.score)
    this.elements.combo.textContent = `${state.combo}x`
    this.elements.wave.textContent = String(state.wave)
    this.elements.mode.textContent = state.mode === 'duel' ? 'Duel' : 'Progression'
    this.elements.level.textContent = state.mode === 'duel' ? 'Duel Mode' : state.levelName || 'Progression'
    this.elements.progression.innerHTML = (state.mode === 'progression' ? state.progression : [])
      .map((chord, index) => `<span class="${index === state.progressionIndex ? 'is-current' : ''}">${chord}</span>`)
      .join('')

    const rhythmPercent =
      state.mode === 'progression'
        ? Math.max(0, Math.min(100, (state.rhythmTimeLeft / Math.max(0.1, state.rhythmBeatSeconds || 1)) * 100))
        : 100
    this.elements.rhythm.style.width = `${rhythmPercent}%`
    this.elements.rhythmMeter.dataset.rating = state.rhythmRating
    this.elements.rhythmRating.textContent =
      state.mode === 'progression' ? state.rhythmRating.toUpperCase() : 'Duel timing'

    this.elements.shell.dataset.paused = String(state.paused)
    this.elements.pauseButton.textContent = state.paused ? 'Resume' : 'Pause'
    this.elements.pauseButton.classList.toggle('is-paused', state.paused)
    this.elements.pauseState.textContent = state.paused ? 'Paused' : 'Live'
    this.elements.pauseState.dataset.state = state.paused ? 'paused' : 'live'

    this.elements.target.textContent = state.target
    this.elements.defense.textContent = state.mode === 'duel' ? state.defense : '-'
    this.elements.status.textContent = state.status
    this.elements.detected.textContent = state.detected ?? '-'
    this.elements.confidence.textContent = `${Math.round(state.confidence * 100)}%`
    this.elements.volume.textContent = `${Math.round(state.volume * 100)}%`
    this.elements.mic.textContent = inputState.micMessage
    this.elements.mic.dataset.state = inputState.micState
    this.elements.midi.textContent = inputState.midiMessage
    this.elements.midi.dataset.state = inputState.midiState
    this.elements.calibration.textContent = inputState.calibrationMessage

    for (const chord of chordOrder) {
      this.elements.chordButtons[chord].classList.toggle('is-target', chord === state.target)
      this.elements.chordButtons[chord].classList.toggle('is-defense', state.mode === 'duel' && chord === state.defense)
      this.elements.chordButtons[chord].classList.toggle('is-detected', chord === state.detected)
    }

    this.chartRenderer.render(state.target)
  }

  private updateBestStats(state: BattleHudState) {
    const nextBest = {
      score: Math.max(this.bestStats.score, state.score),
      wave: Math.max(this.bestStats.wave, state.wave),
      combo: Math.max(this.bestStats.combo, state.combo),
    }
    if (
      nextBest.score !== this.bestStats.score ||
      nextBest.wave !== this.bestStats.wave ||
      nextBest.combo !== this.bestStats.combo
    ) {
      this.bestStats = nextBest
      saveBestStats(this.bestStats)
      this.writeBestStats()
    }
  }

  private writeBestStats() {
    this.elements.bestScore.textContent = String(this.bestStats.score)
    this.elements.bestWave.textContent = String(this.bestStats.wave)
    this.elements.bestCombo.textContent = `${this.bestStats.combo}x`
  }
}
