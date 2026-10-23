# My AI Office

My AI Office is a local dashboard that visualizes Codex activity as a 3D office. It runs on your computer and reads local Codex session metadata to show projects, staff, and activity.

## Run from source

Requirements:

- A Windows or macOS version supported by Node.js 24 or later.
- Node.js 24 or later. The Node.js installer includes `npm`.
- Git to clone the repository, or a ZIP utility to extract a downloaded source archive.

Download Node.js from <https://nodejs.org/> and install the current 24.x release or later. Then clone or download this repository and open a terminal in the project folder (the folder containing `package.json`). There are no npm packages to install for running the app.

### Windows

1. Install Node.js 24 or later from <https://nodejs.org/>. If a terminal was already open during installation, close and reopen it so it can find `node` and `npm`.
2. Open **PowerShell** and change to the project folder. For example:

   ```powershell
   cd "$HOME\Projects\MyAIOffice"
   ```

   If you downloaded a ZIP, use the path where you extracted it.
3. Check that Node.js is available, then start the app:

   ```powershell
   node --version
   npm start
   ```

   `node --version` should print `v24` or a later version. If Windows says `node` or `npm` is not recognized, reopen the terminal or rerun the Node.js installer and enable its PATH option.

### macOS

1. Install Node.js 24 or later from <https://nodejs.org/>. If you use a Node version manager, select version 24 or later in the terminal where you will run the app.
2. Open **Terminal** and change to the project folder. For example:

   ```sh
   cd ~/Projects/MyAIOffice
   ```

   If you downloaded a ZIP, use the path where you extracted it.
3. Check that Node.js is available, then start the app:

   ```sh
   node --version
   npm start
   ```

   `node --version` should print `v24` or a later version.

### Open and stop the app

Once the terminal says the server is running, open <http://127.0.0.1:4173> in your browser. Keep the terminal window open while using the app. Press **Ctrl+C** in that window to stop the server.

The server listens on the loopback interface, so it is available only on the computer running it. No account, external font, analytics service, or cloud connection is required.

### Local data

On first startup, the app creates a `data/` folder and the SQLite database at `data/office.sqlite` inside the project folder. It reads Codex session files from `~/.codex/sessions` on macOS and `%USERPROFILE%\.codex\sessions` on Windows, along with local project registrations when available. If that folder does not exist or has no sessions, the app can still start but will have no session activity to show. Session source files are not copied into the app database. Browser preferences stay in the browser's local storage. Keep the `data/` directory private and do not commit it.

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
