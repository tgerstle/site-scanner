# Adaptive Web Auditor (AWA) CLI

This repository contains the Adaptive Web Auditor, a tool for scanning websites for accessibility and performance issues. This guide explains how to use the Command Line Interface (CLI) to run audits.

## Prerequisites

- Node.js (v18 or higher recommended)
- npm (or yarn/pnpm)

## Installation

1.  Clone the repository:

    ```bash
    git clone <repository-url>
    cd scanner
    ```

2.  Install dependencies:

    ```bash
    npm install
    ```

3.  Build the packages:
    ```bash
    npm run build
    ```

## Usage

You can run the CLI in two ways: using `tsx` (recommended for development) or by running the built JavaScript files.

### 1. Development Mode (using `tsx`)

You can run the CLI directly from the source code without rebuilding the CLI package itself (though dependencies like `core` need to be built):

```bash
# Run from the root directory
npx tsx packages/cli/src/index.ts [command] [options]
```

### 2. Production Mode (using built files)

After building the project (`npm run build`), you can run the compiled CLI:

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
npx tsx packages/cli/src/index.ts start -u https://example.com
```

Run a shallow scan (depth 1):

```bash
npx tsx packages/cli/src/index.ts start -u https://example.com -d 1
```

Run with specific plugins:

```bash
npx tsx packages/cli/src/index.ts start -u https://example.com -p axe lighthouse
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
npx tsx packages/cli/src/index.ts resume --run-id 12345
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
npx tsx packages/cli/src/index.ts status --run-id run_12345
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
npx tsx packages/cli/src/index.ts stop --all
```

### Export Results (`awa export`)

Export audit results to JSON or CSV format.

**Syntax:**

```bash
awa export --run-id <id> [options]
```

**Options:**

- `--run-id <id>`: **(Required)** The Run ID to export.
- `--format <format>`: Export format (`json` or `csv`). Default: `json`.
- `--output <file>`: Output file path. Defaults to stdout if not specified.

**Examples:**

```bash
# Export as JSON to a file
npx tsx packages/cli/src/index.ts export --run-id run_12345 --output report.json

# Export as CSV
npx tsx packages/cli/src/index.ts export --run-id run_12345 --format csv --output report.csv
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
npx tsx packages/cli/src/index.ts reset --force
```

## Configuration

### Environment Variables

- `AWA_DB_PATH`: Path to the SQLite database file. Defaults to `data/awa.sqlite` in the current working directory.

### Config File (`awaconfig.json`)

You can create a JSON configuration file to save your preferences.

**Example `awaconfig.json`:**

```json
{
  "siteUrl": "https://example.com",
  "maxDepth": 5,
  "plugins": ["axe", "lighthouse"]
}
```

Then run with:

```bash
npx tsx packages/cli/src/index.ts start -c awaconfig.json
```
