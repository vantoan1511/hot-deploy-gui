# Hot Deploy GUI

A cross-platform desktop application for managing and executing Java service deployments to remote servers over SSH. Built with NeutralinoJS, Vue 3, and TypeScript.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

## Features

- **Saved deployment profiles** — store SSH credentials, remote paths, and service metadata locally with encrypted passwords
- **Multi-service deployments** — deploy multiple JARs in a single workflow with per-service configuration
- **Step-by-step workflow** — run the full deploy pipeline automatically or execute individual steps manually
- **Live terminal output** — ANSI-colored streaming output for every deployment step
- **Wildcard path resolution** — `remoteDeployPath` supports glob patterns resolved at runtime
- **Import / Export** — serialize and share deployment configs as JSON
- **Flexible SSH auth** — SSH key, `sshpass`, PuTTY `plink`, or `SSH_ASKPASS` fallback

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop runtime | [NeutralinoJS](https://neutralino.js.org/) v6.5 |
| Frontend framework | Vue 3 + TypeScript |
| State management | Pinia |
| Styling | Tailwind CSS v4 |
| Build tool | Vite 8 |
| Schema validation | Zod |
| Terminal rendering | ansi-to-html |

## Quick Start

> Already have Node.js and NeutralinoJS CLI installed? Get running in three steps.

```bash
# 1. Install frontend dependencies
cd src && npm install

# 2. Start the Vite dev server (keep this terminal open)
npm run dev

# 3. Launch the desktop app (new terminal, from project root)
neu run
```

The app opens at 1280×800. Any code change in `src/src/` hot-reloads instantly.

---

## Prerequisites

- Node.js 20.19+ or 22.12+
- [NeutralinoJS CLI](https://neutralino.js.org/docs/cli/neu-cli) (`npm i -g @neutralinojs/neu`)
- OpenSSH (or PuTTY on Windows) available on `PATH`
- `sshpass` installed for password-based authentication (optional — app falls back to SSH_ASKPASS)

## Getting Started

### Development

```bash
# Install frontend dependencies
cd src
npm install

# Start the Vite dev server
npm run dev

# In a separate terminal, launch NeutralinoJS (from project root)
neu run
```

The app connects to the Vite dev server at `http://localhost:5173` with hot module replacement.

### Build

```bash
# Build the Vue SPA
cd src
npm run build

# Package the desktop app
cd ..
neu build
```

Output binaries are placed in `dist/` for each target platform.

## Usage

### 1. Create a Deployment

Click **+ New Deployment** on the dashboard and fill in the form:

**Connection**

| Field | Description |
|-------|-------------|
| Name | A human-readable label, e.g. `Production — Auth Service` |
| Host | Remote hostname or IP address |
| Username | SSH login username |
| Port | SSH port (default `22`) |
| Auth Method | `SSH Key` (path to private key) or `Password` (stored encrypted) |

**Remote Environment**

| Field | Description |
|-------|-------------|
| Deploy Path | Remote directory where artifacts are uploaded. Supports glob patterns, e.g. `/opt/app/temp/services*` — resolved to the newest matching directory at runtime |
| Log Path | Path to the service log file, used for tailing after launch |

**Services**

Add one or more services. Each service has:

| Field | Description |
|-------|-------------|
| Name | Service name; also used to locate the service directory on the remote host (glob-aware) |
| Local JAR | Absolute local path to the built `.jar` artifact |
| Start Command | Shell command to launch the service, e.g. `systemctl start my-service` |
| Stop Command | Optional override; defaults to `pkill -f <service-name>` |
| UI Service | Enable for single-JAR replacement (no extraction, no service directory resolution) |

---

### 2. Run a Deployment

Open a deployment and click **Deploy →** to enter the deployment engine.

**Full deployment (recommended)**

Click **⚡ Start Full Deployment**. All steps run automatically in sequence. The pipeline halts on the first error and highlights the failing step.

**Step-by-step**

Each step has an individual **Run** button. Steps are gated — a step cannot run until all prior steps have succeeded. Use this mode to re-run a single step after fixing an issue without repeating the whole pipeline.

**Terminal output**

The right-hand panel streams ANSI-colored stdout/stderr for every step. Use the toolbar buttons to:
- **Copy** — copy the full log to clipboard
- **Follow** — jump to the bottom and re-enable auto-scroll (auto-scroll pauses when you scroll up)

---

### 3. Manage Deployments

**Clone** — duplicate an existing deployment with a new UUID; useful for creating environment variants (staging vs. production).

**Edit** — reopen the form pre-populated with all saved values.

**Delete** — permanently removes the configuration after a confirmation prompt.

**Export** — saves the deployment to a `.json` file. Passwords are omitted from the export by default.

**Import** — load a `.json` file exported from another machine. On UUID collision you can choose to:
- **Replace** the existing configuration
- **Keep both** (the import is renamed and assigned a new UUID)
- **Skip** the conflicting entry

---

### 4. Settings

Open **Settings** from the sidebar to configure:

- **Default SSH Port** — pre-filled value when creating new deployments
- **sshpass available** — toggle to indicate `sshpass` is on `PATH`; affects which password-auth backend is used

---

## Deployment Workflow

Each deployment runs a deterministic sequence of steps:

| # | Step | Description |
|---|------|-------------|
| 1 | Test Connection | Verify SSH connectivity |
| 2 | Validate Remote Path | Confirm the deploy directory exists (wildcard-aware) |
| 3 | Resolve Service Dir | Locate the service directory on the remote host |
| 4 | Upload Archive | SCP the local JAR to the deploy path |
| 5 | Extract Files | Extract the JAR or replace the existing remote JAR |
| 6 | Verify Running Instance | Show running PIDs (warns if none found) |
| 7 | Stop Existing Service | Kill running processes using the configured stop command |
| 8 | Launch Service | Run the start command and verify the new PID |

Steps 3–8 repeat for each service in the deployment. You can run the full pipeline with one click or trigger each step individually.

## Configuration

The app stores all data locally via NeutralinoJS storage:

- **Windows:** `%APPDATA%\hot-deploy-gui\`
- **macOS / Linux:** `~/.config/hot-deploy-gui/`

Passwords are encrypted at rest using AES-GCM 256 with a machine-specific key derived via PBKDF2.

See [`SPEC.md`](SPEC.md) for the full technical specification.

## Project Structure

```
hot-deploy-gui/
├── neutralino.config.json   # Desktop app config (window size, API allowlist)
├── src/
│   ├── src/
│   │   ├── stores/          # Pinia state (deployments, session, settings)
│   │   ├── views/           # Page-level components
│   │   ├── components/      # Reusable UI components
│   │   ├── composables/     # useSSH, useDeployRunner, useFileDialog
│   │   └── utils/           # crypto, exportImport, pathUtils
│   └── dist/                # Vue build output (served by NeutralinoJS)
└── SPEC.md
```

## License

[MIT](LICENSE)
