// Import safety regression checks: complete source fields, no unreviewed install,
// stale verification rejection, unique aliases, and strict phase failures.
// Fixtures live only in a temporary directory; these checks never touch the app.
const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname,'config/sat.json'),'utf8'));
// Use the configured interpreter, else whichever Python is on PATH (python, python3, or the Windows py launcher).
const candidates = [process.env.PYTHON, cfg.test_command[0], 'python', 'python3', 'py'].filter(Boolean);
let result = null;
for (const exe of candidates) {
  result = spawnSync(exe, [path.join(__dirname,'kit/check_safety.py')], {encoding:'utf8',env:{...process.env,PYTHONUTF8:'1'}});
  if (!result.error) break;
}
if (result.error) { console.error('No Python interpreter found (tried: ' + candidates.join(', ') + '). Set PYTHON to its path.'); process.exit(1); }
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
process.exit(result.status === 0 ? 0 : 1);
