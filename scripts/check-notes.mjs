// Every key a how-to-play note names in bold has to be one the program asks
// about, found by reading it or by playing it. A note naming a key the
// program never looks at is wrong.
// Run: node scripts/check-notes.mjs
import { Chip8 } from "../chip8.js"
import { keysWatched } from "../disassemble.js"
import { NOTES } from "../notes.js"
import { manifest as archive, rom as fetchRom } from "./archive.mjs"

const PAD = ["X", "1", "2", "3", "Q", "W", "E", "A", "S", "D", "Z", "C", "4", "R", "F", "V"]

function played(rom, options = {}) {
  const cpu = new Chip8()
  Object.assign(cpu.quirks, { shift: !!options.shiftQuirks, loadStore: !!options.loadStoreQuirks, logic: !!options.logicQuirks, clip: !!options.clipQuirks, jump: !!options.jumpQuirks })
  cpu.load(rom)
  const go = (n) => { for (let f = 0; f < n && !cpu.halted; f++) { for (let i = 0; i < 30 && !cpu.halted; i++) cpu.step(); cpu.tickTimers() } }
  go(120)
  for (let k = 0; k < 16; k++) { cpu.keyDown(k); go(8); cpu.keyUp(k); go(8) }
  go(60)
  return new Set([...cpu.used.keys()].filter((k) => cpu.used[k]))
}

const manifest = await archive()
let wrong = 0, unsure = 0, checked = 0
for (const [id, note] of Object.entries(NOTES)) {
  if (!manifest[id]) { console.log(`    ${id.padEnd(20)} NOT IN THE ARCHIVE`); wrong++; continue }
  // Keys are written as <b>W</b> or <b>W A S D</b>; other bold is not a key.
  const named = new Set()
  for (const m of note.matchAll(/<b>([^<]+)<\/b>/g)) for (const t of m[1].trim().split(/\s+/)) if (PAD.includes(t.toUpperCase())) named.add(PAD.indexOf(t.toUpperCase()))
  if (!named.size) continue
  checked++
  const rom = await fetchRom(id)
  const read = keysWatched(rom)
  const known = new Set([...read.asked, ...played(rom, manifest[id].options)])
  const bad = [...named].filter((k) => !known.has(k))
  // A program that works its key numbers out at run time may ask about keys
  // neither method reached, so those only get a question mark.
  if (bad.length) { if (read.anyKey) unsure++; else wrong++; console.log(`${read.anyKey ? "?   " : "FAIL"} ${id.padEnd(20)} names ${bad.map((k) => PAD[k]).join(" ")}, which the program was not seen to ask about`) }
}
console.log(`
${checked} notes name keys; ${wrong} name a key the program does not ask about; ${unsure} name one that could not be confirmed either way`)
process.exit(wrong ? 1 : 0)
