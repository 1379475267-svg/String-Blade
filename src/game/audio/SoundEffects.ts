import { type ChordName, chords } from './AudioChordDetector'

export class SoundEffects {
  private context: AudioContext | null = null
  private master: GainNode | null = null

  attack(chord: ChordName) {
    const now = this.now()
    const frequency = chord === 'C' ? 261.63 : chord === 'G' ? 392 : 440
    this.tone(frequency, now, 0.16, chords[chord].cssColor, 0.08, 12)
    this.noise(now, 0.11, 900, 0.04)
  }

  playerImpact(chord: ChordName) {
    const now = this.now()
    const frequency = chord === 'C' ? 196 : chord === 'G' ? 293.66 : 220
    this.tone(frequency, now, 0.1, chords[chord].cssColor, 0.09, -8)
    this.tone(frequency * 2.5, now + 0.012, 0.07, '#ffffff', 0.045, 3)
    this.noise(now, 0.09, 1800, 0.075)
  }

  enemyAttack() {
    const now = this.now()
    this.tone(164.81, now, 0.24, '#ef5d60', 0.07, -10)
    this.noise(now, 0.18, 520, 0.05)
  }

  guard() {
    const now = this.now()
    this.tone(523.25, now, 0.13, '#4fb3ff', 0.06, 7)
    this.tone(783.99, now + 0.02, 0.09, '#4fb3ff', 0.035, -4)
  }

  parry() {
    const now = this.now()
    this.tone(659.25, now, 0.22, '#f2c14e', 0.09, 14)
    this.tone(987.77, now + 0.035, 0.18, '#ffffff', 0.06, 5)
    this.noise(now, 0.08, 3200, 0.06)
  }

  hit() {
    const now = this.now()
    this.tone(110, now, 0.22, '#ef5d60', 0.08, -18)
    this.noise(now, 0.16, 380, 0.07)
  }

  waveClear() {
    const now = this.now()
    this.tone(329.63, now, 0.18, '#f2c14e', 0.06, 8)
    this.tone(493.88, now + 0.08, 0.2, '#f2c14e', 0.055, 7)
    this.tone(659.25, now + 0.16, 0.24, '#ffffff', 0.05, 5)
  }

  private ensureContext() {
    if (this.context && this.master) {
      if (this.context.state === 'suspended') {
        void this.context.resume()
      }
      return { context: this.context, master: this.master }
    }

    this.context = new AudioContext()
    this.master = this.context.createGain()
    this.master.gain.value = 0.75
    this.master.connect(this.context.destination)
    return { context: this.context, master: this.master }
  }

  private now() {
    return this.ensureContext().context.currentTime
  }

  private tone(
    frequency: number,
    start: number,
    duration: number,
    color: string,
    gainValue: number,
    detune: number,
  ) {
    const { context, master } = this.ensureContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const filter = context.createBiquadFilter()

    oscillator.type = color === '#ef5d60' ? 'sawtooth' : 'triangle'
    oscillator.frequency.setValueAtTime(frequency, start)
    oscillator.detune.setValueAtTime(detune, start)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(45, frequency * 1.8), start + duration)

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(color === '#ffffff' ? 4200 : 1800, start)
    filter.Q.setValueAtTime(5, start)

    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)

    oscillator.connect(filter)
    filter.connect(gain)
    gain.connect(master)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.02)
  }

  private noise(start: number, duration: number, cutoff: number, gainValue: number) {
    const { context, master } = this.ensureContext()
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1
    }

    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()

    source.buffer = buffer
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(cutoff, start)
    filter.Q.setValueAtTime(2.5, start)
    gain.gain.setValueAtTime(gainValue, start)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(master)
    source.start(start)
  }
}
