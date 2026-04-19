# Hot Deploy GUI

A cross-platform desktop application for managing and executing Java service deployments and remote server controls over SSH. Built with NeutralinoJS, Vue 3, and Tailwind CSS.

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

## 🌟 Key Features

### 🚀 Deployments (Classic)
- **Saved Profiles**: Store SSH credentials, remote paths, and service metadata locally with encrypted passwords.
- **Multi-service Orchestration**: Deploy multiple JARs in a single workflow with per-service configuration.
- **Step-by-step Execution**: Run the full pipeline automatically or execute individual steps manually.
- **Live Terminal Output**: Real-time ANSI-colored streaming output for every deployment stage.

### 🛡️ Server Controls & Hot Deploy
- **Service Management**: Monitor and control services on target servers with dedicated override settings.
- **Advanced Hot Deploy**: Execute custom **Pre-commands** and **Post-commands** hooks around your deployment.
- **Remote Fetch (wget)**: Deploy directly from remote URLs; the server fetches the package via `wget`, bypassing local upload.
- **Safe Replacement**: Atomic "Transfer → Cleanup → Rename" logic ensure clean replacement of existing artifacts.

### ⚙️ Core Capabilities
- **Wildcard Path Resolution**: Support for glob patterns in deployment paths, resolved to the newest match at runtime.
- **Unified Import/Export**: Backup and share complete configurations (Deployments + Controls) as JSON with ID collision resolution.
- **Flexible SSH Auth**: Native support for SSH keys, `sshpass`, PuTTY `plink`, or `SSH_ASKPASS` fallbacks.

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | [NeutralinoJS](https://neutralino.js.org/) v6.5 |
| UI Framework | Vue 3 + TypeScript |
| Store | Pinia |
| CSS | Tailwind CSS v4 |
| Validation | Zod |
| Rendering | `ansi-to-html` (XTerm-style parsing) |

## 🚀 Quick Start

If you have Node.js and NeutralinoJS CLI installed:

```bash
# 1. Install dependencies
cd src && npm install

# 2. Start Vite (keep this open)
npm run dev

# 3. Launch the app (from project root)
neu run
```

---

## 📖 Usage Guide

### 1. Classic Deployments
Ideal for complex, multi-component applications.
1. Click **+ New Deployment** on the dashboard.
2. Define your SSH connection and root deployment paths.
3. Add services, identifying their local JAR paths and start/stop commands.
4. Run the **⚡ Start Full Deployment** pipeline.

### 2. Server Controls & Hot Deploy
Ideal for rapid, targeted updates to single-package applications.
1. Navigate to **Controls** and add a new Server Control.
2. Configure **Hot Deploy Settings**:
   - **Local Package OR URL**: Path to your `.jar`/`.tgz` or a `http://` download link.
   - **Hooks**: Define sequential Pre and Post commands (e.g., `systemctl stop`, `ls -la`, etc.).
3. Use the **🚀 Deploy Package** button in the Control details view to trigger the sequence.

### 3. Backup & Sharing
Use the **Import** and **Export All** buttons on either management page to backup your workspace.
- **ID Collisions**: On import, you can choose to **Replace**, **Keep Both** (import as copy), or **Skip** conflicting entries.
- **Security**: Passwords are encrypted locally but omitted from exported JSON bundles by default for safety.

---

## ⚡ Deployment Logic

The app implements two distinct workflows:

### Deployment Pipeline (Deployments)
`Test Connection` → `Validate Path` → `Resolve Dir` → `Upload` → `Extract/Replace` → `Verify` → `Stop/Start`.

### Hot Deploy Sequence (Controls)
`Transfer (.tmp)` → `Cleanup (rm)` → `Finalize (mv)` → `Run Pre-Commands` → `Run Post-Commands`.

---

## 📂 Project Structure

```
hot-deploy-gui/
├── neutralino.config.json   # App metadata & API allowlist
├── src/
│   ├── src/
│   │   ├── stores/          # deployments, controls, session
│   │   ├── composables/     # useSSH, useDeployRunner, useControlRunner
│   │   ├── utils/           # crypto, pathUtils, exportImport
│   │   └── views/           # Dashboard, Controls, Settings
└── SPEC.md                  # Full technical specification
```

## 📜 License

[MIT](LICENSE)
