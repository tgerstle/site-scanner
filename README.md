# Adaptive Web Auditor (AWA)

This repository contains the Adaptive Web Auditor, a full-stack tool for scanning websites for accessibility, performance, and SEO issues. It includes both a **Web Dashboard** for visualizing results and a **Command Line Interface (CLI)** for headlessly orchestrating audits.

## Prerequisites

- Node.js (v18 or higher recommended)
- pnpm (required)

## Installation

1.  Clone the repository:

    ```bash
    git clone <repository-url>
    cd site-scanner
    ```

2.  Install dependencies (this handles all workspaces/packages automatically):

    ```bash
    pnpm install
    ```

3.  Build the workspace packages:
    ```bash
    pnpm build
    ```

> **Note:** The SQLite database is lazily initialized. The first time you start the web server or run a scan, a `data/awa.sqlite` database will be automatically created with all required tables.

## Web Dashboard

The Web Dashboard is an Astro + React frontend that lets you view scan logs, audit violations, and trigger exports.

### Run in Development Mode

To start the dashboard with hot-reloading:

```bash
pnpm dev
```

It will be available at `http://localhost:4321`.

### Run in Production (Preview) Mode

To simulate a fast production build:

```bash
pnpm build   # Make sure it's built first
pnpm start
```

## CLI Usage

You can run the CLI orchestrator to trigger scans and exports manually.

### 1. Development Mode (using `tsx`)

You can run the CLI directly from the source code without rebuilding the CLI package itself (though dependencies like `core` need to be built):

```bash
# Run from the root directory
pnpm tsx packages/cli/src/index.ts [command] [options]
```

### 2. Production Mode (using built files)

After building the project (`pnpm build`), you can run the compiled CLI:

```bash
# maintain executable permissions if needed
chmod +x packages/cli/dist/index.js

# Run the built CLI
node packages/cli/dist/index.js [command] [options]
```

## CLI Commands

The CLI tool is named `awa`.

### Start a Scan (`awa start`)

Starts a new audit run against a target website.

**Syntax:**

```bash
awa start [options]
```

**Options:**

- `-u, --url <url>`: The target URL to audit (overrides config).
- `-l, --list <urls>`: Comma-separated list of URLs to audit (audit only, no crawl).
- `-d, --depth <number>`: Maximum crawl depth (default: `3`).
- `-c, --config <path>`: Path to a configuration file (e.g., `awaconfig.json`).
- `-p, --plugins <plugins...>`: Specific plugins to run (space-separated).

**Examples:**

Run a basic scan:

```bash
pnpm tsx packages/cli/src/index.ts start -u https://example.com
```

Run a shallow scan (depth 1):

```bash
pnpm tsx packages/cli/src/index.ts start -u https://example.com -d 1
```

Run with specific plugins:

```bash
pnpm tsx packages/cli/src/index.ts start -u https://example.com -p axe lighthouse
```

### Resume a Run (`awa resume`)

Resumes an interrupted audit run.

**Syntax:**

```bash
awa resume --run-id <id>
```

**Options:**

- `--run-id <id>`: **(Required)** The unique identifier of the run to resume. You can find this ID in the logs or database.

**Example:**

```bash
pnpm tsx packages/cli/src/index.ts resume --run-id 12345
```

### Check Status (`awa status`)

View the progress of an ongoing run.

**Syntax:**

```bash
awa status --run-id <id>
```

**Options:**

- `--run-id <id>`: **(Required)** The ID of the run to check.

**Example:**

```bash
pnpm tsx packages/cli/src/index.ts status --run-id run_12345
```

### Stop a Run (`awa stop`)

Stop all active audit runs or a specific one.

**Syntax:**

```bash
awa stop [options]
```

**Options:**

- `--run-id <id>`: Stop a specific run ID.
- `--all`: Stop all running audits.

**Example:**

```bash
pnpm tsx packages/cli/src/index.ts stop --all
```

### Export Results (`awa export`)

Export audit results to XLSX or CSV (ZIP) format.

**Syntax:**

```bash
awa export --run-id <id> [options]
```

**Options:**

- `--run-id <id>`: **(Required)** The Run ID to export.
- `--format <format>`: Export format (`xlsx` or `csv`). Default: `xlsx`.
- `--output <file>`: Output file path. Defaults to stdout if not specified.

**Examples:**

```bash
# Export as XLSX to a file
pnpm tsx packages/cli/src/index.ts export --run-id run_12345 --output report.xlsx

# Export as CSV
pnpm tsx packages/cli/src/index.ts export --run-id run_12345 --format csv --output report.csv
```

### Reset Database (`awa reset`)

Reset the database (wipe all data). **Use with caution.**

**Syntax:**

```bash
awa reset [options]
```

**Options:**

- `-f, --force`: Force reset without confirmation.

**Example:**

```bash
pnpm tsx packages/cli/src/index.ts reset --force
```

## Configuration

### Environment Variables

- `AWA_DB_PATH`: Path to the SQLite database file. Defaults to `data/awa.sqlite` in the current working directory.

### Config File (`awaconfig.json`)

You can create a JSON configuration file to save your preferences.

**Example `awaconfig.json`:**

```json
{
  "siteUrl": []"https://example.com"],
  "maxDepth": 5,
  "plugins": ["axe", "lighthouse"]
}
```

Then run with:

```bash
pnpm tsx packages/cli/src/index.ts start -c awaconfig.json
```

## Scenario Handling (Interstitials & Modals)

The scanner includes a **Scenario System** to handle popups, modals, and cookie banners that often block accessibility scans.

### How it Works

Before any audit plugin runs, the scanner executes a cleanup script based on the URL.

1.  **Default Behavior**:
    - Presses the `Escape` key (twice).
    - Clicks generic "Close", "Dismiss", or "Reject All" buttons.
    - Handles common CMPs like OneTrust and Cookiebot.

2.  **Proprietary Scenarios**:
    - For complex sites (like `charlesandcolvard.com`), we run custom JavaScript to force-close specific widgets (e.g., Yotpo) and remove `aria-hidden` attributes from the `<body>` tag.

### Adding a New Scenario

To add custom logic for a new domain:

1.  Create a file in `packages/core/src/scenarios/proprietary/<domain>.ts`.
2.  Implement the `config` and `run` interface.
3.  Register it in `packages/core/src/scenarios/index.ts`.

## Repository Structure

This project is organized as a monorepo using **pnpm workspaces** and **Turborepo** for fast, incremental builds.

- `apps/web/`: The Astro + React frontend dashboard.
- `packages/cli/`: The command-line interface (`awa`).
- `packages/core/`: Orchestration, pipeline, and crawler workers.
- `packages/db/`: Database schemas, queries, and run management (SQLite).
- `packages/plugins/`: Audit plugins (Axe for a11y, Lighthouse for performance, custom SEO extractors).
- `packages/types/`: Shared TypeScript types used across packages.
