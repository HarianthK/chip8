// Plays each archive program with keys going up and down, then rewinds it and
// holds every frame against a whole copy taken on the way. Run: node scripts/rewind.mjs [name]
import { readFileSync } from "node:fs"
import { Chip8 } from "../chip8.js"
import { History } from "../rewind.js"
import { manifest as archive, rom as fetchRom } from "./archive.mjs"

// Not machine state: input, what the keypad lights, settings, a repaint flag.
const SKIP = new Set(["keys", "used", "anyKey", "quirks", "drawn"])
const copy = (cpu) => Object.fromEntries(Object.keys(cpu).filter((k) => !SKIP.has(k))
  .map((k) => [k, ArrayBuffer.isView(cpu[k]) ? cpu[k].slice() : JSON.stringify(cpu[k])]))
const same = (a, b) => ArrayBuffer.isView(a) ? a.length === b.length && a.every((x, i) => x === b[i]) : a === b
const differs = (cpu, want) => {
  const now = copy(cpu)
  return [...new Set([...Object.keys(now), ...Object.keys(want)])].find((k) => !same(now[k], want[k]))
}

const KEEP = 300
function check(rom, options = {}) {
  const cpu = new Chip8()
  Object.assign(cpu.quirks, {
    shift: !!options.shiftQuirks, loadStore: !!options.loadStoreQuirks,
    logic: !!options.logicQuirks, clip: !!options.clipQuirks, jump: !!options.jumpQuirks,
  })
  cpu.load(rom)
  const history = new History(cpu, KEEP)
  const seen = [copy(cpu)]
  const ipf = Math.max(1, Math.min(200, options.tickrate ?? 20))
  const run = (from, to) => {
    for (let f = from; f < to; f++) {
      const key = (f >> 5) & 15
      if (f % 32 === 8) cpu.keyDown(key)
      if (f % 32 === 20) cpu.keyUp(key)
      for (let i = 0; i < ipf && !cpu.halted; i++) cpu.step()
      cpu.tickTimers()
      history.record()
      seen[f + 1] = copy(cpu)
    }
  }
  const rewind = (from, to) => {
    for (let f = from; f > to; f--) {
      const held = cpu.keys.join()
      if (!history.back()) return `back() refused at frame ${f}`
      const bad = differs(cpu, seen[f - 1])
      if (bad) return `${bad} wrong going back to frame ${f - 1}`
      if (cpu.keys.join() !== held) return "keys changed by rewinding"
    }
  }
  run(0, 400)
  // Halfway back, play on, so the second rewind runs over frames recorded twice.
  const problem = rewind(400, 250) ?? (run(250, 520), rewind(520, 520 - KEEP + 1))
  if (problem) return problem
  if (history.back()) return "went back past the oldest kept frame"
  if (differs(cpu, seen[520 - KEEP + 1])) return "an extra back() moved the machine"
  return null
}

const manifest = await archive()
const wanted = process.argv[2]
const programs = Object.entries(manifest).sort().filter(([id]) => !wanted || id === wanted)
  .map(([id, meta]) => [id, () => fetchRom(id), meta.options])
if (!wanted || wanted === "xochip") programs.push(["xochip", () => new Uint8Array(readFileSync("tests/xochip.ch8")), {}])
let failed = 0
for (const [id, load, options] of programs) {
  const problem = check(await load(), options)
  if (problem) { failed++; console.log(`FAIL ${id}: ${problem}`) }
}
console.log(`${programs.length - failed} of ${programs.length} rewind exactly`)
process.exit(failed ? 1 : 0)
