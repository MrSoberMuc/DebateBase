/* Führt alle automatischen Tests nacheinander aus. Aufruf: node tests/run-all.mjs */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = ['migrate.unit.test.mjs', 'etappe1.test.mjs', 'etappe2.test.mjs', 'etappe3.test.mjs', 'etappe4.test.mjs', 'etappe5.test.mjs', 'analyse.unit.test.mjs', 'phase4-etappe1.test.mjs'];
let pass = 0, total = 0, bad = [];
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8', timeout: 600000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const m = out.match(/(\d+) von (\d+) Tests bestanden/);
  if (m) { pass += +m[1]; total += +m[2]; }
  out.split('\n').filter(l => l.startsWith('FEHL')).forEach(l => bad.push(f + ': ' + l));
  console.log(`${f.padEnd(24)} ${m ? m[1] + '/' + m[2] : 'FEHLER BEIM START'}`);
  if (!m) bad.push(f + ': ' + out.slice(-400));
}
console.log(`\nGesamt: ${pass} von ${total} Tests bestanden.`);
if (bad.length) { console.log('\nFehlgeschlagen:'); bad.forEach(b => console.log(' ', b)); }
process.exit(bad.length ? 1 : 0);
