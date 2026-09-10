// Breaks one instruction on purpose and asks whether a test ROM notices.
// Run: node scripts/mutate.mjs [name]
import { Chip8, WIDTH } from "../chip8.js"

const SUITE = "https://raw.githubusercontent.com/Timendus/chip8-test-suite/main/bin"

// Each one replaces a single opcode family with a version that is wrong in a
// specific way, along with a program proving it really is wrong.
const BREAKAGES = {
  "dead-5xy0": {
    what: "5XY0 never skips",
    catches: (op) => (op & 0xf00f) === 0x5000,
    run: (cpu) => {},
    // The skipped instruction has to be the last one, or both paths land on
    // the same place and the proof shows nothing.
    proof: { program: [0x6a05, 0x6b05, 0x5ab0, 0x6c01], register: 0xc, right: 0 },
  },
  "no-collision-flag": {
    what: "drawing never reports that it turned a pixel off",
    catches: (op) => (op & 0xf000) === 0xd000,
    run: (cpu, x, y, n) => { cpu.draw(cpu.v[x], cpu.v[y], n); cpu.v[0xf] = 0 },
    // Drawing the same sprite twice over itself has to set the flag.
    proof: { program: [0x6000, 0xf029, 0x6100, 0x6200, 0xd125, 0xd125], register: 0xf, right: 1 },
  },
  "carry-inverted": {
    what: "8XY4 sets its flag when the sum fits, rather than when it overflows",
    catches: (op) => (op & 0xf00f) === 0x8004,
    run: (cpu, x, y) => {
      const sum = cpu.v[x] + cpu.v[y]
      cpu.v[x] = sum & 0xff
      cpu.v[0xf] = sum > 0xff ? 0 : 1
    },
    proof: { program: [0x6ac8, 0x6b64, 0x8ab4], register: 0xf, right: 1 },
  },
  "borrow-inverted": {
    what: "8XY5 sets its flag when there was a borrow, rather than when there was not",
    catches: (op) => (op & 0xf00f) === 0x8005,
    run: (cpu, x, y) => {
      const a = cpu.v[x], b = cpu.v[y]
      cpu.v[x] = (a - b) & 0xff
      cpu.v[0xf] = a >= b ? 0 : 1
    },
    proof: { program: [0x6a0a, 0x6b05, 0x8ab5], register: 0xf, right: 1 },
  },
  "bcd-reversed": {
    what: "FX33 writes units, tens, hundreds instead of hundreds, tens, units",
    catches: (op) => (op & 0xf0ff) === 0xf033,
    run: (cpu, x) => {
      const n = cpu.v[x]
      cpu.memory[cpu.i & 0xffff] = n % 10
      cpu.memory[(cpu.i + 1) & 0xffff] = Math.floor(n / 10) % 10
      cpu.memory[(cpu.i + 2) & 0xffff] = Math.floor(n / 100)
    },
    proof: { program: [0x6a7b, 0xa300, 0xfa33, 0xa300, 0xf265], register: 0x0, right: 1 },
  },
  "skip-inverted": {
    what: "3XNN skips when the value does not match, rather than when it does",
    catches: (op) => (op & 0xf000) === 0x3000,
    run: (cpu, x, y, low, op) => { if (cpu.v[x] !== (op & 0xff)) cpu.pc = (cpu.pc + 2) & 0xffff },
    proof: { program: [0x6a05, 0x3a05, 0x6b01], register: 0xb, right: 0 },
  },
  "8xy7-flag-after": {
    what: "8XY7 works out its flag after the subtraction, using > rather than >=",
    catches: (op) => (op & 0xf00f) === 0x8007,
    run: (cpu, x, y) => {
      cpu.v[x] = (cpu.v[y] - cpu.v[x]) & 0xff
      cpu.v[0xf] = cpu.v[y] > cpu.v[x] ? 1 : 0
    },
    proof: { program: [0x6a05, 0x8aa7], register: 0xf, right: 1 },
  },
  "shift-flag-from-vx": {
    what: "the shift takes its value from VY as it should, but its flag from VX",
    catches: (op) => (op & 0xf00f) === 0x8006 || (op & 0xf00f) === 0x800e,
    run: (cpu, x, y, low) => {
      const right = low === 6
      const flag = right ? cpu.v[x] & 1 : (cpu.v[x] >> 7) & 1
      cpu.v[x] = (right ? cpu.v[y] >> 1 : cpu.v[y] << 1) & 0xff
      cpu.v[0xf] = flag
    },
    proof: { program: [0x6a01, 0x6b04, 0x8ab6], register: 0xf, right: 0 },
  },
}

function machine(breakage, quirks = {}) {
  const cpu = new Chip8()
  Object.assign(cpu.quirks, quirks)
  if (!breakage) return cpu
  const real = cpu.step.bind(cpu)
  cpu.step = () => {
    const op = (cpu.memory[cpu.pc] << 8) | cpu.memory[cpu.pc + 1]
    if (!breakage.catches(op)) return real()
    cpu.pc = (cpu.pc + 2) & 0xffff
    breakage.run(cpu, (op & 0x0f00) >> 8, (op & 0x00f0) >> 4, op & 0xf, op)
  }
  return cpu
}

const screen = (cpu, rom, pick, frames) => {
  cpu.load(rom)
  const go = (n) => { for (let i = 0; i < n; i++) { for (let j = 0; j < 30 && !cpu.halted; j++) cpu.step(); cpu.tickTimers() } }
  go(200)
  for (const key of pick) { cpu.keyDown(key); go(20); cpu.keyUp(key); go(200) }
  go(frames)
  const rows = []
  for (let y = 0; y < cpu.height; y++) {
    let l = ""
    for (let x = 0; x < cpu.width; x++) l += cpu.display[y * WIDTH + x] ? "#" : "."
    rows.push(l)
  }
  return rows
}

// A breakage that behaves identically to the real thing would prove nothing,
// so each one has to fail a program of its own before it is used.
function isReallyBroken(breakage) {
  const { program, register, right } = breakage.proof
  const bytes = []
  for (const w of program) bytes.push((w >> 8) & 0xff, w & 0xff)
  const rom = Uint8Array.from(bytes)
  const step = (cpu) => { cpu.load(rom); for (let i = 0; i < program.length; i++) cpu.step(); return cpu.v[register] }
  const good = step(machine(null))
  const bad = step(machine(breakage))
  return { good, bad, ok: good === right && bad !== right }
}

// Every test in the suite, because a gap in one may be covered by another.
const TESTS = [
  ["1-chip8-logo", []], ["2-ibm-logo", []], ["3-corax+", []], ["4-flags", []],
  ["5-quirks", [1]], ["6-keypad", [1]], ["7-beep", [1]], ["8-scrolling", [1, 1]],
]

const roms = {}
for (const [name] of TESTS) {
  const res = await fetch(`${SUITE}/${name}.ch8`)
  if (!res.ok) { console.error(`could not fetch ${name}`); process.exit(1) }
  roms[name] = new Uint8Array(await res.arrayBuffer())
}

const wanted = process.argv[2]
for (const [name, breakage] of Object.entries(BREAKAGES)) {
  if (wanted && wanted !== name) continue
  const proof = isReallyBroken(breakage)
  console.log(`\n${name}: ${breakage.what}`)
  console.log(`  the breakage is real: correct gives ${proof.good}, broken gives ${proof.bad}${proof.ok ? "" : "  <- CHECK THIS, the breakage may be a no op"}`)
  const caught = []
  for (const [rom, pick] of TESTS) {
    const before = screen(machine(null), roms[rom], pick, 400)
    const after = screen(machine(breakage), roms[rom], pick, 400)
    if (before.filter((r, i) => r !== after[i]).length) caught.push(rom)
  }
  console.log(`  ${caught.length ? "noticed by " + caught.join(", ") : "NOT NOTICED BY ANY TEST IN THE SUITE"}`)
}
