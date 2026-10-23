# My AI Office

My AI Office is a local dashboard that visualizes Codex activity as a 3D office. It runs on your computer and reads local Codex session metadata to show projects, staff, and activity.

## Run the app

Extract the downloaded project or release ZIP, then launch the file for your computer:

- **Windows:** Double-click `Start My AI Office.bat`.
- **macOS:** Double-click `Start My AI Office.command`. If macOS asks you to confirm, choose **Open**.

The launcher starts the local server and opens <http://127.0.0.1:4173> in your browser. Leave the server window open while using the office. On Windows, close the minimized server window to stop it; on macOS, close the Terminal window running the server.

### Node.js requirement

The source repository and source ZIP do not include Node.js. Install Node.js 24 or later from <https://nodejs.org/> before launching either file. There are no npm packages to install. A complete release ZIP can include its own Node.js runtime, so it can run without a separate Node.js installation.

If the launcher says Node.js 24 or later is required, install or update Node.js and run the launcher again. The macOS launcher supports Apple silicon and Intel Macs.

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
