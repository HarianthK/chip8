// Prints a program from the archive, or a file, as Octo source.
// Run: node scripts/disassemble.mjs <program or file.ch8>
import { readFileSync } from "node:fs"
import { disassemble } from "../disassemble.js"

const ARCHIVE = "https://raw.githubusercontent.com/JohnEarnest/chip8Archive/master"
const name = process.argv[2]
if (!name) { console.error("usage: node scripts/disassemble.mjs <program or file.ch8>"); process.exit(1) }
const rom = name.endsWith(".ch8")
  ? new Uint8Array(readFileSync(name))
  : new Uint8Array(await (await fetch(`${ARCHIVE}/roms/${name}.ch8`)).arrayBuffer())
process.stdout.write(disassemble(rom))
