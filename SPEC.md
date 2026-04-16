# Hot Deploy GUI — Technical Specification

**Version:** 1.0.0  
**Stack:** NeutralinoJS · Vue 3 · TypeScript · Tailwind CSS v4  
**Design System:** Indigo primary · Surface secondary · Roboto font

---

## 1. Overview

Hot Deploy GUI is a cross-platform desktop application (Windows, macOS, Linux) that lets developers manage remote Java service deployments from a single, local UI. Each "deployment" is a saved configuration that encapsulates SSH connection details, local artifact path, remote target path, and service name. From that configuration, the app drives a deterministic, multi-step deploy workflow over SSH.

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
| `localJarPath` | `string` | Absolute local path to the `.jar` file |
| `remoteDeployPath` | `string` | Absolute remote path, e.g. `/opt/my-app/temp/services` |
| `remoteLogPath` | `string` | Absolute remote path, e.g. `/opt/my-app/logs` |
| `serviceName` | `string` | Name used to derive service folder and identify the running process |
| `startCommand` | `string` | Shell command to start the service after deploy, default is empty |
| `createdAt` | `string` (ISO 8601) | Creation timestamp |
| `updatedAt` | `string` (ISO 8601) | Last modification timestamp |
| `tags` | `string[]` | Optional user-defined labels for filtering |
| `description` | `string?` | Optional free-text notes |

**Derived values (not stored, computed at runtime):**
- `remoteServicePath` = `remoteDeployPath` + `/` + `serviceName`  
  e.g. `/opt/my-app/temp/services/my-service`
- support wildcard in `remoteDeployPath`
  e.g. `/opt/my-app/temp/services*`
- `remoteJarFilename` = basename of `localJarPath`
- `remoteServiceLogPath` = `remoteLogPath` + `/` + `serviceName` + `.log`
  e.g. `/opt/my-app/logs/my-service.log`
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
- **Import:** Accept a `.json` file. Parse, validate schema, detect UUID collisions (offer "replace" or "keep both" per record), then merge into local store. Passwords in imported files are treated as absent unless the user supplies the matching passphrase.

### 3.3 Deploy Workflow

The deploy workflow is a **linear sequence of steps**. Users may trigger it in two modes:

| Mode | Description |
|---|---|
| **One-click full deploy** | All steps run automatically in sequence. On any step failure, the sequence halts and surfaces the error. |
| **Manual step-by-step** | Each step has its own "Run" button. Steps are gated — a later step cannot start until all prior steps have succeeded. |

The app supports **both modes** simultaneously: a "Deploy All" button plus individual step controls on the same screen.

#### 3.3.1 Step Definitions

| # | Step Name | Command / Logic | Success Condition |
|---|---|---|---|
| 1 | **Test Connection** | `ssh -p <port> -o ConnectTimeout=5 <user>@<host> echo ok` | Exit code 0, stdout contains `ok` |
| 2 | **Validate Remote Path** | `ssh … "test -d <remoteDeployPath> && echo ok"` | Stdout contains `ok` |
| 3 | **Copy JAR** | `scp -P <port> <localJarPath> <user>@<host>:<remoteDeployPath>/` | Exit code 0 |
| 4 | **Extract JAR** | `ssh … "mkdir -p <remoteServicePath> && cd <remoteServicePath> && jar xf <remoteDeployPath>/<jarFilename>"` | Exit code 0 |
| 5 | **Find Running PID** | `ssh … "pgrep -f <remoteServicePath>"` | Exit code 0 and a PID is returned (or "not running" state noted — not a hard failure) |
| 6 | **Kill Service** | `ssh … "pkill -f <remoteServicePath>"` | Exit code 0, or 1 if no process found (treated as non-fatal warning) |
| 7 | **Start Service** | `ssh … "<startCommand>"` (runs detached via `nohup … &`) | Exit code 0 |

> Steps 5–7 are always executed (they are not skipped when PID is not found). Step 5 is informational; Step 6 is a no-op if nothing is running, and step 7 is a no-op if the start command is empty.

### 3.4 Output Display

Each step surfaces output via a **collapsible terminal panel underneath a step-status list**:

- **Step status list:** Icon-based indicators (idle / running / success / warning / error) with step name and elapsed time.
- **Terminal panel:** Live-streaming stdout + stderr from the underlying SSH/SCP command, rendered in a monospaced font with ANSI colour support. Collapsible per step; expandable to full-screen.
- Logs for a session are kept in memory and cleared when a new deploy session starts.

---

## 4. Application Architecture

```
hot-deploy-gui/
├── neutralino.config.json
├── src/
│   ├── main.ts                  # App entry point
│   ├── App.vue
│   ├── router/
│   │   └── index.ts             # Vue Router (hash mode for NeutralinoJS)
│   ├── stores/
│   │   ├── deployments.ts       # Pinia store — deployment CRUD + persistence
│   │   └── session.ts           # Pinia store — active deploy session state
│   ├── views/
│   │   ├── DashboardView.vue    # Deployment list + search/filter
│   │   ├── DeploymentFormView.vue
│   │   ├── DeploymentDetailView.vue
│   │   └── DeployView.vue       # Workflow execution screen
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.vue
│   │   │   └── Sidebar.vue
│   │   ├── deployments/
│   │   │   ├── DeploymentCard.vue
│   │   │   ├── DeploymentForm.vue
│   │   │   └── DeploymentContextMenu.vue
│   │   ├── deploy/
│   │   │   ├── StepList.vue
│   │   │   ├── StepItem.vue
│   │   │   └── TerminalPanel.vue
│   │   └── ui/
│   │       ├── ConfirmDialog.vue
│   │       ├── BaseButton.vue
│   │       ├── BaseInput.vue
│   │       └── TagBadge.vue
│   ├── composables/
│   │   ├── useSSH.ts            # SSH/SCP command execution via Neutralino.os.execCommand
│   │   ├── useDeployRunner.ts   # Orchestrates step execution and state
│   │   └── useFileDialog.ts     # Wraps Neutralino file open/save dialogs
│   ├── types/
│   │   └── deployment.ts        # TypeScript interfaces
│   ├── utils/
│   │   ├── crypto.ts            # Password encryption/decryption (AES-GCM via Web Crypto API)
│   │   ├── exportImport.ts      # JSON serialization and schema validation
│   │   └── pathUtils.ts         # Remote path construction helpers
│   └── assets/
│       └── main.css             # Tailwind v4 entry
```

---

## 5. SSH Command Execution

NeutralinoJS does not ship a native SSH library. All remote operations are executed via `Neutralino.os.execCommand()`, which spawns the system's SSH/SCP binaries.

### 5.1 Authentication Variants

| Method | Command flag |
|---|---|
| SSH key | `-i <privateKeyPath> -o StrictHostKeyChecking=no` |
| Password | Invoke `sshpass -p <password> ssh …` (requires `sshpass` to be installed on the host OS) |

The app will detect whether `sshpass` is available at startup and display a warning if password-auth deployments exist but `sshpass` is missing.

### 5.2 Live Output Streaming

`Neutralino.os.execCommand` currently returns only when the process exits (no native streaming). To simulate live output:

1. Redirect stdout/stderr to a temp file: `ssh … "cmd" > /tmp/hdg-<uuid>.log 2>&1 &`
2. Poll the temp file with `Neutralino.filesystem.readFile` every 200 ms, appending new content to the terminal panel.
3. On process exit, do a final read and clean up.

A `useDeployRunner` composable encapsulates this pattern.

### 5.3 Error Handling

- Non-zero exit code → step marked **Error**, sequence halts (in full-deploy mode).
- SSH connection timeout → surface human-readable message.
- `sshpass` missing + password auth → block execution with actionable error.

---

## 6. Data Persistence

All deployment configurations are stored locally in a JSON file managed by the app via `Neutralino.storage` (which persists to `~/.config/hot-deploy-gui/` on Linux/macOS, `%APPDATA%\hot-deploy-gui\` on Windows).

### 6.1 Storage Keys

| Key | Contents |
|---|---|
| `deployments` | `Deployment[]` — full array, written on every mutation |
| `appSettings` | `AppSettings` — global preferences (theme, default SSH port, etc.) |

### 6.2 Password Storage

Passwords are encrypted with **AES-GCM 256** using the Web Crypto API before being written to disk. The encryption key is derived from a machine-specific identifier (e.g. the Neutralino app token + a fixed app salt) via PBKDF2. This is not multi-user key management — it is obfuscation against casual file inspection.

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
      "localJarPath": "/home/user/builds/auth-service.jar",
      "remoteDeployPath": "/opt/my-app/temp/services",
      "serviceName": "auth-service",
      "startCommand": "nohup java -jar /opt/my-app/temp/services/auth-service/auth-service.jar > /var/log/auth-service.log 2>&1 &",
      "tags": ["production", "auth"],
      "description": "",
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-01T00:00:00Z"
      // password field is intentionally absent
    }
  ]
}
```

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
│  Nav: Deployments         │                          │
│       Settings            │                          │
│  ─────────────────────    │                          │
│  [footer: app version]    │                          │
└──────────────────────────────────────────────────────┘
```

### 8.5 Key Component Patterns
- **Home Page:** Deployments display in grid/list layout.
- **Deployment Card:** 1-line name, 2-line host+path summary, auth-method badge, tag chips, hover-reveal context-menu (⋯)
- **Step Item:** Left-side status icon with animated spinner (running state), step name, elapsed time right-aligned, chevron to expand terminal output
- **Terminal Panel:** `bg-surface-0`, monospaced `text-xs`, ANSI colours via a lightweight renderer (e.g. `ansi-to-html`), max-height with scroll, "Copy output" button
- **Form:** Two-column grid on wider views, single-column on narrow, inline validation errors, SSH auth method toggle that conditionally shows key path vs. password field

---

## 9. Routing

| Path | View | Notes |
|---|---|---|
| `/` | `DashboardView` | Deployment list |
| `/deployments/new` | `DeploymentFormView` | Create mode |
| `/deployments/:id` | `DeploymentDetailView` | Read-only detail |
| `/deployments/:id/edit` | `DeploymentFormView` | Edit mode |
| `/deployments/:id/deploy` | `DeployView` | Workflow execution |

---

## 10. Key Dependencies

| Package | Purpose |
|---|---|
| `neutralinojs/neutralino.js` | Desktop API (file system, OS exec, dialogs) |
| `vue@3` | UI framework |
| `pinia` | State management |
| `vue-router@4` | Routing |
| `zod` | Runtime schema validation (import) |
| `ansi-to-html` | Render ANSI codes in terminal panel |
| `uuid` | UUID v4 generation |
| `tailwindcss@4` | Styling |
| `@vueuse/core` | Composable utilities (useLocalStorage fallback, etc.) |

---

## 11. Out of Scope (v1.0)

The following are noted for potential future scope but are **not** included in this specification:

- Multi-services in one deployment (add `services` array to deployment, each `service` has `name`, `localJarPath`, `startCommand`, `stopCommand`)
- Multi-file deployments (config files, scripts alongside JAR) — architecture is extensible, field is `localJarPath` singular for now
- Deployment history / audit log
- Scheduled / automated deploys
- Remote log tailing post-deploy
- Multi-hop SSH (jump hosts / bastion)
- Team sync / cloud-hosted config store

---

## 12. Development Milestones

| Milestone | Deliverables |
|---|---|
| **M1 — Foundation** | NeutralinoJS + Vue + TS + Tailwind scaffold; routing; Pinia stores wired to Neutralino.storage; design tokens |
| **M2 — CRUD** | Deployment form (create/edit); card list; clone; delete; detail view |
| **M3 — Import/Export** | JSON export (single + all); JSON import with collision handling; zod validation |
| **M4 — Deploy Workflow** | SSH composable; step runner; both trigger modes; terminal panel with polling |
| **M5 — Polish** | Error states; empty states; keyboard navigation; OS-native dialogs; app icon + window chrome |