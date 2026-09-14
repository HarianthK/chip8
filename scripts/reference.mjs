// Prints what a correct interpreter shows for a ROM, to diff another emulator against.
// Run: node scripts/reference.mjs rom.ch8 [--as chip8|schip|xochip] [--key 1:60:70 ...]
// or:  node scripts/reference.mjs --score screen.txt   (rows of another emulator's quirks screen)
import { readFileSync } from "node:fs"
import { Chip8, WIDTH } from "../chip8.js"

const args = process.argv.slice(2)
const file = args[0]
if (!file || (file === "--score" && !args[1])) {
  console.error("usage: node scripts/reference.mjs <rom> [--as chip8|schip|xochip] [--key K:down:up ...] [--frames N] [--ipf N] [--rows]")
  process.exit(1)
}
const flag = (f, fallback) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : fallback }

// The same three platforms the page's test buttons use.
const PLATFORMS = {
  chip8: { logic: true, clip: true, vBlank: true },
  schip: { shift: true, loadStore: true, clip: true, jump: true },
  xochip: {},
}
// Six words at x=59..61, y=2+5r, each a tick or a cross.
function score(lines) {
  const names = ["vfReset", "memory", "displayWait", "clipping", "shifting", "jumping"]
  const tick = "#.#/##./#..", cross = "#.#/.#./#.#"
  return names.map((name, r) => {
    const mark = [0, 1, 2].map((i) => (lines[2 + 5 * r + i] ?? "").slice(59, 62)).join("/")
    return `${name}:${mark === tick ? "ok" : mark === cross ? "X" : "?"}`
  }).join(" ")
}
if (file === "--score") {
  const text = readFileSync(args[1], "utf8").split(/\r?\n/)
  console.log(score(text))
  process.exit(0)
}

const cpu = new Chip8()
Object.assign(cpu.quirks, PLATFORMS[flag("--as", "chip8")] ?? {})
cpu.load(new Uint8Array(readFileSync(file)))

// A key event is K:down:up, hex key and the frame numbers it goes down and up on.
const keys = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--key") keys.push(args[i + 1].split(":").map((v, j) => j ? Number(v) : parseInt(v, 16)))
}
const frames = Number(flag("--frames", 900))
const ipf = Number(flag("--ipf", 30))
for (let frame = 0; frame < frames; frame++) {
  for (const [k, down, up] of keys) { if (frame === down) cpu.keyDown(k); if (frame === up) cpu.keyUp(k) }
  for (let i = 0; i < ipf && !cpu.halted; i++) cpu.step()
  cpu.tickTimers()
}

const lines = []
for (let y = 0; y < cpu.height; y++) {
  let line = ""
  for (let x = 0; x < cpu.width; x++) line += cpu.display[y * WIDTH + x] ? "#" : "."
  lines.push(line)
}

// --rows reads the six result words off the quirks test instead of printing the screen.
console.log(args.includes("--rows") ? score(lines) : lines.join("\n"))
