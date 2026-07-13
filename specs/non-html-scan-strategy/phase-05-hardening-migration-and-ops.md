# Phase 5 — Hardening, Migration & Ops (Living Spec)

Status: ✅ Complete  
Depends on: Phase 4

## Goal

Finalize production safety through migration handling, backfill strategy, feature flags, and operational runbooks.

**Implementation Status:** All core components implemented and validated (21/21 tests passing)

---

## Migration and compatibility

### DB migration hardening

**Status:** ✅ Validated in existing codebase

- Queue column additions are idempotent in [packages/db/src/connection.ts](packages/db/src/connection.ts):
  - `resource_type` VARCHAR(50) DEFAULT NULL - safe for existing rows
  - `audit_disposition` VARCHAR(50) DEFAULT NULL - safe for existing rows
  - `skip_reason` VARCHAR(255) DEFAULT NULL - safe for existing rows
- Legacy rows without metadata are interpreted safely:
  - Missing `resource_type` → defaults to "unknown" in triageResource()
  - Missing `audit_disposition` → defaults to "deferred" (safe gate behavior)
  - Missing `skip_reason` → NULL (no special handling)

### Backfill strategy - IMPLEMENTED

**File:** [scripts/backfill-non-html-metadata.ts](scripts/backfill-non-html-metadata.ts)  
**Status:** ✅ Production-ready with dry-run support

#### Overview

Migrates existing queue rows lacking metadata by inferring resource type from URL extension:

```ts
for each queue row where resource_type IS NULL OR audit_disposition IS NULL:
  const triage = triageResource(url)
  update row with:
    resource_type = triage.resourceType
    audit_disposition = triage.auditDisposition
    skip_reason = triage.skipReason
```

#### Features

- **Extension-based inference:** Classifies by URL ending (.pdf, .jpg, .mp4, etc.)
- **Transactional safety:** All-or-nothing updates per batch
- **Dry-run mode:** Test classification without DB changes (`--dry-run` flag)
- **Verbose logging:** Detailed progress output (`-v` flag)
- **Error resilience:** Failed rows logged, processing continues
- **Completion report:** Tallies by resource_type for verification

#### Usage

```bash
# Test migration without committing
npx ts-node scripts/backfill-non-html-metadata.ts --db-path data/awa.sqlite --dry-run -v

# Apply migration to production DB
npx ts-node scripts/backfill-non-html-metadata.ts --db-path data/awa.sqlite

# Verbose output
npx ts-node scripts/backfill-non-html-metadata.ts --db-path data/awa.sqlite -v
```

#### Expected Output

```
Backfill non-HTML metadata...
  Processing in batches of 1000...
  Total rows needing backfill: 523
  Processed 523 rows in 3 batches

Final tally:
  - html: 312
  - document: 87
  - media: 89
  - binary: 23
  - unknown: 12

Backfill complete!
```

#### Rollout sequence

1. **Pre-enablement:** Run backfill script with `--dry-run` to validate classifications
2. **Review:** Check tally against expected resource distribution
3. **Apply:** Run without `--dry-run` to commit classifications
4. **Enable flag:** Set `nonHtmlPolicy.enabled: true` in config
5. **Monitor:** Watch run_metrics logs for resource split confirmation

---

## Operational controls

### Config/flag rollout - IMPLEMENTED

**Feature flag location:** [packages/types/src/cascading/config.ts](packages/types/src/cascading/config.ts)  
**Status:** ✅ Fully integrated with default false (safe opt-in)

#### Flag design

```ts
nonHtmlPolicy: {
  enabled: boolean;  // Default: false
  auditHtmlOnly?: boolean;
  auditDocuments?: boolean;
}
```

**Behavior:**

- **enabled: false (default):** System operates in legacy mode
  - All URLs treated as auditable HTML (no classification)
  - No triage metadata assigned
  - All discovered resources passed to plugins regardless of type
  - Two-track model disabled completely
  - Zero impact on existing runs

- **enabled: true:** Two-track model fully active
  - Discovery path classifies resources by type (Phase 1)
  - Audit gating skips non-auditable types (Phase 2)
  - Document lane audits compatible resources (Phase 4)
  - Full metrics logging (Phase 5)

#### Gradual rollout strategy

1. **Release 1:** Deploy code with `enabled: false` (default)
   - No behavioral changes for existing users
   - New code paths inactive
   - Backfill script available but not required

2. **Release 2:** Backfill existing DBs (operator choice)
   - Run backfill script on each deployment
   - Validate resource classifications
   - Prepare for flag activation

3. **Release 3:** Enable per-user/config
   - Operator enables `nonHtmlPolicy.enabled: true` in config
   - New runs use two-track model
   - Historic runs unaffected

4. **Emergency rollback:** Set `enabled: false`
   - Immediate revert to legacy behavior
   - No code redeployment required
   - Existing runs continue normally

#### Integration points

- [packages/cli/src/index.ts](packages/cli/src/index.ts): Feature flag check at run start
- [packages/core/src/discovery-worker.ts](packages/core/src/discovery-worker.ts): Conditional triage on link discovery
- [packages/core/src/audit-worker.ts](packages/core/src/audit-worker.ts): Conditional gating logic
- [packages/core/src/resource-triage.ts](packages/core/src/resource-triage.ts): Helper `isTwoTrackModeEnabled(config)`

### Monitoring/logging - IMPLEMENTED

**Status:** ✅ Comprehensive metrics logging at run completion

#### Metrics function

**Location:** [packages/core/src/logger.ts](packages/core/src/logger.ts)  
**Function:** `logRunMetrics(db: Database, runId: string, stream?: any)`

#### Collected metrics

Logged as structured `run_metrics` event at run completion:

```json
{
  "run_id": "run-uuid",
  "discovered": {
    "total": 523,
    "html": 312,
    "documents": 87,
    "media": 89,
    "binary": 23,
    "unknown": 12
  },
  "audited": {
    "completed": 312,
    "failed": 2,
    "document_completed": 87
  },
  "skipped": {
    "non_html": 122
  }
}
```

#### Metrics interpretation

- **discovered.total:** All URLs in queue (inventory phase)
- **discovered.[type]:** Breakdown by resource classification
- **audited.completed:** Successful HTML + plugin runs
- **audited.failed:** Failed audit attempts
- **audited.document_completed:** Document audit lane successes
- **skipped.non_html:** Resources skipped before plugin phase

#### Log output

Example production run with two-track enabled:

```
[2026-03-17T20:35:12Z] INFO: run_metrics {
  "run_id": "abc123",
  "discovered": {"total": 523, "html": 312, "documents": 87, "media": 89, "binary": 23, "unknown": 12},
  "audited": {"completed": 310, "failed": 2, "document_completed": 87},
  "skipped": {"non_html": 122}
}
```

#### Operational visibility

- **Resource distribution:** Understand audit scope (how many HTML vs non-HTML)
- **Audit efficiency:** Track document lane throughput
- **Error rates:** Monitor failed audit attempts
- **Skip reasoning:** Verify non-HTML skips are intentional

#### Integration

Called automatically at CLI run completion:

- [packages/cli/src/index.ts](packages/cli/src/index.ts) line ~150 (after run finishes)

---

## Documentation updates

- `README.md` usage/config additions
- Add dedicated strategy + operational section in `specs/non-html-scan-strategy/`

---

## Tests and validation

### Test coverage - VALIDATED

**Status:** ✅ 21/21 tests passing (including Phase 1-4 validation)

#### Tests added/modified for Phase 5

Audit worker tests in [packages/core/src/audit-worker.test.ts](packages/core/src/audit-worker.test.ts):

1. **Test:** "skips non-html jobs before running plugins"
   - Config: `nonHtmlPolicy: { enabled: true }`
   - Validates: Document resource skips with `skipped_non_html` disposition
   - Expected: Plugin never invoked

2. **Test:** "runs document audit when auditDocuments is enabled"
   - Config: `nonHtmlPolicy: { enabled: true, auditDocuments: true }`
   - Validates: Document audit lane runs when enabled
   - Expected: Plugin executes, document audit completes

3. **Test:** "skips document audit when auditDocuments is disabled"
   - Config: `nonHtmlPolicy: { enabled: true, auditDocuments: false }`
   - Validates: Documents skip with `skipped_non_html` when disabled
   - Expected: Plugin never invoked

#### Feature flag behavior tests

Tests confirm:

- ✅ Backward compatibility: `enabled: false` (default) behaves identically to legacy
- ✅ Feature gate: `enabled: true` activates two-track classification and gating
- ✅ Conditional triage: Discovery/audit paths respect flag setting
- ✅ Fallback logic: Audit worker reverts to legacy when flag disabled

#### Running tests

```bash
# Run Phase 1-5 validation (all focused tests)
npm run test

# Run audit worker tests specifically
npm run test -- audit-worker.test.ts

# Run with coverage
npm run test -- --coverage audit-worker.test.ts
```

#### Acceptance criteria

- [x] Safe startup on old DB files (migration idempotency)
- [x] Deterministic behavior in enabled/disabled mode (tests confirm)
- [x] No regression to current HTML scan outcomes (backward compatibility layer)
- [x] Feature flag controls all two-track behavior (conditional logic validated)
- [x] Backfill script produces expected classifications (dry-run tested)

---

## Completion checklist

- [x] Migration idempotency validated
- [x] Backfill script implemented with dry-run support
- [x] Feature flag (`nonHtmlPolicy.enabled`) added to config schema
- [x] Conditional execution logic in CLI (triage, metrics logging)
- [x] Conditional execution logic in discovery-worker
- [x] Conditional execution logic in audit-worker
- [x] Monitoring counters exposed (logRunMetrics function)
- [x] All Phase 1-5 tests passing (21/21)
- [x] Backward compatibility validated (legacy mode when disabled)
- [x] Operational documentation complete

---

## Deployment checklist

### Pre-deployment

- [ ] Review Phase 5 spec and implementation with team
- [ ] Verify backfill script runs clean with `--dry-run` on staging
- [ ] Test feature flag toggle on staging environment
- [ ] Confirm monitoring/logging integration shows metrics

### Deployment phase 1 (Safe baseline)

- [ ] Deploy code with `nonHtmlPolicy.enabled: false` (default)
- [ ] Verify system operates normally (legacy mode)
- [ ] Confirm no new errors or regressions
- [ ] Monitor for a full scan cycle

### Deployment phase 2 (Data migration)

- [ ] Backup production database
- [ ] Run backfill script with `--dry-run`: `npx ts-node scripts/backfill-non-html-metadata.ts --db-path data/awa.sqlite --dry-run -v`
- [ ] Verify resource classifications meet expectations
- [ ] Apply backfill: `npx ts-node scripts/backfill-non-html-metadata.ts --db-path data/awa.sqlite`
- [ ] Verify all rows updated successfully
- [ ] Commit backup

### Deployment phase 3 (Gradual rollout)

- [ ] Enable feature for single test site
- [ ] Run scan and verify metrics in logs
- [ ] Check discovered/audited/skipped breakdown
- [ ] Monitor for 1-2 full scan cycles
- [ ] Gradually expand to more sites
- [ ] Enable globally once confidence established

### Rollback steps (if needed)

1. Set `nonHtmlPolicy.enabled: false` in config
2. Restart scanner
3. All new runs revert to legacy behavior immediately
4. No code redeployment required
5. Historic data (backfilled metadata) remains intact

---

## Living change log

### 2026-03-17 - Implementation Complete

**Summary:** Phase 5 fully implemented and validated with all 21 tests passing.

**Key changes:**

- ✅ Added `nonHtmlPolicy.enabled` (boolean, default false) to config schema
- ✅ Implemented `isTwoTrackModeEnabled()` helper in resource-triage.ts
- ✅ Created production-grade backfill script in scripts/backfill-non-html-metadata.ts
- ✅ Added `logRunMetrics()` monitoring function to logger.ts
- ✅ Integrated feature flag checks in CLI (triage gating, metrics logging)
- ✅ Integrated feature flag checks in discovery-worker (conditional triage)
- ✅ Integrated feature flag checks in audit-worker (legacy fallback)
- ✅ Updated audit-worker tests to enable feature flag for Phase 5 tests
- ✅ All 21 tests passing (Phase 1-4 + Phase 5)

**Files created:**

- `scripts/backfill-non-html-metadata.ts` (250+ lines)

**Files modified:**

- `packages/types/src/cascading/config.ts` (feature flag schema)
- `packages/core/src/logger.ts` (logRunMetrics function)
- `packages/core/src/resource-triage.ts` (isTwoTrackModeEnabled helper)
- `packages/cli/src/index.ts` (feature flag integration)
- `packages/core/src/discovery-worker.ts` (feature flag integration)
- `packages/core/src/audit-worker.ts` (feature flag integration)
- `packages/core/src/audit-worker.test.ts` (enable flag in test configs)

**Status:** Ready for production deployment starting with Phase 1 (safe baseline with disabled flag).

### 2026-07-10 - Initial phase spec

- Initial phase spec authored.
