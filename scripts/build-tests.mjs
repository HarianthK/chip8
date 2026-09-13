// Builds every test in tests/ with Octo's own compiler, fetched from its repo.
// Run: node scripts/build-tests.mjs
import vm from "node:vm"
import { readdirSync, readFileSync, writeFileSync } from "node:fs"

const OCTO = "https://raw.githubusercontent.com/JohnEarnest/Octo/gh-pages/js/compiler.js"
const box = { console }
vm.createContext(box)
vm.runInContext(await (await fetch(OCTO)).text(), box)

for (const file of readdirSync("tests").filter((f) => f.endsWith(".8o"))) {
  const c = new box.Compiler(readFileSync(`tests/${file}`, "utf8"))
  try { c.go() } catch (e) { console.error(`${file}: ${e.message ?? e}`); process.exit(1) }
  if (c.hasError) { console.error(`${file}: ${c.reason} at line ${c.line}`); process.exit(1) }
  const out = `tests/${file.replace(/\.8o$/, ".ch8")}`
  writeFileSync(out, Uint8Array.from(c.rom))
  console.log(`${out}  ${c.rom.length} bytes`)
}
