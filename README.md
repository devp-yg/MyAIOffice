# My AI Office

My AI Office is a local dashboard that visualizes Codex activity as a 3D office. It runs on your computer and reads local Codex session metadata to show projects, staff, and activity.

## Run from source

Requirements: Node.js 24 or later.

```sh
npm start
```

Open <http://127.0.0.1:4173> in a browser. The server listens on the loopback interface only. No account, external font, analytics service, or cloud connection is required.

The app reads session files under `~/.codex/sessions` and local project registrations when available. It does not copy those source files into the app database. App-managed staff and floor assignments are stored under `data/office.sqlite`; browser preferences stay in the browser's local storage. Keep the `data/` directory private and do not commit it.

## Build a desktop ZIP

Run `node build-release.mjs` to create a ZIP in `dist/`. The release builder includes the Node.js runtimes under `runtime/node/` when present, plus their license files. Those binaries are excluded from this Git repository because they are large. A source checkout can run with Node.js 24 installed; to build the self-contained macOS and Windows ZIP, provide the four platform runtimes in the same directory layout as the original distribution.

The release ZIP does not include the developer's database or browser settings. On first launch it creates a fresh local database.

## Project structure

- `public/`: web UI, 3D scene, and bundled Three.js files
- `server*.mjs`: local server and session metadata handling
- `docs/design/`: design notes and diagrams
- `tests/`: automated tests (`npm test`)
- `runtime/node/`: local release runtimes; not tracked by Git
- `data/` and `dist/`: local database and generated release files; not tracked by Git

Third-party software notices are included alongside bundled assets and runtimes.
