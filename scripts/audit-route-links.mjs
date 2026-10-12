import fs from 'node:fs';
import path from 'node:path';
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
const files = walk('src');
const routes = files.filter(file => /\/route\.ts$/.test(file)).map(file => '/' + file.slice('src/app/'.length, -'/route.ts'.length));
const unknown = [];
for (const file of files.filter(file => /\.tsx?$/.test(file))) {
  const content = fs.readFileSync(file, 'utf8');
  for (const match of content.matchAll(/fetch\(["'`]([^"'`]+)["'`]/g)) {
    const target = match[1].split('?')[0];
    if (!target.startsWith('/api/') || target.includes('${')) continue;
    if (!routes.includes(target)) unknown.push({ file, target });
  }
}
console.log(JSON.stringify({ checkedFiles: files.length, apiRoutes: routes.length, missingApiTargets: unknown }, null, 2));
if (unknown.length) process.exitCode = 1;
