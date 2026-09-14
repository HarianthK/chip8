// The archive's manifest and ROMs, fetched once and kept in the temp folder,
// since a ROM never changes and every script here wants all of them.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

export const ARCHIVE = "https://raw.githubusercontent.com/JohnEarnest/chip8Archive/master"
const DIR = join(tmpdir(), "chip8-archive")
mkdirSync(DIR, { recursive: true })

export async function manifest() {
  return (await fetch(`${ARCHIVE}/programs.json`)).json()
}

export async function rom(id) {
  const file = join(DIR, `${id}.ch8`)
  if (existsSync(file)) return new Uint8Array(readFileSync(file))
  const res = await fetch(`${ARCHIVE}/roms/${id}.ch8`)
  if (!res.ok) throw new Error(`could not fetch ${id}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  writeFileSync(file, bytes)
  return bytes
}
