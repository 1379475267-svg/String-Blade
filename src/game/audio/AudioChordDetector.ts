export type ChordName = 'C' | 'G' | 'Am' | 'Em' | 'D' | 'Dm' | 'E' | 'A' | 'F'
export type MicState = 'idle' | 'asking' | 'ready' | 'denied'

export type Detection = {
  chord: ChordName | null
  rawChord: ChordName | null
  confidence: number
  volume: number
  spectrum: Uint8Array<ArrayBufferLike>
  waveform: Uint8Array<ArrayBufferLike>
}

export type CalibrationStatus = {
  activeChord: ChordName | null
  progress: number
  message: string
}

export const chordOrder: ChordName[] = ['C', 'G', 'Am', 'Em', 'D', 'Dm', 'E', 'A', 'F']

export const chords: Record<ChordName, { notes: number[]; color: number; cssColor: string; damage: number }> = {
  C: { notes: [0, 4, 7], color: 0xf2c14e, cssColor: '#f2c14e', damage: 18 },
  G: { notes: [7, 11, 2], color: 0x4fb3ff, cssColor: '#4fb3ff', damage: 21 },
  Am: { notes: [9, 0, 4], color: 0xef5d60, cssColor: '#ef5d60', damage: 24 },
  Em: { notes: [4, 7, 11], color: 0x8bd17c, cssColor: '#8bd17c', damage: 20 },
  D: { notes: [2, 6, 9], color: 0xa88cff, cssColor: '#a88cff', damage: 22 },
  Dm: { notes: [2, 5, 9], color: 0xff8cc6, cssColor: '#ff8cc6', damage: 23 },
  E: { notes: [4, 8, 11], color: 0xffa24f, cssColor: '#ffa24f', damage: 21 },
  A: { notes: [9, 1, 4], color: 0x62d6c8, cssColor: '#62d6c8', damage: 22 },
  F: { notes: [5, 9, 0], color: 0xffd166, cssColor: '#ffd166', damage: 25 },
}

const PITCH_DETECTION_INTERVAL_MS = 50

export class AudioChordDetector {
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private frequencyData = new Uint8Array(1024)
  private timeData = new Uint8Array(1024)
  private pitchSamples = new Float32Array(1024)
  private stream: MediaStream | null = null
  private readonly voteHistory: Array<{ chord: ChordName | null; confidence: number }> = []
  private readonly calibrationProfiles = new Map<ChordName, number[]>()
  private calibration: { chord: ChordName; samples: number[][]; targetSamples: number } | null = null
  private lastPitchDetectionAt = 0
  private lastPitchClass: number | null = null

  state: MicState = 'idle'
  message = 'Mic off'
  calibrationStatus: CalibrationStatus = {
    activeChord: null,
    progress: 0,
    message: 'Calibration off',
  }

  async start() {
    if (this.state === 'ready' || this.state === 'asking') {
      return
    }

    this.state = 'asking'
    this.message = 'Requesting mic'

    try {
      await this.stop()
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })

      this.context = new AudioContext()
      this.source = this.context.createMediaStreamSource(this.stream)
      this.analyser = this.context.createAnalyser()
      this.analyser.fftSize = 2048
      this.analyser.smoothingTimeConstant = 0.74
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount)
      this.timeData = new Uint8Array(this.analyser.fftSize)
      this.pitchSamples = new Float32Array(this.timeData.length)
      this.source.connect(this.analyser)
      this.state = 'ready'
      this.message = 'Mic live'
    } catch {
      this.state = 'denied'
      this.message = 'Mic blocked'
    }
  }

  async stop() {
    this.source?.disconnect()
    this.analyser?.disconnect()
    this.stream?.getTracks().forEach((track) => track.stop())

    if (this.context && this.context.state !== 'closed') {
      await this.context.close()
    }

    this.source = null
    this.analyser = null
    this.stream = null
    this.context = null
    this.voteHistory.length = 0
    this.lastPitchDetectionAt = 0
    this.lastPitchClass = null
    this.state = 'idle'
    this.message = 'Mic off'
  }

  read(): Detection {
    if (!this.analyser || !this.context) {
      return this.emptyDetection()
    }

    // The detector turns each audio frame into pitch-class energy, then stabilizes it with calibration and voting.
    this.analyser.getByteFrequencyData(this.frequencyData)
    this.analyser.getByteTimeDomainData(this.timeData)

    const volume = this.getVolume()
    if (volume < 0.035) {
      return { ...this.emptyDetection(), volume }
    }

    const pitchEnergy = new Array<number>(12).fill(0)
    const sampleRate = this.context.sampleRate
    const binWidth = sampleRate / this.analyser.fftSize

    for (let i = 2; i < this.frequencyData.length; i += 1) {
      const frequency = i * binWidth
      if (frequency < 75 || frequency > 1200) {
        continue
      }

      const midi = Math.round(69 + 12 * Math.log2(frequency / 440))
      const pitchClass = ((midi % 12) + 12) % 12
      const energy = this.frequencyData[i] / 255
      pitchEnergy[pitchClass] += energy * energy
    }

    const trackedPitch = this.detectPitchClass(performance.now())
    if (trackedPitch !== null) {
      pitchEnergy[trackedPitch] += pitchEnergy.reduce((sum, value) => sum + value, 0) * 0.12
    }

    const totalEnergy = pitchEnergy.reduce((sum, value) => sum + value, 0)
    if (totalEnergy <= 0) {
      return { ...this.emptyDetection(), volume }
    }

    const normalizedEnergy = pitchEnergy.map((value) => value / totalEnergy)
    this.captureCalibrationFrame(normalizedEnergy)

    let bestChord: ChordName | null = null
    let bestScore = 0

    for (const chord of chordOrder) {
      const template = chords[chord].notes
      const chordEnergy = template.reduce((sum, note) => sum + pitchEnergy[note], 0)
      const nearbyPenalty = template.reduce((sum, note) => {
        const lower = (note + 11) % 12
        const upper = (note + 1) % 12
        return sum + pitchEnergy[lower] * 0.18 + pitchEnergy[upper] * 0.18
      }, 0)
      const templateScore = (chordEnergy - nearbyPenalty) / totalEnergy
      const calibrationScore = this.scoreCalibration(chord, normalizedEnergy)
      const score = calibrationScore === null ? templateScore : templateScore * 0.58 + calibrationScore * 0.42
      if (score > bestScore) {
        bestScore = score
        bestChord = chord
      }
    }

    const rawChord = bestScore > 0.34 ? bestChord : null
    const votedChord = this.vote(rawChord, bestScore)

    return {
      chord: votedChord,
      rawChord,
      confidence: Math.max(0, Math.min(1, bestScore)),
      volume,
      spectrum: this.frequencyData,
      waveform: this.timeData,
    }
  }

  startCalibration(chord: ChordName) {
    // Calibration stores the player's current tone for this chord and blends it with the generic chord template.
    this.calibration = { chord, samples: [], targetSamples: 36 }
    this.calibrationStatus = {
      activeChord: chord,
      progress: 0,
      message: `Play ${chord}`,
    }
  }

  private emptyDetection(): Detection {
    return {
      chord: null,
      rawChord: null,
      confidence: 0,
      volume: 0,
      spectrum: this.frequencyData,
      waveform: this.timeData,
    }
  }

  private vote(chord: ChordName | null, confidence: number) {
    this.voteHistory.push({ chord, confidence })
    if (this.voteHistory.length > 8) {
      this.voteHistory.shift()
    }

    const scores = new Map<ChordName, number>()
    for (const entry of this.voteHistory) {
      if (!entry.chord) {
        continue
      }
      scores.set(entry.chord, (scores.get(entry.chord) ?? 0) + entry.confidence)
    }

    let bestChord: ChordName | null = null
    let bestScore = 0
    for (const [candidate, score] of scores) {
      if (score > bestScore) {
        bestScore = score
        bestChord = candidate
      }
    }

    const sameRecent = this.voteHistory.filter((entry) => entry.chord === bestChord).length
    return bestChord && sameRecent >= 3 && bestScore >= 1.18 ? bestChord : null
  }

  private captureCalibrationFrame(normalizedEnergy: number[]) {
    if (!this.calibration) {
      return
    }

    this.calibration.samples.push([...normalizedEnergy])
    const progress = this.calibration.samples.length / this.calibration.targetSamples
    this.calibrationStatus = {
      activeChord: this.calibration.chord,
      progress: Math.min(1, progress),
      message: `Calibrating ${this.calibration.chord} ${Math.round(Math.min(1, progress) * 100)}%`,
    }

    if (this.calibration.samples.length < this.calibration.targetSamples) {
      return
    }

    const profile = new Array<number>(12).fill(0)
    for (const sample of this.calibration.samples) {
      for (let i = 0; i < profile.length; i += 1) {
        profile[i] += sample[i]
      }
    }
    for (let i = 0; i < profile.length; i += 1) {
      profile[i] /= this.calibration.samples.length
    }

    this.calibrationProfiles.set(this.calibration.chord, profile)
    const completedChord = this.calibration.chord
    this.calibration = null
    this.calibrationStatus = {
      activeChord: null,
      progress: 1,
      message: `${completedChord} calibrated`,
    }
  }

  private scoreCalibration(chord: ChordName, normalizedEnergy: number[]) {
    const profile = this.calibrationProfiles.get(chord)
    if (!profile) {
      return null
    }

    let dot = 0
    let aMagnitude = 0
    let bMagnitude = 0
    for (let i = 0; i < profile.length; i += 1) {
      dot += normalizedEnergy[i] * profile[i]
      aMagnitude += normalizedEnergy[i] * normalizedEnergy[i]
      bMagnitude += profile[i] * profile[i]
    }

    if (aMagnitude <= 0 || bMagnitude <= 0) {
      return 0
    }

    return dot / Math.sqrt(aMagnitude * bMagnitude)
  }

  private detectPitchClass(now: number) {
    if (!this.context) {
      return null
    }

    if (now - this.lastPitchDetectionAt < PITCH_DETECTION_INTERVAL_MS) {
      return this.lastPitchClass
    }

    this.lastPitchDetectionAt = now
    const samples = this.pitchSamples
    for (let i = 0; i < this.timeData.length; i += 1) {
      samples[i] = (this.timeData[i] - 128) / 128
    }

    const sampleRate = this.context.sampleRate
    const minLag = Math.floor(sampleRate / 1000)
    const maxLag = Math.floor(sampleRate / 75)
    let bestLag = -1
    let bestCorrelation = 0

    // Autocorrelation gives the FFT template a light pitch anchor when a single guitar note rings out strongly.
    for (let lag = minLag; lag <= maxLag; lag += 1) {
      let correlation = 0
      for (let i = 0; i < samples.length - lag; i += 1) {
        correlation += samples[i] * samples[i + lag]
      }
      correlation /= samples.length - lag
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation
        bestLag = lag
      }
    }

    if (bestLag <= 0 || bestCorrelation < 0.012) {
      this.lastPitchClass = null
      return null
    }

    const frequency = sampleRate / bestLag
    if (frequency < 75 || frequency > 1000) {
      this.lastPitchClass = null
      return null
    }

    const midi = Math.round(69 + 12 * Math.log2(frequency / 440))
    this.lastPitchClass = ((midi % 12) + 12) % 12
    return this.lastPitchClass
  }

  private getVolume() {
    let sum = 0
    for (const value of this.timeData) {
      const centered = (value - 128) / 128
      sum += centered * centered
    }
    return Math.sqrt(sum / this.timeData.length)
  }
}
