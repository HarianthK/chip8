// One saved state per frame. Memory is kept as an undo log of the bytes each
// frame changed, since a whole copy is 64 KB and most frames touch a few.
export class History {
  constructor(cpu, frames = 600) {
    this.cpu = cpu
    this.frames = frames
    this.shadow = cpu.memory.slice()
    this.past = [{ state: cpu.save(), changed: [] }]
  }

  record() {
    const m = this.cpu.memory, s = this.shadow, changed = []
    for (let a = 0; a < m.length; a++) if (m[a] !== s[a]) { changed.push(a, s[a]); s[a] = m[a] }
    this.past.push({ state: this.cpu.save(), changed })
    if (this.past.length > this.frames) this.past.shift()
  }

  // One frame back; false once the oldest kept frame is reached.
  back() {
    if (this.past.length < 2) return false
    const { changed } = this.past.pop()
    for (let j = 0; j < changed.length; j += 2) this.shadow[changed[j]] = changed[j + 1]
    this.cpu.memory.set(this.shadow)
    this.cpu.restore(this.past[this.past.length - 1].state)
    return true
  }
}
