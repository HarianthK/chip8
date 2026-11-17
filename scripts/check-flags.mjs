// FX75 then FX85 must bring back every register up to X, for every X, as Octo does.
// Run: node scripts/check-flags.mjs
import { Chip8 } from "../chip8.js"

const words = (list) => new Uint8Array(list.flatMap((w) => [w >> 8, w & 0xff]))
let good = true
for (let x = 0; x < 16; x++) {
  const set = [...Array(16).keys()].map((r) => 0x6000 | (r << 8) | (0xa0 + r))
  const wipe = [...Array(16).keys()].map((r) => 0x6000 | (r << 8))
  const cpu = new Chip8()
  cpu.flags.fill(0)
  cpu.load(words([...set, 0xf075 | (x << 8), ...wipe, 0xf085 | (x << 8)]))
  for (let i = 0; i < 34; i++) cpu.step()
  const want = [...Array(16).keys()].map((r) => (r <= x ? 0xa0 + r : 0))
  const fine = want.every((v, r) => cpu.v[r] === v)
  good &&= fine
  if (!fine) console.log(`F${x.toString(16)}75 then F${x.toString(16)}85: wanted ${want}, got ${[...cpu.v]}`)
}
console.log(good ? "saveflags and loadflags round-trip v0 to vX for every X" : "\nSOMETHING IS OFF")
process.exit(good ? 0 : 1)
