// Import safety regression checks: complete source fields, no unreviewed install,
// stale verification rejection, unique aliases, and strict phase failures.
// Fixtures live only in a temporary directory; these checks never touch the app.
const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname,'config/sat.json'),'utf8'));
const result = spawnSync(cfg.test_command[0], [path.join(__dirname,'kit/check_safety.py')], {encoding:'utf8',env:{...process.env,PYTHONUTF8:'1'}});
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
process.exit(result.status === 0 ? 0 : 1);
