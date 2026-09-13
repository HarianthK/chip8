// Disassembles every program in the archive and asks two questions: does
// Octo's own compiler turn the listing back into the same bytes, and does
// the machine ever execute something the listing called data?
// Run: node scripts/roundtrip.mjs [name]
import vm from "node:vm"
import { Chip8 } from "../chip8.js"
import { analyse, disassemble } from "./disassemble.mjs"

const ARCHIVE = "https://raw.githubusercontent.com/JohnEarnest/chip8Archive/master"
const OCTO = "https://raw.githubusercontent.com/JohnEarnest/Octo/gh-pages/js/compiler.js"

const box = { console }
vm.createContext(box)
vm.runInContext(await (await fetch(OCTO)).text(), box)
const assemble = (src) => {
  const c = new box.Compiler(src)
  try { c.go() } catch (e) { return { error: String(e.message ?? e) } }
  if (c.hasError) return { error: c.reason }
  return { bytes: Uint8Array.from(c.rom) }
}

// Runs the program with a few keys pressed and records every address it
// fetched an instruction from, and every address it drew a sprite from.
function executed(rom, options = {}) {
  const cpu = new Chip8()
  cpu.quirks.shift = !!options.shiftQuirks
  cpu.quirks.loadStore = !!options.loadStoreQuirks
  cpu.quirks.jump = !!options.jumpQuirks
  cpu.load(rom)
  const seen = new Set()
  const drawn = new Set()
  const keys = [1, 5, 7, 8, 9, 6, 0xa, 0xe]
  for (let frame = 0; frame < 400 && !cpu.halted; frame++) {
    const k = keys[Math.floor(frame / 25) % keys.length]
    if (frame % 25 === 0) cpu.keyDown(k)
    if (frame % 25 === 12) cpu.keyUp(k)
    for (let i = 0; i < 30 && !cpu.halted; i++) {
      seen.add(cpu.pc)
      const op = (cpu.memory[cpu.pc] << 8) | cpu.memory[cpu.pc + 1]
      if ((op & 0xf000) === 0xd000) {
        const n = (op & 0xf) || 32
        for (let k = 0; k < n; k++) drawn.add(cpu.i + k)
      }
      cpu.step()
    }
    cpu.tickTimers()
  }
  return { seen, drawn }
}

const manifest = await (await fetch(`${ARCHIVE}/programs.json`)).json()
const wanted = process.argv[2]
let same = 0, differ = 0, clean = 0, ran = 0, blind = 0, drewCode = 0
for (const [id, meta] of Object.entries(manifest).sort()) {
  if (wanted && wanted !== id) continue
  const rom = new Uint8Array(await (await fetch(`${ARCHIVE}/roms/${id}.ch8`)).arrayBuffer())
  const listing = disassemble(rom)
  const back = assemble(listing)
  const identical = back.bytes && back.bytes.length === rom.length && back.bytes.every((b, i) => b === rom[i])
  identical ? same++ : differ++

  const { code, blind: usesJump0 } = analyse(rom)
  if (usesJump0) blind++
  const { seen, drawn } = executed(rom, meta.options)
  const missed = [...seen].filter((pc) => !code.has(pc))
  missed.length ? ran++ : clean++
  // A sprite byte inside something listed as an instruction.
  const inCode = [...drawn].filter((a) => code.has(a) || code.has(a - 1))
  if (inCode.length) drewCode++

  const notes = []
  if (!identical) notes.push(back.error ? `octo: ${back.error}` : `bytes differ (${back.bytes.length} vs ${rom.length})`)
  if (missed.length) notes.push(`ran ${missed.length} address${missed.length > 1 ? "es" : ""} listed as data, first ${"0x" + missed[0].toString(16)}${usesJump0 ? " (uses jump0)" : ""}`)
  if (inCode.length) notes.push(`drew ${inCode.length} byte${inCode.length > 1 ? "s" : ""} from what is listed as code, first ${"0x" + inCode[0].toString(16)}`)
  console.log(`${identical && !missed.length && !inCode.length ? "ok  " : "    "} ${id.padEnd(20)} ${notes.join("; ")}`)
}
console.log(`\nrebuilt identical: ${same} of ${same + differ}`)
console.log(`never executed data: ${clean} of ${clean + ran}${blind ? ` (${blind} use jump0, whose targets depend on v0)` : ""}`)
console.log(`never drew from code: ${clean + ran - drewCode} of ${clean + ran}`)
