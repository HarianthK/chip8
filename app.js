import { Chip8, WIDTH, HEIGHT } from "./chip8.js"

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

function paint() {
  const w = canvas.width / WIDTH
  const h = canvas.height / HEIGHT
  ctx.fillStyle = "#0b0f14"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = "#e08a3c"
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (cpu.display[y * WIDTH + x]) ctx.fillRect(x * w, y * h, w, h)
    }
  }
}

// One square wave, gated by the sound timer. Built lazily because a browser
// will not let a page make noise before the reader has touched it.
function tone(on) {
  if (!on) {
    if (audio?.gain) audio.gain.gain.value = 0
    return
  }
  if (!audio) {
    const ctxA = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctxA.createOscillator()
    const gain = ctxA.createGain()
    osc.type = "square"
    osc.frequency.value = 440
    gain.gain.value = 0
    osc.connect(gain).connect(ctxA.destination)
    osc.start()
    audio = { ctxA, gain }
  }
  audio.gain.gain.value = 0.04
}

let last = performance.now()
let owed = 0

function frame(now) {
  if (!running) return
  const elapsed = Math.min(now - last, 100)
  last = now

  // Instructions are paced by real time rather than per frame, so the speed
  // control means the same thing on any display.
  owed += (elapsed / 1000) * speed
  const budget = Math.floor(owed)
  owed -= budget
  for (let i = 0; i < budget; i++) cpu.step()

  // Timers run at 60Hz whatever the processor is doing.
  cpu.tickTimers()
  tone(cpu.sound > 0)

  if (cpu.drawn) {
    paint()
    cpu.drawn = false
  }
  statusEl.textContent = cpu.halted ? "halted" : "running"
  requestAnimationFrame(frame)
}

function start() {
  if (running) return
  running = true
  last = performance.now()
  requestAnimationFrame(frame)
}

async function loadUrl(url, name) {
  const res = await fetch(url)
  if (!res.ok) {
    statusEl.textContent = `could not load ${name}`
    return
  }
  cpu.load(new Uint8Array(await res.arrayBuffer()))
  paint()
  document.getElementById("loaded").textContent = name
  start()
}

document.querySelectorAll("[data-rom]").forEach((button) => {
  button.addEventListener("click", () => loadUrl(button.dataset.rom, button.textContent.trim()))
})

document.getElementById("file").addEventListener("change", async (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  cpu.load(new Uint8Array(await file.arrayBuffer()))
  paint()
  document.getElementById("loaded").textContent = file.name
  start()
})

document.getElementById("reset").addEventListener("click", () => {
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
  cpu.keyDown(key)
})
addEventListener("keyup", (e) => {
  const key = KEYMAP[e.code]
  if (key !== undefined) cpu.keyUp(key)
})

paint()

// The archive publishes a manifest alongside the programs: author, description,
// and the tick rate each was written for. That rate is instructions per frame
// rather than per second, so it is multiplied by sixty to match this clock.
const ARCHIVE = "https://raw.githubusercontent.com/JohnEarnest/chip8Archive/master"
const games = document.getElementById("games")
const about = document.getElementById("about")
let manifest = {}

fetch(`${ARCHIVE}/programs.json`)
  .then((r) => (r.ok ? r.json() : {}))
  .then((data) => {
    manifest = data
    // XO-CHIP programs use instructions this machine does not implement, so
    // offering them would only produce a frozen screen and a puzzled reader.
    const playable = Object.entries(data)
      .filter(([, meta]) => !meta.options?.enableXO)
      .sort((a, b) => a[0].localeCompare(b[0]))

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
    // The slider only spans what is comfortable to drag. A few programs ask for
    // far more than that, so the label shows the real figure and the handle
    // simply parks at the end.
    speedEl.value = String(Math.min(Math.max(speed, 100), Number(speedEl.max)))
    document.getElementById("speedLabel").textContent = `${speed.toLocaleString()}/sec`
  }

  about.textContent = meta.desc ?? ""
  await loadUrl(`${ARCHIVE}/roms/${id}.ch8`, id)
})
