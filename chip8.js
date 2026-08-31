// The CHIP-8 machine: memory, registers, and the instruction loop.
// Everything here is the 1977 spec; nothing about drawing or keyboards.

export const WIDTH = 64
export const HEIGHT = 32

// Programs are loaded here because the interpreter itself used to live below.
const PROGRAM_START = 0x200

// The built-in font, 0 through F, five bytes per character.
const FONT = [
  0xf0, 0x90, 0x90, 0x90, 0xf0, 0x20, 0x60, 0x20, 0x20, 0x70,
  0xf0, 0x10, 0xf0, 0x80, 0xf0, 0xf0, 0x10, 0xf0, 0x10, 0xf0,
  0x90, 0x90, 0xf0, 0x10, 0x10, 0xf0, 0x80, 0xf0, 0x10, 0xf0,
  0xf0, 0x80, 0xf0, 0x90, 0xf0, 0xf0, 0x10, 0x20, 0x40, 0x40,
  0xf0, 0x90, 0xf0, 0x90, 0xf0, 0xf0, 0x90, 0xf0, 0x10, 0xf0,
  0xf0, 0x90, 0xf0, 0x90, 0x90, 0xe0, 0x90, 0xe0, 0x90, 0xe0,
  0xf0, 0x80, 0x80, 0x80, 0xf0, 0xe0, 0x90, 0x90, 0x90, 0xe0,
  0xf0, 0x80, 0xf0, 0x80, 0xf0, 0xf0, 0x80, 0xf0, 0x80, 0x80,
]

export class Chip8 {
  constructor() {
    this.reset()
  }

  reset() {
    this.memory = new Uint8Array(4096)
    this.v = new Uint8Array(16)
    this.i = 0
    this.pc = PROGRAM_START
    this.stack = new Uint16Array(16)
    this.sp = 0
    this.delay = 0
    this.sound = 0
    this.display = new Uint8Array(WIDTH * HEIGHT)
    this.keys = new Uint8Array(16)
    this.halted = false
    // Set when a program draws, so the screen is only repainted if it changed.
    this.drawn = false
    // FX0A waits for a key; this holds the register it will land in.
    this.waitingFor = -1
    this.memory.set(FONT, 0)
  }

  load(bytes) {
    this.reset()
    this.memory.set(bytes.subarray(0, 4096 - PROGRAM_START), PROGRAM_START)
  }

  // The timers tick at 60Hz regardless of how fast instructions run.
  tickTimers() {
    if (this.delay > 0) this.delay--
    if (this.sound > 0) this.sound--
  }

  keyDown(key) {
    this.keys[key] = 1
    // A program parked on FX0A resumes the moment any key goes down.
    if (this.waitingFor >= 0) {
      this.v[this.waitingFor] = key
      this.waitingFor = -1
    }
  }

  keyUp(key) {
    this.keys[key] = 0
  }

  step() {
    if (this.halted || this.waitingFor >= 0) return

    const opcode = (this.memory[this.pc] << 8) | this.memory[this.pc + 1]
    this.pc = (this.pc + 2) & 0xfff

    const nnn = opcode & 0x0fff
    const nn = opcode & 0x00ff
    const n = opcode & 0x000f
    const x = (opcode & 0x0f00) >> 8
    const y = (opcode & 0x00f0) >> 4

    switch (opcode & 0xf000) {
      case 0x0000:
        if (opcode === 0x00e0) {
          this.display.fill(0)
          this.drawn = true
        } else if (opcode === 0x00ee) {
          this.pc = this.stack[--this.sp & 0xf]
        }
        // Anything else here is a call into 1977 machine code. Ignored.
        break

      case 0x1000: // Jump. A jump to itself is how programs signal they are done.
        if (nnn === this.pc - 2) this.halted = true
        this.pc = nnn
        break

      case 0x2000:
        this.stack[this.sp++ & 0xf] = this.pc
        this.pc = nnn
        break

      case 0x3000: if (this.v[x] === nn) this.pc += 2; break
      case 0x4000: if (this.v[x] !== nn) this.pc += 2; break
      case 0x5000: if (this.v[x] === this.v[y]) this.pc += 2; break
      case 0x6000: this.v[x] = nn; break
      case 0x7000: this.v[x] = (this.v[x] + nn) & 0xff; break

      case 0x8000: this.arithmetic(x, y, n); break

      case 0x9000: if (this.v[x] !== this.v[y]) this.pc += 2; break
      case 0xa000: this.i = nnn; break
      case 0xb000: this.pc = (nnn + this.v[0]) & 0xfff; break
      case 0xc000: this.v[x] = Math.floor(Math.random() * 256) & nn; break
      case 0xd000: this.draw(this.v[x], this.v[y], n); break

      case 0xe000:
        if (nn === 0x9e && this.keys[this.v[x] & 0xf]) this.pc += 2
        if (nn === 0xa1 && !this.keys[this.v[x] & 0xf]) this.pc += 2
        break

      case 0xf000: this.misc(x, nn); break
    }
  }

  arithmetic(x, y, n) {
    const a = this.v[x]
    const b = this.v[y]
    switch (n) {
      case 0x0: this.v[x] = b; break
      case 0x1: this.v[x] = a | b; break
      case 0x2: this.v[x] = a & b; break
      case 0x3: this.v[x] = a ^ b; break
      // The carry flag is written after the result, and some programs rely on
      // reading VF as an operand first, so the order matters.
      case 0x4: this.v[x] = (a + b) & 0xff; this.v[0xf] = a + b > 0xff ? 1 : 0; break
      case 0x5: this.v[x] = (a - b) & 0xff; this.v[0xf] = a >= b ? 1 : 0; break
      case 0x6: this.v[x] = a >> 1; this.v[0xf] = a & 1; break
      case 0x7: this.v[x] = (b - a) & 0xff; this.v[0xf] = b >= a ? 1 : 0; break
      case 0xe: this.v[x] = (a << 1) & 0xff; this.v[0xf] = (a >> 7) & 1; break
    }
  }

  misc(x, nn) {
    switch (nn) {
      case 0x07: this.v[x] = this.delay; break
      case 0x0a: this.waitingFor = x; break
      case 0x15: this.delay = this.v[x]; break
      case 0x18: this.sound = this.v[x]; break
      case 0x1e: this.i = (this.i + this.v[x]) & 0xfff; break
      case 0x29: this.i = (this.v[x] & 0xf) * 5; break
      case 0x33: // Binary-coded decimal: hundreds, tens, units.
        this.memory[this.i] = Math.floor(this.v[x] / 100)
        this.memory[this.i + 1] = Math.floor(this.v[x] / 10) % 10
        this.memory[this.i + 2] = this.v[x] % 10
        break
      case 0x55:
        for (let r = 0; r <= x; r++) this.memory[(this.i + r) & 0xfff] = this.v[r]
        break
      case 0x65:
        for (let r = 0; r <= x; r++) this.v[r] = this.memory[(this.i + r) & 0xfff]
        break
    }
  }

  // Sprites are drawn by flipping pixels. VF reports whether anything was
  // switched off, which is the only collision detection the machine has.
  draw(vx, vy, rows) {
    this.v[0xf] = 0
    for (let row = 0; row < rows; row++) {
      const sprite = this.memory[(this.i + row) & 0xfff]
      const py = (vy + row) % HEIGHT
      for (let bit = 0; bit < 8; bit++) {
        if (!(sprite & (0x80 >> bit))) continue
        const px = (vx + bit) % WIDTH
        const at = py * WIDTH + px
        if (this.display[at]) this.v[0xf] = 1
        this.display[at] ^= 1
      }
    }
    this.drawn = true
  }
}
