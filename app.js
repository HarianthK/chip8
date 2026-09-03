import { Chip8, WIDTH } from "./chip8.js"
import { NOTES } from "./notes.js"

// The original keypad was 4x4 hex. This is the layout every emulator settled on.
const KEYMAP = {
  Digit1: 0x1, Digit2: 0x2, Digit3: 0x3, Digit4: 0xc,
  KeyQ: 0x4, KeyW: 0x5, KeyE: 0x6, KeyR: 0xd,
  KeyA: 0x7, KeyS: 0x8, KeyD: 0x9, KeyF: 0xe,
  KeyZ: 0xa, KeyX: 0x0, KeyC: 0xb, KeyV: 0xf,
}

const cpu = new Chip8()
const canvas = document.getElementById("screen")
const ctx = canvas.getContext("2d")
const statusEl = document.getElementById("status")
const speedEl = document.getElementById("speed")

let running = false
let audio = null

// Instructions per second. The original had no fixed clock, so this is taste:
// too slow and games crawl, too fast and they become unplayable.
let speed = 700

// One colour per bitplane and a third where they overlap. Programs carry their
// own palettes, but keeping the page's own reads better than honouring them.
const INK = [null, "#e08a3c", "#5aa9c4", "#f4f1ec"]

function paint() {
  // A program can switch to the bigger screen at any moment, so the pixel
  // size is read from the machine each frame rather than fixed once.
  const across = cpu.width
  const down = cpu.height
  const w = canvas.width / across
  const h = canvas.height / down
  ctx.fillStyle = "#0b0f14"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  for (let y = 0; y < down; y++) {
    for (let x = 0; x < across; x++) {
      const ink = INK[cpu.display[y * WIDTH + x]]
      if (!ink) continue
      ctx.fillStyle = ink
      ctx.fillRect(x * w, y * h, w, h)
    }
  }
}

// Built lazily because a browser will not let a page make noise before the
// reader has touched it.
function voice() {
  if (audio) return audio
  const ctxA = new (window.AudioContext || window.webkitAudioContext)()
  const gain = ctxA.createGain()
  gain.gain.value = 0
  gain.connect(ctxA.destination)

  // The beep keeps its own tap so a waveform can silence it without stopping
  // an oscillator that cannot be restarted.
  const beep = ctxA.createGain()
  beep.gain.value = 1
  beep.connect(gain)
  const osc = ctxA.createOscillator()
  osc.type = "square"
  osc.frequency.value = 440
  osc.connect(beep)
  osc.start()

  audio = { ctxA, gain, beep, source: null, playing: "" }
  return audio
}

// The bits are samples: rate is 4000Hz at the default pitch, doubling every
// four octaves, and the buffer loops for as long as the sound timer runs.
function pattern(a) {
  const key = cpu.pattern.join(",") + "@" + cpu.pitch
  if (a.playing === key) return
  a.playing = key

  const buffer = a.ctxA.createBuffer(1, 128, a.ctxA.sampleRate)
  const data = buffer.getChannelData(0)
  for (let bit = 0; bit < 128; bit++) {
    data[bit] = (cpu.pattern[bit >> 3] >> (7 - (bit & 7))) & 1 ? 1 : -1
  }
  a.source?.stop()
  const source = a.ctxA.createBufferSource()
  source.buffer = buffer
  source.loop = true
  source.playbackRate.value = (4000 * 2 ** ((cpu.pitch - 64) / 48)) / a.ctxA.sampleRate
  source.connect(a.gain)
  source.start()
  a.source = source
}

function tone(on) {
  if (!on) {
    if (audio?.gain) audio.gain.gain.value = 0
    return
  }
  const a = voice()
  const custom = cpu.pattern.some((b) => b !== 0)
  if (custom) pattern(a)
  a.beep.gain.value = custom ? 0 : 1
  a.gain.gain.value = 0.04
}

let last = performance.now()
let owed = 0

// A tap can go down and up in the gap between two frames, and the machine would
// never see it. Releases wait until it has run a frame with the key held.
let frames = 0
const pressedOn = new Map()
const releasing = new Set()

function press(key) {
  releasing.delete(key)
  pressedOn.set(key, frames)
  cpu.keyDown(key)
}

function release(key) {
  releasing.add(key)
}

// The pad shows which keys the program is watching, which is the only record
// of a game's controls that exists anywhere.
const cells = new Map()
let lit = ""
// Keys found by the scan below, before the reader has touched anything.
let hinted = new Uint8Array(16)

// Nothing records a game's controls, so a throwaway machine plays the program
// in the background, pressing everything, and reports what it was asked about.
let scan = null

function startScan(bytes, perFrame) {
  const probe = new Chip8()
  probe.load(bytes)
  const script = [{ frames: 180 }]
  for (let k = 0; k < 16; k++) script.push({ down: k, frames: 6 }, { up: k, frames: 6 })
  script.push({ frames: 120 })
  // Capped, because a program asking for ten thousand a frame would spend the
  // whole budget before the scan reached anything worth seeing.
  scan = { probe, perFrame: Math.min(perFrame, 1200), script, at: 0, frame: 0, left: 0, spent: 0 }
  hinted = new Uint8Array(16)
}

// Sliced against the clock so the page never stalls while it runs.
function stepScan(ms) {
  if (!scan) return
  const until = performance.now() + ms
  while (scan.at < scan.script.length && scan.spent < 3000000) {
    const act = scan.script[scan.at]
    if (scan.left === 0) {
      if (act.down !== undefined) scan.probe.keyDown(act.down)
      if (act.up !== undefined) scan.probe.keyUp(act.up)
      scan.left = scan.perFrame
    }
    const chunk = Math.min(scan.left, 512)
    for (let i = 0; i < chunk && !scan.probe.halted; i++) { scan.probe.step(); scan.spent++ }
    scan.left -= chunk
    if (scan.left <= 0) {
      scan.probe.tickTimers()
      scan.left = 0
      if (++scan.frame >= act.frames) { scan.at++; scan.frame = 0 }
    }
    if (performance.now() >= until) break
  }
  hinted = scan.probe.used
  if (scan.at >= scan.script.length || scan.spent >= 3000000) scan = null
}

function showUsedKeys() {
  const now = cpu.used.join("") + hinted.join("")
  if (now === lit) return
  lit = now
  let any = false
  for (const [key, cell] of cells) {
    const on = cpu.used[key] === 1 || hinted[key] === 1
    cell.classList.toggle("used", on)
    if (on) any = true
  }
  padnote.textContent = any ? "Keys this game uses" : "Keypad"
}

function settleKeys() {
  for (const key of [...releasing]) {
    if (frames > (pressedOn.get(key) ?? 0)) {
      cpu.keyUp(key)
      releasing.delete(key)
    }
  }
  frames++
}

function frame(now) {
  if (!running) return
  const elapsed = Math.min(now - last, 100)
  last = now

  // Instructions are paced by real time rather than per frame, so the speed
  // control means the same thing on any display.
  owed += (elapsed / 1000) * speed

  // Time boxed, so a program asking for ten thousand instructions a frame
  // cannot block the page while it runs them.
  const started = performance.now()
  let ran = 0
  while (owed >= 1 && !cpu.halted) {
    cpu.step()
    owed--
    if ((++ran & 0x3ff) === 0 && performance.now() - started > 8) {
      owed = 0
      break
    }
  }

  settleKeys()
  stepScan(3)
  showUsedKeys()

  // Timers run at 60Hz whatever the processor is doing.
  cpu.tickTimers()
  tone(cpu.sound > 0)

  if (cpu.drawn) {
    paint()
    cpu.drawn = false
  }
  // Nothing in the archive needs an instruction this machine lacks, but a file
  // of your own might, and a named opcode beats a black screen.
  if (cpu.unsupported) {
    const op = cpu.unsupported.toString(16).toUpperCase().padStart(4, "0")
    statusEl.textContent = `stopped, needs ${op}`
  } else {
    statusEl.textContent = cpu.halted ? "halted" : "running"
  }
  requestAnimationFrame(frame)
}

function start() {
  if (running) return
  running = true
  last = performance.now()
  requestAnimationFrame(frame)
}

// Kept so Reset can start the same program again rather than empty the machine.
let current = null

function begin(bytes, name) {
  current = { bytes, name }
  startScan(bytes, Math.max(1, Math.round(speed / 60)))
  cpu.load(bytes)
  paint()
  document.getElementById("loaded").textContent = name
  start()
}

async function loadUrl(url, name) {
  const res = await fetch(url)
  if (!res.ok) {
    statusEl.textContent = `could not load ${name}`
    return
  }
  begin(new Uint8Array(await res.arrayBuffer()), name)
}

document.querySelectorAll("[data-rom]").forEach((button) => {
  button.addEventListener("click", () => {
    // The picker and blurb would otherwise keep describing a game that is no
    // longer running.
    games.value = ""
    about.textContent = ""
    plainMarquee(button.textContent.trim())
    loadUrl(button.dataset.rom, button.textContent.trim())
  })
})

document.getElementById("file").addEventListener("change", async (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  games.value = ""
  about.textContent = ""
  plainMarquee(file.name)
  begin(new Uint8Array(await file.arrayBuffer()), file.name)
})

// Reset restarts what is loaded. Emptying the machine instead would leave the
// loop running over blank memory, which reported itself as running.
document.getElementById("reset").addEventListener("click", () => {
  if (current) {
    begin(current.bytes, current.name)
    return
  }
  running = false
  cpu.reset()
  paint()
  document.getElementById("loaded").textContent = "nothing"
  statusEl.textContent = "idle"
})

speedEl.addEventListener("input", () => {
  speed = Number(speedEl.value)
  document.getElementById("speedLabel").textContent = `${speed}/sec`
})

addEventListener("keydown", (e) => {
  const key = KEYMAP[e.code]
  if (key === undefined) return
  e.preventDefault()
  press(key)
})
addEventListener("keyup", (e) => {
  const key = KEYMAP[e.code]
  if (key !== undefined) release(key)
})

// The same sixteen keys by touch. Pointer events cover mouse and finger alike,
// and capture keeps the release on the cell even if the finger slides off it.
const pad = document.getElementById("pad")
for (const cell of pad.querySelectorAll("td[data-code]")) {
  const key = KEYMAP[cell.dataset.code]
  cells.set(key, cell)
  const onPointer = (on) => (e) => {
    e.preventDefault()
    if (on) cell.setPointerCapture?.(e.pointerId)
    cell.classList.toggle("down", on)
    on ? press(key) : release(key)
  }
  cell.addEventListener("pointerdown", onPointer(true))
  cell.addEventListener("pointerup", onPointer(false))
  cell.addEventListener("pointercancel", onPointer(false))
}

paint()

// The manifest carries each program's author, description and tick rate. That
// rate is instructions per frame, so sixty of them make a second.
const ARCHIVE = "https://raw.githubusercontent.com/JohnEarnest/chip8Archive/master"
const games = document.getElementById("games")
const about = document.getElementById("about")
const titleEl = document.getElementById("title")
const creditsEl = document.getElementById("credits")
const howto = document.getElementById("howto")
const padnote = document.getElementById("padnote")

const PLATFORM = { chip8: "CHIP-8", schip: "SUPER-CHIP", xochip: "XO-CHIP" }

function marquee(id, meta) {
  titleEl.textContent = meta.title || id
  // One entry in the archive spells the field "athors", which used to leave
  // that author uncredited.
  const who = meta.authors ?? meta.athors ?? []
  const bits = []
  if (who.length) bits.push(`<span>${who.join(", ")}</span>`)
  if (meta.event) bits.push(`<span>${meta.event}</span>`)
  if (meta.release) bits.push(`<span>${String(meta.release).slice(0, 4)}</span>`)
  const badge = PLATFORM[meta.platform]
  if (badge) bits.push(`<span class="badge">${badge}</span>`)
  creditsEl.innerHTML = bits.join("")

  const note = NOTES[id]
  howto.innerHTML = note ?? ""
  howto.hidden = !note
}

function plainMarquee(name) {
  titleEl.textContent = name
  creditsEl.innerHTML = ""
  howto.hidden = true
}
let manifest = {}

fetch(`${ARCHIVE}/programs.json`)
  .then((r) => (r.ok ? r.json() : {}))
  .then((data) => {
    manifest = data
    const playable = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]))

    games.innerHTML = `<option value="">Pick a program (${playable.length})</option>`
    for (const [id, meta] of playable) {
      const option = document.createElement("option")
      option.value = id
      option.textContent = `${id}${meta.authors?.length ? ` by ${meta.authors[0]}` : ""}`
      games.append(option)
    }
  })
  .catch(() => {
    games.innerHTML = '<option value="">Could not reach the archive</option>'
  })

games.addEventListener("change", async () => {
  const id = games.value
  if (!id) return
  const meta = manifest[id] ?? {}

  const perFrame = Number(meta.options?.tickrate)
  if (Number.isFinite(perFrame) && perFrame > 0) {
    speed = perFrame * 60
    // The slider spans what is comfortable to drag; programs asking for more
    // park the handle at the end while the label shows the real figure.
    speedEl.value = String(Math.min(Math.max(speed, 100), Number(speedEl.max)))
    document.getElementById("speedLabel").textContent = `${speed.toLocaleString()}/sec`
  }

  about.textContent = meta.desc ?? ""
  marquee(id, meta)
  await loadUrl(`${ARCHIVE}/roms/${id}.ch8`, meta.title || id)
})
