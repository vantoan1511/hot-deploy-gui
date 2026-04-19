# Hot Deploy GUI — Technical Specification

**Version:** 1.0.0  
**Stack:** NeutralinoJS · Vue 3 · TypeScript · Tailwind CSS v4  
**Design System:** Indigo primary · Surface secondary · Roboto font

---

## 1. Overview

Hot Deploy GUI is a cross-platform desktop application (Windows, macOS, Linux) that lets developers manage remote Java service deployments from a single, local UI. Each "deployment" is a saved configuration that encapsulates SSH connection details, local artifact path, remote target path, and one or more named services. From that configuration, the app drives a deterministic, multi-step deploy workflow over SSH.

---

## 2. Core Concepts

### 2.1 Deployment Configuration

A deployment is the central data entity of the app. It contains:

| Field | Type | Description |
|---|---|---|
| `id` | `string` (UUID v4) | Unique identifier, generated locally |
| `name` | `string` | Human-readable label (e.g. "Production — Auth Service") |
| `host` | `string` | Remote hostname or IP address |
| `username` | `string` | SSH login username |
| `authMethod` | `"key" \| "password"` | Authentication strategy |
| `privateKeyPath` | `string?` | Absolute local path to SSH private key (if `authMethod === "key"`) |
| `password` | `string?` | SSH password, stored encrypted (if `authMethod === "password"`) |
| `sshPort` | `number` | SSH port, default `22` |
| `localJarPath` | `string` | Absolute local path to the `.jar` file (legacy single-service field) |
| `remoteDeployPath` | `string` | Absolute remote path, e.g. `/opt/my-app/temp/services` |
| `remoteLogPath` | `string` | Absolute remote path, e.g. `/opt/my-app/logs` |
| `serviceName` | `string` | Name used to derive service folder and identify the running process (legacy single-service field) |
| `startCommand` | `string` | Shell command to start the service after deploy (legacy single-service field) |
| `services` | `Service[]` | Array of named services; each has `name`, `localJarPath`, `startCommand` |
| `createdAt` | `string` (ISO 8601) | Creation timestamp |
| `updatedAt` | `string` (ISO 8601) | Last modification timestamp |
| `tags` | `string[]` | Optional user-defined labels for filtering |
| `description` | `string?` | Optional free-text notes |

### 2.3 Control Connection

A control connection represents a remote deployment server for discovery and management. It contains:

| Field | Type | Description |
|---|---|---|
| `id` | `string` | UUID v4 |
| `name` | `string` | Label for the server |
| `applicationName` | `string` | Primary app name, used for general log detection |
| `applicationHttpPort` | `number?` | Metadata for easy access |
| `applicationHttpsPort` | `number?` | Metadata for easy access |
| `rootDeploymentPath` | `string` | Absolute base path on the server |
| `servicesPath` | `string` | Path to browse for services (supports wildcards/relative) |
| `logsPath` | `string` | Path to logs (relative to root, default "logs") |
| `serviceOverrides` | `Record` | Stores manual start commands or local JAR paths per detected service |
| `authMethod` | `string` | Same as Deployment |
| `host`, `username`, `sshPort` | | Same as Deployment |

---

### 2.2 Service

Each entry in `services` represents an independently deployable unit within a deployment:

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Service identifier, used for remote path derivation |
| `localJarPath` | `string` | Absolute local path to the `.jar` file |
| `startCommand` | `string` | Shell command to start this service after deploy |

**Derived values (not stored, computed at runtime):**
- `remoteServicePath` = `remoteDeployPath` + `/` + `service.name`
- Wildcard support in `remoteDeployPath`: e.g. `/opt/my-app/temp/services*`
- `remoteJarFilename` = basename of `service.localJarPath`
- `remoteServiceLogPath` = `remoteLogPath` + `/` + `service.name` + `.log`

---

## 3. Feature Catalogue

### 3.1 Deployment Management (CRUD + Clone)

| Action | Entry Point | Behaviour |
|---|---|---|
| **Create** | "New Deployment" button | Opens a full-page form with all fields. Validates on submit. |
| **View** | Click deployment card | Opens detail panel/page (read-only summary + action buttons) |
| **Edit** | "Edit" button on detail view | Re-opens form pre-populated; updates `updatedAt` on save |
| **Clone** | "Clone" context menu item | Deep-copies the deployment, appends `(Copy)` to name, assigns new UUID |
| **Delete** | "Delete" context menu item | Confirmation dialog before removal |

All deployments are stored locally (see §6 Data Persistence).

### 3.2 Import / Export

- **Export:** Serialize selected deployment(s) or all deployments to a `.json` file via the OS file-save dialog. Sensitive fields (`password`) are omitted or optionally encrypted with a user-supplied passphrase.
- **Import:** Accept a `.json` file. Parse, validate schema (zod), detect UUID collisions (offer "replace" or "keep both" per record via `ImportCollisionDialog`), then merge into local store. Legacy single-service format is migrated automatically on import. Passwords in imported files are treated as absent unless the user supplies the matching passphrase.

### 3.3 Deploy Workflow

The deploy workflow is a **linear sequence of steps per service**. Users may trigger it in two modes:

| Mode | Description |
|---|---|
| **One-click full deploy** | All steps run automatically in sequence. On any step failure, the sequence halts and surfaces the error. |
| **Manual step-by-step** | Each step has its own "Run" button. Steps are gated — a later step cannot start until all prior steps have succeeded. |

The app supports **both modes** simultaneously: a "Deploy All" button plus individual step controls on the same screen.

When a deployment has multiple services, a `ServiceSelectDialog` lets the user choose which services to include before the run begins.

#### 3.3.1 Step Definitions

Global steps run once per deployment session; per-service steps run once per selected service.

**Global steps:**

| # | Step Name | Command / Logic | Success Condition |
|---|---|---|---|
| 1 | **Test Connection** | `ssh -p <port> -o ConnectTimeout=5 <user>@<host> echo ok` | Exit code 0, stdout contains `ok` |
| 2 | **Validate Remote Path** | `ssh … "test -d <remoteDeployPath> && echo ok"` | Stdout contains `ok` |

**Per-service steps (repeated for each selected service):**

| # | Step Name | Command / Logic | Success Condition |
|---|---|---|---|
| 3 | **Copy JAR** | `scp -P <port> <localJarPath> <user>@<host>:<remoteDeployPath>/` | Exit code 0 |
| 4 | **Extract JAR** | `ssh … "mkdir -p <remoteServicePath> && cd <remoteServicePath> && jar xf <remoteDeployPath>/<jarFilename>"` | Exit code 0 |
| 5 | **Find Running PID** | `ssh … "pgrep -f <remoteServicePath>"` | Exit code 0 and a PID is returned (or "not running" — not a hard failure) |
| 6 | **Kill Service** | `ssh … "pkill -f <remoteServicePath>"` | Exit code 0, or 1 if no process found (non-fatal warning) |
| 7 | **Start Service** | `ssh … "<startCommand>"` (runs detached via `nohup … &`) | Exit code 0 |

> Steps 5–7 are always executed. Step 5 is informational; Step 6 is a no-op if nothing is running; Step 7 is a no-op if `startCommand` is empty.

### 3.4 Output Display

Each step surfaces output via a **collapsible terminal panel underneath a step-status list**:

- **Step status list:** Icon-based indicators (idle / running / success / warning / error) with step name and elapsed time. Steps are grouped by service in multi-service sessions.
- **Terminal panel:** Live-streaming stdout + stderr from the underlying SSH/SCP command, rendered in a monospaced font with ANSI colour support. Collapsible per step; expandable to full-screen.
- Logs for a session are kept in memory and cleared when a new deploy session starts.

### 3.5 Integrated Tools

Additional tool integrations are embedded in the sidebar:

| Tool | Route | Integration |
|---|---|---|
| **Release Tool** | `/release-tool` | Opens [Orchestrix Release Tool](https://releasetoo1.netlify.app/) in the system default browser via `Neutralino.os.open()`. Iframe embedding is not used because `showDirectoryPicker` is blocked in cross-origin iframes (Chrome 94+). |
| **Devtools+** | `/devtools` | Embedded full-height iframe pointing to `https://devtoo1s.vercel.app/`. |

### 3.6 Remote Server Controls (Controls)

Controls provide a high-level view of a deployment server by scanning the filesystem to discover active components.

#### 3.6.1 Service Discovery
- **Logic:** Scans `servicesPath`.
- **Directory detection:** Folders are services if they contain a `.jar` file.
- **UI detection:** Standalone `.jar` files in `servicesPath` are treated as UI services.
- **PID Detection:** Uses `pgrep -f <path>` to find running instances and status.

#### 3.6.2 Interaction Patterns
- **Start/Restart:** Uses detected start command via `ps` or manual override.
- **Stop:** Targeted `kill` of the single detected PID.
- **Disable:** Moves service directory to `*_disabled` and kills the process.
- **Hot Deploy:** Uploads local JAR and restarts; remembers local path for future use.

#### 3.6.4 Hot Deploy
Controls support direct localized deployments to a target server.
- **Local Package:** Stores a path to a `.jar`/`.tgz` file locally OR a remote URL (`http://...`).
- **URL Support:** If a URL is provided, the remote server fetches the package via `wget -q --no-check-certificate`.
- **Workflow:**
  1. Transfer: `scp` local file OR `wget` remote URL to `.tmp` path.
  2. Cleanup: Remove existing file with the same name.
  3. Finalize: Rename temp file to original name.
  4. Execution: Runs all `preCommands` then `postCommands`.
- **Strategy:** `postCommands` can be configured to run always or only on pre-command success.
- **UI:** A progress panel in `ControlDetailView` provides real-time feedback and terminal logs during execution.

---

## 4. Application Architecture

```
hot-deploy-gui/
├── neutralino.config.json
├── src/src/
│   ├── main.ts                       # App entry point; calls Neutralino init()
│   ├── App.vue
│   ├── router/
│   │   └── index.ts                  # Vue Router (hash mode for NeutralinoJS)
│   ├── stores/
│   │   ├── deployments.ts            # Pinia — deployment CRUD + persistence + encryption
│   │   ├── session.ts                # Pinia — active deploy session state
│   │   └── settings.ts               # Pinia — app settings; sshpass/plink availability check
│   ├── views/
│   │   ├── DashboardView.vue         # Deployment list + search/filter + import/export
│   │   ├── DeploymentFormView.vue    # Create/edit form (create & edit mode)
│   │   ├── DeploymentDetailView.vue  # Read-only detail + export/delete actions
│   │   ├── DeployView.vue            # Workflow execution screen
│   │   ├── ReleaseToolView.vue       # Launch card for Orchestrix Release Tool (opens in browser)
│   │   ├── DevtoolsView.vue          # Full-height iframe for Devtools+
│   │   └── SettingsView.vue          # Settings placeholder
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.vue          # Root layout; sidebar + router-view
│   │   │   └── Sidebar.vue           # Nav: Deployments · Release Tool · Devtools+ · Settings
│   │   ├── deployments/
│   │   │   ├── DeploymentCard.vue
│   │   │   ├── DeploymentForm.vue    # Form with multi-service management
│   │   │   └── DeploymentContextMenu.vue
│   │   ├── deploy/
│   │   │   ├── StepList.vue          # Global + per-service step groups
│   │   │   ├── StepItem.vue
│   │   │   └── TerminalPanel.vue
│   │   └── ui/
│   │       ├── ConfirmDialog.vue
│   │       ├── ImportCollisionDialog.vue  # UUID collision resolution on import
│   │       ├── ServiceSelectDialog.vue    # Service selection before multi-service deploy
│   │       ├── BaseButton.vue
│   │       ├── BaseInput.vue
│   │       └── TagBadge.vue
│   ├── composables/
│   │   ├── useSSH.ts                 # SSH/SCP execution; sshpass/plink detection
│   │   ├── useDeployRunner.ts        # Step orchestration; per-service loop; output polling
│   │   └── useFileDialog.ts          # Neutralino file open/save dialog wrappers
│   ├── types/
│   │   └── deployment.ts             # Service, Deployment, AuthMethod, StepStatus, DeploySession, ExportBundle, AppSettings
│   ├── utils/
│   │   ├── crypto.ts                 # AES-GCM 256 password encryption (Web Crypto + PBKDF2)
│   │   ├── exportImport.ts           # Zod validation; legacy single-service migration
│   │   └── pathUtils.ts              # Remote path construction helpers
│   └── assets/
│       └── main.css                  # Tailwind v4 entry
```

---

## 5. SSH Command Execution

NeutralinoJS does not ship a native SSH library. All remote operations are executed via `Neutralino.os.execCommand()`, which spawns the system's SSH/SCP binaries.

### 5.1 Authentication Variants

| Method | Command flag |
|---|---|
| SSH key | `-i <privateKeyPath> -o StrictHostKeyChecking=no` |
| Password (Linux/macOS) | `sshpass -p <password> ssh …` (requires `sshpass`) |
| Password (Windows) | `plink -pw <password> …` (requires PuTTY `plink`) |

The `settings` store checks for `sshpass` (Unix) and `plink` (Windows) availability at startup and surfaces a warning if password-auth deployments exist but the required binary is missing.

### 5.2 Live Output Streaming

`Neutralino.os.execCommand` returns only when the process exits (no native streaming). To simulate live output:

1. Redirect stdout/stderr to a temp file: `ssh … "cmd" > /tmp/hdg-<uuid>.log 2>&1 &`
2. Poll the temp file with `Neutralino.filesystem.readFile` every 200 ms, appending new content to the terminal panel.
3. On process exit, do a final read and clean up.

`useDeployRunner` encapsulates this pattern.

### 5.3 Error Handling

- Non-zero exit code → step marked **Error**, sequence halts (in full-deploy mode).
- SSH connection timeout → surface human-readable message.
- `sshpass` / `plink` missing + password auth → block execution with actionable error.

---

## 6. Data Persistence

All deployment configurations are stored locally via `Neutralino.storage` (persists to `~/.config/hot-deploy-gui/` on Linux/macOS, `%APPDATA%\hot-deploy-gui\` on Windows).

### 6.1 Storage Keys

| Key | Contents |
|---|---|
| `deployments` | `Deployment[]` — full array, written on every mutation |
| `appSettings` | `AppSettings` — global preferences (theme, default SSH port, etc.) |

### 6.2 Password Storage

Passwords are encrypted with **AES-GCM 256** using the Web Crypto API before being written to disk. The encryption key is derived from a machine-specific identifier via PBKDF2. This is obfuscation against casual file inspection, not multi-user key management.

---

## 7. Import / Export Schema

```jsonc
{
  "version": "1",
  "exportedAt": "2025-01-01T00:00:00Z",
  "deployments": [
    {
      "id": "uuid-v4",
      "name": "Production — Auth Service",
      "host": "192.168.1.10",
      "username": "deploy",
      "authMethod": "key",
      "privateKeyPath": "/home/user/.ssh/id_rsa",
      "sshPort": 22,
      "remoteDeployPath": "/opt/my-app/temp/services",
      "remoteLogPath": "/opt/my-app/logs",
      "services": [
        {
          "name": "auth-service",
          "localJarPath": "/home/user/builds/auth-service.jar",
          "startCommand": "nohup java -jar /opt/my-app/temp/services/auth-service/auth-service.jar > /var/log/auth-service.log 2>&1 &"
        }
      ],
      "tags": ["production", "auth"],
      "description": "",
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-01T00:00:00Z"
      // password field is intentionally absent
    }
  ]
}
```

Legacy single-service exports (using top-level `serviceName` / `localJarPath` / `startCommand`) are automatically migrated to the `services` array on import.

Schema validation uses **zod** on import, with user-visible field-level error messages.

---

## 8. UI / Design System

### 8.1 Design Direction

**Professional tooling aesthetic** — dark-first, high information density, utilitarian precision. Think VS Code meets linear.app. Clean geometric structure, no decorative flourishes. Every element earns its space.

### 8.2 Colour Tokens (Tailwind v4 CSS variables)

```css
@theme {
  --color-primary-50:  #eef2ff;
  --color-primary-500: #6366f1;  /* indigo-500 */
  --color-primary-600: #4f46e5;
  --color-primary-700: #4338ca;

  --color-surface-0:   #09090b;  /* bg base */
  --color-surface-1:   #18181b;  /* card */
  --color-surface-2:   #27272a;  /* input, elevated */
  --color-surface-3:   #3f3f46;  /* border, divider */

  --color-text-primary:   #fafafa;
  --color-text-secondary: #a1a1aa;
  --color-text-muted:     #71717a;

  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-error:   #ef4444;
  --color-info:    #38bdf8;
}
```

### 8.3 Typography

- **Font:** Roboto (loaded via Google Fonts or bundled)
- `text-xs` (10–11px) — terminal output, metadata labels
- `text-sm` (13–14px) — body, form labels, table rows
- `text-base` (15–16px) — card titles, section headers
- `text-lg / text-xl` — page headings

### 8.4 Layout

```
┌──────────────────────────────────────────────────────┐
│  Sidebar (240px, fixed)   │  Main Content (flex-1)   │
│  ─────────────────────    │                          │
│  App logo + name          │  [View-specific content] │
│  ─────────────────────    │                          │
│  Nav: ⚡ Deployments      │                          │
│       🔖 Release Tool     │                          │
│       🛠 Devtools+        │                          │
│       ⚙  Settings         │                          │
│  ─────────────────────    │                          │
│  [footer: app version]    │                          │
└──────────────────────────────────────────────────────┘
```

### 8.5 Key Component Patterns

- **Home Page:** Deployments display in grid/list layout with search and tag filter.
- **Deployment Card:** 1-line name, 2-line host+path summary, auth-method badge, tag chips, hover-reveal context-menu (⋯)
- **Step Item:** Left-side status icon with animated spinner (running state), step name, elapsed time right-aligned, chevron to expand terminal output. Steps are grouped by service name in multi-service sessions.
- **Terminal Panel:** `bg-surface-0`, monospaced `text-xs`, ANSI colours via `ansi-to-html`, max-height with scroll, "Copy output" button.
- **Form:** Multi-service editor with add/remove service rows. Two-column grid on wider views, single-column on narrow, inline validation errors, SSH auth method toggle that conditionally shows key path vs. password field.

---

## 9. Routing

| Path | View | Notes |
|---|---|---|
| `/` | `DashboardView` | Deployment list |
| `/deployments/new` | `DeploymentFormView` | Create mode |
| `/deployments/:id` | `DeploymentDetailView` | Read-only detail |
| `/deployments/:id/edit` | `DeploymentFormView` | Edit mode |
| `/deployments/:id/deploy` | `DeployView` | Workflow execution |
| `/settings` | `SettingsView` | App settings (placeholder) |
| `/release-tool` | `ReleaseToolView` | Launch card → opens in system browser |
| `/devtools` | `DevtoolsView` | Embedded iframe |

---

## 10. Key Dependencies

| Package | Version | Purpose |
|---|---|---|
| `@neutralinojs/lib` | ^6.5.0 | Desktop API (filesystem, OS exec, dialogs, storage) |
| `vue` | ^3.5 | UI framework |
| `pinia` | ^3.0 | State management |
| `vue-router` | ^5.0 | Routing |
| `zod` | ^4.3 | Runtime schema validation (import) |
| `ansi-to-html` | ^0.7 | Render ANSI codes in terminal panel |
| `uuid` | ^13.0 | UUID v4 generation |
| `tailwindcss` | ^4.2 | Styling |
| `@vueuse/core` | ^14.2 | Composable utilities |

---

## 11. Out of Scope (v1.0)

- Multi-file deployments (config files, scripts alongside JAR)
- Deployment history / audit log
- Scheduled / automated deploys
- Remote log tailing post-deploy
- Multi-hop SSH (jump hosts / bastion)
- Team sync / cloud-hosted config store

> **Note:** Multi-service deployments were originally listed as out-of-scope but have been implemented. See §2.2 and §3.3.

---

## 12. Development Milestones

| Milestone | Status | Deliverables |
|---|---|---|
| **M1 — Foundation** | ✅ Done | NeutralinoJS + Vue + TS + Tailwind scaffold; routing; Pinia stores wired to Neutralino.storage; design tokens |
| **M2 — CRUD** | ✅ Done | Deployment form (create/edit/clone/delete); card list; detail view; multi-service editor |
| **M3 — Import/Export** | ✅ Done | JSON export (single + all); JSON import with collision dialog; zod validation; legacy format migration |
| **M4 — Deploy Workflow** | ✅ Done | SSH composable; step runner; both trigger modes; terminal panel with polling; multi-service step groups; service selection dialog |
| **M5 — Polish** | ✅ Done | Error states; empty states; sshpass/plink detection; settings store; integrated tools (Release Tool, Devtools+) |
