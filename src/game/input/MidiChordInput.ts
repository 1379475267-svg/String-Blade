import { type ChordName, chordOrder, chords } from '../audio/AudioChordDetector'

type MidiMessageEvent = {
  data: Uint8Array<ArrayBufferLike> | null
}

type MidiInput = {
  name?: string
  onmidimessage: ((event: MidiMessageEvent) => void) | null
}

type MidiAccess = {
  inputs: Map<string, MidiInput>
}

type NavigatorWithMidi = Navigator & {
  requestMIDIAccess?: () => Promise<MidiAccess>
}

type MidiState = 'idle' | 'asking' | 'ready' | 'unsupported' | 'denied'

const chordNotes: Record<ChordName, number[]> = Object.fromEntries(
  chordOrder.map((chord) => [chord, chords[chord].notes]),
) as Record<ChordName, number[]>

export class MidiChordInput {
  private pressedPitchClasses = new Set<number>()
  private lastChordAt = 0
  private onChord: (chord: ChordName) => void

  state: MidiState = 'idle'
  message = 'MIDI off'

  constructor(onChord: (chord: ChordName) => void) {
    this.onChord = onChord
  }

  async start() {
    const midiNavigator = navigator as NavigatorWithMidi
    if (!midiNavigator.requestMIDIAccess) {
      this.state = 'unsupported'
      this.message = 'MIDI unsupported'
      return
    }

    this.state = 'asking'
    this.message = 'Requesting MIDI'

    try {
      const access = await midiNavigator.requestMIDIAccess()
      let inputCount = 0
      for (const input of access.inputs.values()) {
        input.onmidimessage = (event) => this.handleMessage(event)
        inputCount += 1
      }

      this.state = 'ready'
      this.message = inputCount > 0 ? `${inputCount} MIDI input${inputCount > 1 ? 's' : ''}` : 'No MIDI input'
    } catch {
      this.state = 'denied'
      this.message = 'MIDI blocked'
    }
  }

  private handleMessage(event: MidiMessageEvent) {
    if (!event.data) {
      return
    }

    const [status, note, velocity] = event.data
    const command = status & 0xf0
    const pitchClass = note % 12
    const isNoteOn = command === 0x90 && velocity > 0
    const isNoteOff = command === 0x80 || (command === 0x90 && velocity === 0)

    if (isNoteOn) {
      this.pressedPitchClasses.add(pitchClass)
      this.detectChord()
    }

    if (isNoteOff) {
      this.pressedPitchClasses.delete(pitchClass)
    }
  }

  private detectChord() {
    const now = performance.now()
    if (now - this.lastChordAt < 260) {
      return
    }

    for (const chord of chordOrder) {
      if (chordNotes[chord].every((note) => this.pressedPitchClasses.has(note))) {
        this.lastChordAt = now
        this.onChord(chord)
        return
      }
    }
  }
}
