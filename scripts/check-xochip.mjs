// Runs the XO-CHIP test under each breakage it is meant to catch and reports
// which rows went red, so a row is known to test the thing it says it does.
// Run: node scripts/check-xochip.mjs
import { readFileSync } from "node:fs"
import { WIDTH } from "../chip8.js"
import { BREAKAGES, machine } from "./mutate.mjs"

const rom = new Uint8Array(readFileSync("tests/xochip.ch8"))
const ROWS = { 1: "scroll-ignores-plane", 2: "scroll-up-ignored", 3: "long-i-twelve-bit", 4: "skip-two-over-long", 5: "plane-ignored", 6: "range-save-moves-i", 7: "loadflags-ignored", 8: "big-sprite-eight-wide" }
// An interpreter with no planes at all fails the plane scroll row as well.
const ALSO = { "plane-ignored": [1] }
// Third row of the tick has a pixel at x=16; the cross has nothing there.
const tick = (cpu, row) => cpu.display[(2 + (row - 1) * 7 + 2) * WIDTH + 16] === 1

const rows = (breakage) => {
  const cpu = machine(breakage)
  cpu.load(rom)
  for (let i = 0; i < 8000 && !cpu.halted; i++) cpu.step()
  return Object.keys(ROWS).map((r) => (tick(cpu, +r) ? "ok " : "RED")).join(" ")
}
console.log("row:                  1   2   3   4   5   6   7   8")
console.log(`nothing broken:       ${rows(null)}`)
let good = true
for (const [row, name] of Object.entries(ROWS)) {
  const got = rows(BREAKAGES[name])
  const reds = new Set([+row, ...(ALSO[name] ?? [])])
  const expect = Object.keys(ROWS).map((r) => (reds.has(+r) ? "RED" : "ok ")).join(" ")
  const fine = got === expect
  good &&= fine
  console.log(`${name.padEnd(22)}${got}${fine ? "" : "   <- expected red: " + [...reds].join(",")}`)
}
console.log(good ? "\nevery row goes red under its own breakage and under no other, except where the feature is the same" : "\nSOMETHING IS OFF")
process.exit(good ? 0 : 1)
