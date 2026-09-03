// Finds each program's start key. See the README.
// Run: node scripts/find-start-keys.mjs > start-keys.json
import { Chip8, WIDTH } from "../chip8.js"

const ARCHIVE = "https://raw.githubusercontent.com/JohnEarnest/chip8Archive/master"
const PAD = { 1:"1",2:"2",3:"3",12:"4", 4:"Q",5:"W",6:"E",13:"R", 7:"A",8:"S",9:"D",14:"F", 10:"Z",0:"X",11:"C",15:"V" }
const SETTLE = 150, HOLD = 10, AFTER = 70

const hash = (d) => { let h = 2166136261; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619) } return h }
const lit = (c) => { let n = 0; for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (c.display[y*WIDTH+x]) n++; return n }

const manifest = await (await fetch(`${ARCHIVE}/programs.json`)).json()
const out = {}
const skipped = []

for (const [name, meta] of Object.entries(manifest).sort()) {
  const per = Number(meta.options?.tickrate) || 10
  const bytes = new Uint8Array(await (await fetch(`${ARCHIVE}/roms/${name}.ch8`)).arrayBuffer())
  const boot = () => {
    const c = new Chip8(); c.load(bytes)
    c.go = (f) => { for (let i=0;i<f;i++){ for(let j=0;j<per&&!c.halted;j++) c.step(); c.tickTimers() } }
    c.go(SETTLE)
    return c
  }

  // A program using randomness gives a different picture every run, so a key
  // cannot be blamed for the difference. Two idle runs settle that first.
  const a = boot(); a.go(HOLD + AFTER)
  const b = boot(); b.go(HOLD + AFTER)
  if (hash(a.display) !== hash(b.display)) { skipped.push([name, "not repeatable"]); continue }
  const idle = hash(a.display)
  const idleLit = lit(a)

  const movers = []
  for (let k = 0; k < 16; k++) {
    const c = boot()
    c.keyDown(k); c.go(HOLD); c.keyUp(k); c.go(AFTER)
    if (hash(c.display) === idle) continue
    // A start key replaces the screen rather than nudging something on it.
    const change = Math.abs(lit(c) - idleLit)
    movers.push([k, change])
  }
  if (!movers.length) { skipped.push([name, "no key changes anything"]); continue }
  movers.sort((x, y) => y[1] - x[1])
  const [best, change] = movers[0]
  // Only call it a start key when it does something substantial and is not one
  // of many keys doing the same thing, which is movement rather than starting.
  if (change < 40 || movers.length > 6) { skipped.push([name, "looks like movement, not a start"]); continue }
  out[name] = PAD[best]
}

console.error(`start key found for ${Object.keys(out).length} programs; ${skipped.length} left alone`)
for (const [n, why] of skipped.slice(0, 8)) console.error(`   ${n}: ${why}`)
console.log(JSON.stringify(out, null, 1))
