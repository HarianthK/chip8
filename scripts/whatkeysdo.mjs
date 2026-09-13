// Holds each key a program watches and reports how the picture moved, so a
// how-to-play note can be written from something observed. See DOCS.md.
// Run: node scripts/whatkeysdo.mjs <name> [--frames N] [--hold N]
import { Chip8, WIDTH } from "../chip8.js"

const ARCHIVE = "https://raw.githubusercontent.com/JohnEarnest/chip8Archive/master"
const PAD = ["X", "1", "2", "3", "Q", "W", "E", "A", "S", "D", "Z", "C", "4", "R", "F", "V"]

const args = process.argv.slice(2)
const name = args[0]
const flag = (f, d) => { const i = args.indexOf(f); return i >= 0 ? Number(args[i + 1]) : d }
const settle = flag("--frames", 120)
const hold = flag("--hold", 40)

// Many programs open on a title screen, so the known start key is pressed
// first and the probing happens in the game proper.
const { promises: fsp } = await import("node:fs")
const starts = JSON.parse(await fsp.readFile(new URL("../start-keys.json", import.meta.url), "utf8"))
const manifest = await (await fetch(`${ARCHIVE}/programs.json`)).json()
const meta = manifest[name]
if (!meta) { console.error(`no program called ${name}`); process.exit(1) }
const rom = new Uint8Array(await (await fetch(`${ARCHIVE}/roms/${name}.ch8`)).arrayBuffer())
const perFrame = Math.max(1, Math.round((meta.options?.tickrate ?? 20)))

// The same seed every run, or a program using random would differ from itself.
const fresh = () => {
  let seed = 12345
  Math.random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
  const cpu = new Chip8()
  Object.assign(cpu.quirks, {
    shift: !!meta.options?.shiftQuirks, loadStore: !!meta.options?.loadStoreQuirks,
    logic: !!meta.options?.logicQuirks, clip: !!meta.options?.clipQuirks,
    jump: !!meta.options?.jumpQuirks, vBlank: !!meta.options?.vBlankQuirks,
  })
  cpu.load(rom)
  return cpu
}
const go = (cpu, n) => { for (let f = 0; f < n && !cpu.halted; f++) { for (let i = 0; i < perFrame && !cpu.halted; i++) cpu.step(); cpu.tickTimers() } }

const startArg = args.indexOf("--start")
const startKey = startArg >= 0 ? PAD.indexOf(args[startArg + 1].toUpperCase()) : PAD.indexOf(starts[name] ?? "")
// Settle, press the start key if there is one, then settle again.
const begin = () => {
  const cpu = fresh()
  go(cpu, settle)
  if (startKey >= 0) { cpu.keyDown(startKey); go(cpu, 8); cpu.keyUp(startKey); go(cpu, settle) }
  return cpu
}

// A tap first, because a program waiting on FX0A only moves on when the key
// is let go, then the key is held for the rest of the time.
const tapThenHold = (cpu, k) => { cpu.keyDown(k); go(cpu, 4); cpu.keyUp(k); go(cpu, 4); cpu.keyDown(k); go(cpu, hold - 8) }

// Where the lit pixels sit, so a shift shows up as a direction.
function shape(cpu) {
  let n = 0, sx = 0, sy = 0
  for (let y = 0; y < cpu.height; y++) {
    for (let x = 0; x < cpu.width; x++) {
      if (cpu.display[y * WIDTH + x]) { n++; sx += x; sy += y }
    }
  }
  return { n, x: n ? sx / n : 0, y: n ? sy / n : 0 }
}
const picture = (cpu) => {
  const rows = []
  for (let y = 0; y < cpu.height; y++) {
    let l = ""
    for (let x = 0; x < cpu.width; x++) l += cpu.display[y * WIDTH + x] ? "#" : "."
    rows.push(l)
  }
  return rows.join("\n")
}

const base = begin()
const still = begin()
go(still, hold)
const rest = shape(still)
const restPic = picture(still)

console.log(`${name}: ${meta.title ?? ""} ${meta.desc ? "\n" + meta.desc : ""}`)
console.log(`start key: ${startKey >= 0 ? PAD[startKey] : "none known"}`)
console.log(`\nleft alone for ${hold} more frames: ${rest.n} lit pixels${picture(base) === restPic ? ", picture still" : ", picture moving on its own"}\n`)

for (let k = 0; k < 16; k++) {
  const cpu = begin()
  tapThenHold(cpu, k)
  const s = shape(cpu)
  const pic = picture(cpu)
  if (pic === restPic) continue
  const dx = s.x - rest.x, dy = s.y - rest.y, dn = s.n - rest.n
  const bits = []
  if (Math.abs(dx) > 0.4) bits.push(dx > 0 ? `right ${dx.toFixed(1)}` : `left ${(-dx).toFixed(1)}`)
  if (Math.abs(dy) > 0.4) bits.push(dy > 0 ? `down ${dy.toFixed(1)}` : `up ${(-dy).toFixed(1)}`)
  if (Math.abs(dn) > 2) bits.push(dn > 0 ? `+${dn} pixels` : `${dn} pixels`)
  console.log(`  ${PAD[k]}  ${bits.join(", ") || "picture differs, but not by much"}`)
}
console.log(`\n--- left alone ---\n${restPic}`)
if (args.includes("--show")) {
  const k = PAD.indexOf(args[args.indexOf("--show") + 1]?.toUpperCase())
  const cpu = begin(); tapThenHold(cpu, k)
  console.log(`\n--- holding ${PAD[k]} ---\n${picture(cpu)}`)
}
