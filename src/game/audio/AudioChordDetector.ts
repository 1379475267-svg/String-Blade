export type ChordName = 'C' | 'G' | 'Am'
export type MicState = 'idle' | 'asking' | 'ready' | 'denied'

export type Detection = {
  chord: ChordName | null
  confidence: number
  volume: number
  spectrum: Uint8Array<ArrayBufferLike>
  waveform: Uint8Array<ArrayBufferLike>
}

export const chordOrder: ChordName[] = ['C', 'G', 'Am']

export const chords: Record<ChordName, { notes: number[]; color: number; cssColor: string; damage: number }> = {
  C: { notes: [0, 4, 7], color: 0xf2c14e, cssColor: '#f2c14e', damage: 18 },
  G: { notes: [7, 11, 2], color: 0x4fb3ff, cssColor: '#4fb3ff', damage: 21 },
  Am: { notes: [9, 0, 4], color: 0xef5d60, cssColor: '#ef5d60', damage: 24 },
}

export class AudioChordDetector {
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private frequencyData = new Uint8Array(1024)
  private timeData = new Uint8Array(1024)
  private stream: MediaStream | null = null

  state: MicState = 'idle'
  message = 'Mic off'

  async start() {
    this.state = 'asking'
    this.message = 'Requesting mic'

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })

      this.context = new AudioContext()
      const source = this.context.createMediaStreamSource(this.stream)
      this.analyser = this.context.createAnalyser()
      this.analyser.fftSize = 2048
      this.analyser.smoothingTimeConstant = 0.74
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount)
      this.timeData = new Uint8Array(this.analyser.fftSize)
      source.connect(this.analyser)
      this.state = 'ready'
      this.message = 'Mic live'
    } catch {
      this.state = 'denied'
      this.message = 'Mic blocked'
    }
  }

  read(): Detection {
    if (!this.analyser || !this.context) {
      return this.emptyDetection()
    }

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

    const totalEnergy = pitchEnergy.reduce((sum, value) => sum + value, 0)
    if (totalEnergy <= 0) {
      return { ...this.emptyDetection(), volume }
    }

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
      const score = (chordEnergy - nearbyPenalty) / totalEnergy
      if (score > bestScore) {
        bestScore = score
        bestChord = chord
      }
    }

    return {
      chord: bestScore > 0.34 ? bestChord : null,
      confidence: Math.max(0, Math.min(1, bestScore)),
      volume,
      spectrum: this.frequencyData,
      waveform: this.timeData,
    }
  }

  private emptyDetection(): Detection {
    return {
      chord: null,
      confidence: 0,
      volume: 0,
      spectrum: this.frequencyData,
      waveform: this.timeData,
    }
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
