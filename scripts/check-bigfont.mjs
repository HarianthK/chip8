// FX30 must point I at the big glyph for the low four bits of VX, as Octo does, and A to F must
// be letters of their own, not digits again. Run: node scripts/check-bigfont.mjs
import { Chip8 } from "../chip8.js"

const glyph = (cpu) => [...cpu.memory.slice(cpu.i, cpu.i + 10)].join(",")
const seen = new Map()
let good = true
for (let v = 0; v < 256; v++) {
  const cpu = new Chip8()
  cpu.load(new Uint8Array([0x60, v, 0xf0, 0x30]))
  cpu.step()
  cpu.step()
  const at = 0x50 + (v & 0xf) * 10
  const g = glyph(cpu)
  if (cpu.i !== at) {
    good = false
    console.log(`V0=${v}: I is ${cpu.i}, wanted ${at}`)
  } else if (!seen.has(v & 0xf)) {
    seen.set(v & 0xf, g)
  }
}
const glyphs = [...seen.values()]
if (glyphs.length !== 16 || new Set(glyphs).size !== 16 || glyphs.some((g) => g === "0,0,0,0,0,0,0,0,0,0")) {
  good = false
  console.log("the sixteen big glyphs are not sixteen different, visible characters")
}
console.log(good ? "FX30 finds a distinct big glyph for each of 0 to F, for every value of VX" : "\nSOMETHING IS OFF")
process.exit(good ? 0 : 1)
