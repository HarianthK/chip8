// Runs the XO-CHIP test under each breakage it is meant to catch and reports
// which rows went red, so a row is known to test the thing it says it does.
// Run: node scripts/check-xochip.mjs
import { readFileSync } from "node:fs"
import { WIDTH } from "../chip8.js"
import { BREAKAGES, machine } from "./mutate.mjs"

const rom = new Uint8Array(readFileSync("tests/xochip.ch8"))
const ROWS = { 1: "scroll-up-ignored", 2: "long-i-twelve-bit", 3: "skip-two-over-long", 4: "plane-ignored", 5: "range-save-moves-i" }
// Third row of the tick has a pixel at x=16; the cross has nothing there.
const tick = (cpu, row) => cpu.display[(4 + (row - 1) * 8 + 2) * WIDTH + 16] === 1

const rows = (breakage) => {
  const cpu = machine(breakage)
  cpu.load(rom)
  for (let i = 0; i < 5000 && !cpu.halted; i++) cpu.step()
  return Object.keys(ROWS).map((r) => (tick(cpu, +r) ? "ok " : "RED")).join(" ")
}
console.log("row:              1   2   3   4   5")
console.log(`nothing broken:   ${rows(null)}`)
let good = true
for (const [row, name] of Object.entries(ROWS)) {
  const got = rows(BREAKAGES[name])
  const expect = Object.keys(ROWS).map((r) => (r === row ? "RED" : "ok ")).join(" ")
  const fine = got === expect
  good &&= fine
  console.log(`${name.padEnd(18)}${got}${fine ? "" : "   <- expected only row " + row + " red"}`)
}
console.log(good ? "\nevery row goes red under its own breakage and no other" : "\nSOMETHING IS OFF")
process.exit(good ? 0 : 1)
