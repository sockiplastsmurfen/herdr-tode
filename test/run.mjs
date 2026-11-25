// npm test: runs every test/*.test.mjs in a process of its own, with the fakes of Herdr's
// modules in place (register.mjs). Exits 1 if any fails.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL(".", import.meta.url));
const only = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => f.endsWith(".test.mjs") && (!only.length || only.some((o) => f.includes(o)))).sort();
let bad = 0;
for (const f of files) {
  console.log(f);
  const r = spawnSync(process.execPath, ["--import", "./register.mjs", `./${f}`], { cwd: dir, encoding: "utf8", timeout: 60000, env: { ...process.env, NODE_NO_WARNINGS: "1" } });
  process.stdout.write(r.stdout ?? "");
  if (r.stderr?.trim()) process.stdout.write(r.stderr.split("\n").map((l) => `  ${l}`).join("\n") + "\n");
  if (r.status !== 0) bad++;
}
console.log(bad ? `\n${bad} of ${files.length} test files failed` : `\nall ${files.length} test files passed`);
process.exit(bad ? 1 : 0);
