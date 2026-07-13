# Non-HTML Scan Strategy — Spec Index (Living)

Last Updated: 2026-07-11

## Documents

- [Findings](findings-2026-07-10.md)
- [Implementation Overview](implementation-overview.md)
- [Phase 00 — Baseline & Instrumentation](phase-00-baseline-and-instrumentation.md)
- [Phase 01 — Resource Triage & Queue Metadata](phase-01-resource-triage-and-queue-metadata.md)
- [Phase 02 — Audit Gating & Plugin Compatibility](phase-02-audit-gating-and-plugin-compatibility.md)
- [Phase 03 — Reporting & UI Metrics Split](phase-03-reporting-and-ui-metrics-split.md)
- [Phase 04 — Document Audit Lane](phase-04-document-audit-lane.md)
- [Phase 05 — Hardening, Migration & Ops](phase-05-hardening-migration-and-ops.md)

## Status board

| Phase | Status   | Ready to Start          | Blocking Dependencies |
| ----- | -------- | ----------------------- | --------------------- |
| 00    | Planned  | Yes                     | None                  |
| 01    | Complete | Completed and validated | 00                    |
| 02    | Complete | Completed and validated | 01                    |
| 03    | Complete | Completed and validated | 02                    |
| 04    | Complete | Completed and validated | 03                    |
| 05    | Planned  | Ready to start after 04 | 03/04                 |

## How to use this as a living plan

1. Move a phase status from `Planned` → `In Progress` when coding begins.
2. Update each phase checklist as tasks complete.
3. Append date-stamped entries in each phase change log.
4. Mark phase `Complete` only after acceptance tests pass.

## Validation command set (reference)

- `npm run test`
- `npm run test:unit`
- `npm run test:e2e`
- targeted `vitest run ...` commands listed in each phase doc
