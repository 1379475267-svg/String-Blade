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
  private readonly textCache = new WeakMap<HTMLElement, string>()
  private readonly dataCache = new WeakMap<HTMLElement, string>()
  private lastProgressionKey = ''
  private lastChartChord: ChordName = 'C'

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

    this.setText(this.elements.score, String(state.score))
    this.setText(this.elements.combo, `${state.combo}x`)
    this.setText(this.elements.wave, String(state.wave))
    this.setText(this.elements.mode, state.mode === 'duel' ? 'Duel' : 'Progression')
    this.setText(this.elements.level, state.mode === 'duel' ? 'Duel Mode' : state.levelName || 'Progression')

    const progressionKey =
      state.mode === 'progression' ? `${state.progression.join('|')}:${state.progressionIndex}` : 'duel'
    if (progressionKey !== this.lastProgressionKey) {
      this.elements.progression.innerHTML = (state.mode === 'progression' ? state.progression : [])
        .map((chord, index) => `<span class="${index === state.progressionIndex ? 'is-current' : ''}">${chord}</span>`)
        .join('')
      this.lastProgressionKey = progressionKey
    }

    const rhythmPercent =
      state.mode === 'progression'
        ? Math.max(0, Math.min(100, (state.rhythmTimeLeft / Math.max(0.1, state.rhythmBeatSeconds || 1)) * 100))
        : 100
    this.elements.rhythm.style.width = `${rhythmPercent}%`
    this.setData(this.elements.rhythmMeter, 'rating', state.rhythmRating)
    this.setText(this.elements.rhythmRating, state.mode === 'progression' ? state.rhythmRating.toUpperCase() : 'Duel timing')

    this.setData(this.elements.shell, 'paused', String(state.paused))
    this.setText(this.elements.pauseButton, state.paused ? 'Resume' : 'Pause')
    this.elements.pauseButton.classList.toggle('is-paused', state.paused)
    this.setText(this.elements.pauseState, state.paused ? 'Paused' : 'Live')
    this.setData(this.elements.pauseState, 'state', state.paused ? 'paused' : 'live')

    this.setText(this.elements.target, state.target)
    this.setText(this.elements.defense, state.mode === 'duel' ? state.defense : '-')
    this.setText(this.elements.status, state.status)
    this.setText(this.elements.detected, state.detected ?? '-')
    this.setText(this.elements.confidence, `${Math.round(state.confidence * 100)}%`)
    this.setText(this.elements.volume, `${Math.round(state.volume * 100)}%`)
    this.setText(this.elements.mic, inputState.micMessage)
    this.setData(this.elements.mic, 'state', inputState.micState)
    this.setText(this.elements.midi, inputState.midiMessage)
    this.setData(this.elements.midi, 'state', inputState.midiState)
    this.setText(this.elements.calibration, inputState.calibrationMessage)

    for (const chord of chordOrder) {
      this.elements.chordButtons[chord].classList.toggle('is-target', chord === state.target)
      this.elements.chordButtons[chord].classList.toggle('is-defense', state.mode === 'duel' && chord === state.defense)
      this.elements.chordButtons[chord].classList.toggle('is-detected', chord === state.detected)
    }

    if (state.target !== this.lastChartChord) {
      this.chartRenderer.render(state.target)
      this.lastChartChord = state.target
    }
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
    this.setText(this.elements.bestScore, String(this.bestStats.score))
    this.setText(this.elements.bestWave, String(this.bestStats.wave))
    this.setText(this.elements.bestCombo, `${this.bestStats.combo}x`)
  }

  private setText(element: HTMLElement, value: string) {
    if (this.textCache.get(element) === value) {
      return
    }

    element.textContent = value
    this.textCache.set(element, value)
  }

  private setData(element: HTMLElement, key: string, value: string) {
    const cacheKey = `${key}:${value}`
    if (this.dataCache.get(element) === cacheKey) {
      return
    }

    element.dataset[key] = value
    this.dataCache.set(element, cacheKey)
  }
}
