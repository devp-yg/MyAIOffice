import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const releaseName = `MyAIOffice-${manifest.version}`;
const dist = path.join(root, 'dist');
const stage = path.join(dist, releaseName);
const archive = path.join(dist, `${releaseName}.zip`);

await mkdir(dist, { recursive: true });
await rm(stage, { recursive: true, force: true });
await rm(archive, { force: true });
await mkdir(stage, { recursive: true });

for (const name of ['public', 'runtime/node']) {
  await cp(path.join(root, name), path.join(stage, name), { recursive: true });
}

for (const name of ['README.md', 'Start My AI Office.command', 'Start My AI Office.bat', 'server.mjs', 'server-database.mjs', 'server-records.mjs']) {
  await cp(path.join(root, name), path.join(stage, name));
}

const releaseManifest = {
  name: manifest.name,
  version: manifest.version,
  private: true,
  type: 'module',
  engines: manifest.engines,
  scripts: { start: 'node server.mjs' },
};
await writeFile(path.join(stage, 'package.json'), `${JSON.stringify(releaseManifest, null, 2)}\n`);

const resetOnFirstOpen = `<script>(function(){try{var key='my-ai-office-release-cleaned',version=${JSON.stringify(manifest.version)};if(localStorage.getItem(key)!==version){['my-ai-office-preferences','my-ai-office-last-project','office-floor-registry','office-staff-registry','shared-office-show-resting'].forEach(function(item){localStorage.removeItem(item)});localStorage.setItem(key,version)}}catch(_){}})();</script>`;
for (const filename of ['public/index.html', 'public/shared-office.html']) {
  const htmlPath = path.join(stage, filename);
  const html = await readFile(htmlPath, 'utf8');
  await writeFile(htmlPath, html.replace(/<head[^>]*>/i, head => `${head}${resetOnFirstOpen}`));
}

async function removeFinderMetadata(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.name === '.DS_Store') await rm(filename, { force: true });
    else if (entry.isDirectory()) await removeFinderMetadata(filename);
  }
}
await removeFinderMetadata(stage);

// The server creates a fresh data/office.sqlite on first launch. Never copy the
// developer's database or its WAL files into a release. The release also clears
// app-specific browser settings once when this version is first opened.
const zip = spawnSync('zip', ['-X', '-q', '-r', archive, releaseName], { cwd: dist, stdio: 'inherit' });
if (zip.error) throw zip.error;
if (zip.status !== 0) throw new Error(`zip exited with status ${zip.status}`);
await rm(stage, { recursive: true, force: true });

console.log(`Created ${path.relative(root, archive)}`);
