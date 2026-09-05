// Prints a program's screen as text, optionally with a key held down.
// Run: node scripts/render.mjs snake [--frames 150] [--hold W] [--after 60]
import { Chip8, WIDTH } from "../chip8.js"

const ARCHIVE = "https://raw.githubusercontent.com/JohnEarnest/chip8Archive/master"
const PAD = { 1: "1", 2: "2", 3: "3", 12: "4", 4: "Q", 5: "W", 6: "E", 13: "R",
              7: "A", 8: "S", 9: "D", 14: "F", 10: "Z", 0: "X", 11: "C", 15: "V" }
const HEX = Object.fromEntries(Object.entries(PAD).map(([k, v]) => [v, Number(k)]))

const args = process.argv.slice(2)
const name = args[0]
if (!name) {
  console.error("usage: node scripts/render.mjs <program> [--frames N] [--hold KEY] [--after N] [--wake]")
  process.exit(1)
}
const flag = (f, fallback) => {
  const i = args.indexOf(f)
  return i >= 0 ? args[i + 1] : fallback
}
const frames = Number(flag("--frames", 150))
const after = Number(flag("--after", 60))
const hold = flag("--hold", null)
const wake = args.includes("--wake")

const manifest = await (await fetch(`${ARCHIVE}/programs.json`)).json()
const meta = manifest[name]
if (!meta) {
  console.error(`no program called ${name}`)
  process.exit(1)
}

const per = Number(meta.options?.tickrate) || 10
const cpu = new Chip8()
cpu.load(new Uint8Array(await (await fetch(`${ARCHIVE}/roms/${name}.ch8`)).arrayBuffer()))
const go = (n) => {
  for (let f = 0; f < n; f++) {
    for (let i = 0; i < per && !cpu.halted; i++) cpu.step()
    cpu.tickTimers()
  }
}

go(frames)
// Optionally press every key once, to get past a title screen and into play.
if (wake) {
  for (let k = 0; k < 16; k++) { cpu.keyDown(k); go(6); cpu.keyUp(k); go(6) }
  go(after)
}
if (hold) {
  const key = HEX[hold.toUpperCase()]
  if (key === undefined) { console.error(`${hold} is not one of the sixteen keys`); process.exit(1) }
  cpu.keyDown(key)
  go(after)
  cpu.keyUp(key)
}

const used = [...cpu.used].map((v, i) => (v ? PAD[i] : null)).filter(Boolean)
console.log(`${meta.title ?? name}  by ${(meta.authors ?? meta.athors ?? ["unknown"]).join(", ")}`)
console.log(`${meta.desc}`)
console.log(`platform ${meta.platform}   tickrate ${meta.options?.tickrate ?? "?"}   keys watched so far: ${used.join(" ") || "none"}`)
console.log("-".repeat(cpu.width))
for (let y = 0; y < cpu.height; y++) {
  let line = ""
  for (let x = 0; x < cpu.width; x++) line += cpu.display[y * WIDTH + x] ? "#" : "."
  console.log(line)
}
console.log("-".repeat(cpu.width))
