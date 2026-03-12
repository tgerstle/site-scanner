# AWA Development Workflow

## 1. Core Philosophy

This document defines the standard operating procedure for developing the Adaptive Web Auditor (AWA). All development must adhere to a **TypeScript-first**, **Test-Driven (TDD)**, and **Monorepo-based** approach.

## 2. Technology Stack

- **Language**: Strict TypeScript (`"strict": true`)
- **Monorepo Tooling**: npm workspaces
- **Backend/Crawler**: Node.js, Playwright, `better-sqlite3`
- **Frontend**: Astro, React, Tailwind CSS
- **Testing**: Vitest
- **Linting & Formatting**: Biome

## 3. Project Structure (Monorepo)

```text
/awa-root
├── apps/
│   └── web/               # Astro + React + Tailwind frontend
├── packages/
│   ├── core/              # Orchestrator, worker lifecycle, plugins
│   ├── db/                # SQLite schema, queries, migrations
│   └── types/             # Shared TypeScript contracts
├── tests/
│   └── fixtures/          # Static HTML files for testing
├── biome.json             # Global linting/formatting rules
└── package.json           # Workspace root
```

## 4. Spec Writing Rules

Whenever a new feature or phase is planned, its specification must include:

1. **Checkboxes**: Every actionable item must have a `[ ]` checkbox.
2. **TypeScript Interfaces**: Define the data structures and contracts before writing implementation code.
3. **Code Examples**: Provide a minimal example of the core logic (e.g., a SQL query, a worker spawn command).
4. **Test Criteria**: Explicitly state what needs to be tested and how (e.g., "Test: Worker claims job atomically").

## 5. Development Process

1. **Review Spec**: Read the relevant section in `specs/phased_build.md`.
2. **Write Tests First (TDD)**: Create Vitest test files and define the expected behavior using fixtures or mocks.
3. **Implement**: Write the TypeScript code to make the tests pass.
4. **Lint & Format**: Run Biome to ensure code quality and consistent formatting.
5. **Mark Complete**: Update `specs/phased_build.md` by changing `[ ]` to `[x]` for completed steps.

## 6. Testing Strategy

- **Framework**: Vitest
- **Backend Tests**: Use isolated SQLite in-memory databases (`:memory:`) for database logic.
- **Crawler Tests**: Use local static HTML fixtures (e.g., `tests/fixtures/broken-structure.html`) to test Playwright interactions without relying on external networks.
- **Frontend Tests**: Component testing with Vitest and React Testing Library.
