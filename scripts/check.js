import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(path);
    else if (path.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
      if (result.status !== 0) process.exit(result.status || 1);
    }
  }
}
['scripts', 'site', 'test'].forEach(walk);
console.log('Website JavaScript syntax checks passed.');
