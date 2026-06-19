import Phaser from 'phaser'
import { AudioChordDetector, type ChordName, chordOrder } from '../game/audio/AudioChordDetector'
import { MidiChordInput } from '../game/input/MidiChordInput'
import type { Difficulty } from '../game/music/ChordLibrary'
import { BattleScene } from '../game/scenes/BattleScene'
import { createLayout } from '../ui/createLayout'
import { HudController } from '../ui/HudController'

const requireElement = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector)
  if (!element) {
    throw new Error(`Missing UI element: ${selector}`)
  }
  return element
}

export const bootstrap = () => {
  const root = requireElement<HTMLDivElement>('#app')
  createLayout(root)

  const detector = new AudioChordDetector()
  const hud = new HudController()
  let battleScene: BattleScene | null = null
  const midiInput = new MidiChordInput((chord) => {
    battleScene?.triggerChord(chord, true)
  })

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#101722',
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: '100%',
      height: '100%',
    },
    render: {
      antialias: true,
      roundPixels: false,
    },
    scene: [
      new BattleScene({
        onHudChange: (state) =>
          hud.update(state, {
            micMessage: detector.message,
            micState: detector.state,
            midiMessage: midiInput.message,
            midiState: midiInput.state,
            calibrationMessage: detector.calibrationStatus.message,
          }),
      }),
    ],
  }

  const phaserGame = new Phaser.Game(config)

  phaserGame.events.once(Phaser.Core.Events.READY, () => {
    battleScene = phaserGame.scene.getScene('BattleScene') as BattleScene
  })

  bindControls(detector, midiInput, () => battleScene)
  const stopAudioSync = syncAudioToScene(detector, () => battleScene)
  let cleanedUp = false
  const cleanup = () => {
    if (cleanedUp) {
      return
    }

    cleanedUp = true
    stopAudioSync()
    void detector.stop()
    phaserGame.destroy(true)
  }
  const handlePageHide = (event: PageTransitionEvent) => {
    if (!event.persisted) {
      cleanup()
    }
  }

  window.addEventListener('pagehide', handlePageHide, { once: true })
  return cleanup
}

const bindControls = (
  detector: AudioChordDetector,
  midiInput: MidiChordInput,
  getBattleScene: () => BattleScene | null,
) => {
  requireElement<HTMLButtonElement>('#micButton').addEventListener('click', () => {
    void detector.start()
  })
  requireElement<HTMLButtonElement>('#midiButton').addEventListener('click', () => {
    void midiInput.start()
  })

  for (const chord of chordOrder) {
    requireElement<HTMLButtonElement>(`#pad${chord}`).addEventListener('click', () =>
      getBattleScene()?.triggerChord(chord, true),
    )
    requireElement<HTMLButtonElement>(`#cal${chord}`).addEventListener('click', () => detector.startCalibration(chord))
  }

  requireElement<HTMLButtonElement>('#modeDuel').addEventListener('click', () => {
    getBattleScene()?.setMode('duel')
    requireElement<HTMLButtonElement>('#modeDuel').classList.add('is-selected')
    requireElement<HTMLButtonElement>('#modeProgression').classList.remove('is-selected')
  })
  requireElement<HTMLButtonElement>('#modeProgression').addEventListener('click', () => {
    getBattleScene()?.setMode('progression')
    requireElement<HTMLButtonElement>('#modeProgression').classList.add('is-selected')
    requireElement<HTMLButtonElement>('#modeDuel').classList.remove('is-selected')
  })
  const difficultySelect = requireElement<HTMLSelectElement>('#difficultySelect')
  difficultySelect.addEventListener('change', () => {
    const difficulty = difficultySelect.value as Difficulty
    getBattleScene()?.setDifficulty(difficulty)
  })
  requireElement<HTMLButtonElement>('#pauseButton').addEventListener('click', () => {
    getBattleScene()?.togglePaused()
  })
  requireElement<HTMLButtonElement>('#restartButton').addEventListener('click', () => {
    getBattleScene()?.restartRun()
  })

  bindOnboarding()
}

const bindOnboarding = () => {
  const onboarding = requireElement('#onboarding')
  const dismissOnboarding = () => {
    onboarding.classList.add('is-hidden')
    try {
      localStorage.setItem('string-blade-onboarding-seen', 'true')
    } catch {
      // Ignore storage failures in strict privacy modes.
    }
  }

  try {
    if (localStorage.getItem('string-blade-onboarding-seen') === 'true') {
      onboarding.classList.add('is-hidden')
    }
  } catch {
    // Leave onboarding visible when storage cannot be read.
  }

  requireElement<HTMLButtonElement>('#startGameButton').addEventListener('click', dismissOnboarding)
}

const syncAudioToScene = (detector: AudioChordDetector, getBattleScene: () => BattleScene | null) => {
  // Audio frames are polled from the browser and pushed into Phaser once per animation frame.
  let animationFrameId = 0
  let stopped = false
  const sync = () => {
    if (stopped) {
      return
    }

    const detection = detector.read()
    const battleScene = getBattleScene()
    battleScene?.setAudioData({
      detected: detection.chord,
      confidence: detection.confidence,
      volume: detection.volume,
      spectrum: detection.spectrum,
      waveform: detection.waveform,
    })

    if (detection.chord) {
      battleScene?.triggerChord(detection.chord as ChordName, false)
    }

    animationFrameId = requestAnimationFrame(sync)
  }

  sync()
  return () => {
    stopped = true
    cancelAnimationFrame(animationFrameId)
  }
}
