import { readFileSync } from "node:fs"
import { Chip8, WIDTH } from "./chip8.js"

const rom = process.argv[2]
const cycles = Number(process.argv[3] ?? 400000)
const cpu = new Chip8()
cpu.load(new Uint8Array(readFileSync(rom)))

for (let i = 0; i < cycles && !cpu.halted; i++) {
  cpu.step()
  if (i % 10 === 0) cpu.tickTimers()
}

let out = ""
for (let y = 0; y < cpu.height; y++) {
  let line = ""
  for (let x = 0; x < cpu.width; x++) line += cpu.display[y * WIDTH + x] ? "██" : "  "
  if (line.trim()) out += line.replace(/\s+$/, "") + "\n"
}
console.log(out || "(nothing drawn)")
console.log(`halted=${cpu.halted} pc=0x${cpu.pc.toString(16)}`)
