// Works out which keys a program watches by reading it rather than playing it,
// then checks that against what playing it finds. See DOCS.md.
// Run: node scripts/keys.mjs [name]
import { Chip8 } from "../chip8.js"
import { keysWatched } from "../disassemble.js"
import { manifest as archive, rom as fetchRom } from "./archive.mjs"

const PAD = ["X", "1", "2", "3", "Q", "W", "E", "A", "S", "D", "Z", "C", "4", "R", "F", "V"]

// The same probe the page uses: hold each key in turn and see which ones the
// program ever asks about.
function keysPlayed(rom, options = {}) {
  const cpu = new Chip8()
  Object.assign(cpu.quirks, {
    shift: !!options.shiftQuirks, loadStore: !!options.loadStoreQuirks,
    logic: !!options.logicQuirks, clip: !!options.clipQuirks, jump: !!options.jumpQuirks,
  })
  cpu.load(rom)
  const go = (n) => { for (let f = 0; f < n && !cpu.halted; f++) { for (let i = 0; i < 30 && !cpu.halted; i++) cpu.step(); cpu.tickTimers() } }
  go(120)
  for (let k = 0; k < 16; k++) { cpu.keyDown(k); go(8); cpu.keyUp(k); go(8) }
  go(60)
  return new Set([...cpu.used.keys()].filter((k) => cpu.used[k]))
}

const show = (set) => [...set].sort((a, b) => a - b).map((k) => PAD[k]).join(" ") || "(none)"

const manifest = await archive()
const wanted = process.argv[2]
let agree = 0, sure = 0, vague = 0, extra = 0
for (const [id, meta] of Object.entries(manifest).sort()) {
  if (wanted && wanted !== id) continue
  const rom = await fetchRom(id)
  const read = keysWatched(rom)
  const played = keysPlayed(rom, meta.options)
  // Reading sees every key the program could ask about; playing only sees the
  // ones it reached. So where reading is sure, it must cover playing. Where a
  // key number is worked out at run time, reading says so and cannot be held
  // to that.
  const missed = [...played].filter((k) => !read.asked.has(k))
  const onlyRead = [...read.asked].filter((k) => !played.has(k))
  const notes = []
  let mark = "ok  "
  if (read.anyKey) { vague++; if (missed.length) { mark = "?   "; notes.push(`playing also found ${show(new Set(missed))}`) } else agree++ }
  else if (missed.length) { mark = "FAIL"; notes.push(`PLAYING FOUND ${show(new Set(missed))} THAT READING MISSED`) }
  else { sure++; agree++ }
  if (onlyRead.length) { extra++; notes.push(`reading also found ${show(new Set(onlyRead))}, which playing never reached`) }
  console.log(`${mark} ${id.padEnd(20)} reading: ${show(read.asked).padEnd(24)} playing: ${show(played).padEnd(24)} ${notes.join("; ")}`)
}
console.log(`
reading knew every key in ${sure} programs, and covered what playing found in all ${agree}`)
console.log(`${vague} work a key number out at run time, so reading cannot name them all`)
console.log(`${extra} watch a key that playing never reached`)
