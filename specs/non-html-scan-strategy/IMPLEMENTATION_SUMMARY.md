# Two-Track Non-HTML Scanning Architecture — Implementation Summary

**Status:** ✅ Complete and Production-Ready  
**Test Coverage:** 21/21 tests passing  
**Implementation Timeline:** 5 phases across multiple sessions

---

## Architecture Overview

### Core Innovation

The scanner now supports a **two-track resource discovery and audit model**:

**Track A: Discovery/Inventory**

- All discovered URLs classified by resource type
- Metadata persisted to queue: `resource_type`, `audit_disposition`, `skip_reason`
- Non-HTML resources tracked for partial audits (documents) or skip recording

**Track B: Audit/Execution**

- Early gating: Non-auditable resources skipped before plugin phase
- Document lane: Compatible resources (PDFs, etc.) get targeted audits
- HTML lane: All HTML treated as full browser audits (legacy behavior)

### Feature Flag: Safe Gradual Rollout

```ts
nonHtmlPolicy: {
  enabled: false; // Default: legacy mode only
}
```

**When disabled (default):** Zero impact, system operates exactly like before  
**When enabled:** Two-track model fully active with resource classification and gating

---

## Implementation Phases

### Phase 0: Baseline & Instrumentation ✅

- Queue schema extended with resource/disposition columns
- Migration idempotency validated in connection.ts
- Tests established for Phase 1-5 validation

### Phase 1: Resource Triage & Queue Metadata ✅

- `triageResource()` function classifies URLs by extension
- Resource type assignment: html, document, media, binary, unknown
- Audit disposition: auditable_html, auditable_document, inventory_only, skip
- Integration in CLI sitemap/crawl flows and discovery-worker

### Phase 2: Audit Gating & Plugin Compatibility ✅

- Early exit in audit-worker for non-auditable resources
- Document resources skip plugin phase when disposition = auditable_document
- Plugin resolver filters compatible plugins by target resource type
- Zero impact on HTML audits when feature disabled

### Phase 3: Reporting & UI Metrics Split ✅

- Query layer separation: `getStats()`, `getRunDetails()`
- New types: `RunSpecificStats`, `PageSummary`
- Export datasets: `ResourceInventoryRow`, `AuditTargetSummaryRow`
- Enables separate reporting for inventory vs audit phases

### Phase 4: Document Audit Lane ✅

- `DocumentAuditContext` type for non-browser audit operations
- Config support: `nonHtmlPolicy.auditDocuments`, `auditHtmlOnly`
- Plugin filtering by target type (document, media, html)
- Worker execution branching for document vs HTML audits

### Phase 5: Hardening, Migration & Ops ✅

- Feature flag: `nonHtmlPolicy.enabled` (default: false)
- Backfill script: Migrate legacy DB rows with resource classifications
- Monitoring: `logRunMetrics()` at run completion
- Conditional execution in all worker/CLI paths

---

## Key Implementation Files

### Schema & Types

**[packages/types/src/cascading/config.ts](packages/types/src/cascading/config.ts)**

- NonHtmlPolicySchema: Defines `enabled`, `auditHtmlOnly`, `auditDocuments`
- Feature flag controls behavior of entire two-track system

**[packages/db/src/schema.sql](packages/db/src/schema.sql)**

- Queue table extended with: `resource_type`, `audit_disposition`, `skip_reason`
- Columns optional (DEFAULT NULL) for backward compatibility

### Core Logic

**[packages/core/src/resource-triage.ts](packages/core/src/resource-triage.ts)**

- `triageResource(url)`: Returns `{resourceType, auditDisposition, skipReason}`
- Extension-based classification (pdf→document, jpg→media, etc.)
- `isTwoTrackModeEnabled(config)`: Feature flag check helper

**[packages/core/src/discovery-worker.ts](packages/core/src/discovery-worker.ts)**

- Conditional triage when adding discovered links
- When flag disabled: uses default metadata (safe legacy behavior)
- When flag enabled: applies full classification

**[packages/core/src/audit-worker.ts](packages/core/src/audit-worker.ts)**

- Feature flag check at processJob() entry
- When disabled: reverts to legacy (treats all as auditable_html)
- When enabled: applies disposition-based gating
- Document resources skip plugin phase, use DocumentAuditContext instead

**[packages/core/src/logger.ts](packages/core/src/logger.ts)**

- `logRunMetrics(db, runId)`: Computes operational breakdown
- Metrics: discovered (by type), audited (success/failure), skipped_non_html

### CLI & Scripts

**[packages/cli/src/index.ts](packages/cli/src/index.ts)**

- Feature flag check at run start
- Conditional triage in sitemap and crawl seed paths
- Calls `logRunMetrics()` at run completion

**[scripts/backfill-non-html-metadata.ts](scripts/backfill-non-html-metadata.ts)**

- Migrates legacy queue rows with NULL resource_type
- CLI args: `--db-path`, `--dry-run`, `-v` (verbose)
- Transactional batching, validation report, tallies by type

**[packages/db/src/connection.ts](packages/db/src/connection.ts)**

- Migration idempotency: Column additions use `IF NOT EXISTS`
- Safe for multiple runs, no errors on existing columns

---

## Deployment Path

### 1. Safe Baseline (Release N)

- Deploy code with `nonHtmlPolicy.enabled: false`
- No behavior changes, feature gates disabled
- Verify clean startup on existing databases
- All metrics/logging inactive until enabled

### 2. Data Migration (Release N + local ops)

```bash
# Test migration
npx ts-node scripts/backfill-non-html-metadata.ts --db-path data/awa.sqlite --dry-run -v

# Expected output shows resource distribution for verification
# Apply migration
npx ts-node scripts/backfill-non-html-metadata.ts --db-path data/awa.sqlite
```

### 3. Gradual Rollout (Release N+1 config)

- Operator enables: `nonHtmlPolicy.enabled: true`
- Start with single test site
- Monitor run_metrics logs for discovery/audit breakdown
- Expand to more sites as confidence increases
- Global enable once validated

### 4. Emergency Rollback (Any time)

- Set `nonHtmlPolicy.enabled: false`
- Restart scanner
- All new runs revert to legacy immediately
- No code redeploy required

---

## Backward Compatibility Guarantee

### When Feature Disabled (`enabled: false`)

```
Discovery: All URLs get {resourceType: "unknown", auditDisposition: "deferred"}
  → Same as legacy behavior (metadata ignored)

Audit: All resources treated as auditable_html
  → Every URL runs through full plugin phase
  → Document/Media resources audited as if HTML (safe default)

Metrics: Not logged
  → No operational overhead from feature flag
```

### When Feature Enabled (`enabled: true`)

```
Discovery: URLs classified by extension
  → resource_type: html, document, media, binary, unknown
  → audit_disposition: auditable_html, auditable_document, inventory_only, skip
  → skip_reason: detailed reason for skip

Audit: Early gating by disposition
  → auditable_html: Full browser audit
  → auditable_document: Document audit lane (if enabled)
  → inventory_only/skip: Mark completed without plugins

Metrics: Comprehensive logging at run end
  → run_metrics event with splits by type and status
```

---

## Feature Flag Behavior Matrix

| Scenario               | enabled: false     | enabled: true                |
| ---------------------- | ------------------ | ---------------------------- |
| **DB migration**       | Not required       | Backfill pre-recommended     |
| **URL classification** | No (all "unknown") | Yes (by extension)           |
| **Audit gating**       | No (audit all)     | Yes (skip non-auditable)     |
| **Document lane**      | Disabled           | Respects auditDocuments flag |
| **Metrics logging**    | None               | Full breakdown at run end    |
| **New runs**           | Legacy behavior    | Two-track model active       |
| **Existing data**      | Unchanged          | Not affected until enabled   |
| **Rollback**           | N/A                | Instant (set enabled=false)  |

---

## Test Coverage (21/21 Passing)

### Phase 1-2: Resource Triage + Gating (10 tests)

- URL classification by extension
- Queue metadata persistence
- Plugin compatibility filtering
- Audit gating by disposition

### Phase 3: Metrics & Reporting (5 tests)

- Stats query layer separation
- Export dataset formats
- RunSpecificStats computation
- PageSummary aggregation

### Phase 4: Document Audit Lane (6 tests)

- Document audit context creation
- Document plugin execution
- DocumentAuditContext absence of page property
- Document skip when disabled

**All tests pass with:**

```bash
npm run test
```

---

## Monitoring & Observability

### Run Completion Metrics

Every run logs operational breakdown:

```json
{
  "type": "run_metrics",
  "run_id": "uuid",
  "discovered": {
    "total": 523,
    "html": 312,
    "documents": 87,
    "media": 89,
    "binary": 23,
    "unknown": 12
  },
  "audited": {
    "completed": 310,
    "failed": 2,
    "document_completed": 87
  },
  "skipped": {
    "non_html": 122
  }
}
```

### Metrics Interpretation

- **discovered.total:** Full inventory scope
- **discovered.[type]:** Resource breakdown
- **audited.completed:** Successful audits
- **audited.failed:** Failed audit attempts
- **audited.document_completed:** Document lane successes
- **skipped.non_html:** Pre-plugin gating efficiency

### Operational Insights

- Resource distribution shows audit workload
- Document lane throughput validates document audit strategy
- Skip ratios demonstrate gating efficiency
- Failed count alerts to audit issues

---

## Configuration Reference

### Config Schema (Full)

```ts
scanner_config: {
  siteUrl: "https://example.com",

  nonHtmlPolicy: {
    // Feature flag for two-track model (default: false)
    enabled: boolean;

    // When true: HTML-only audits (no document lane)
    // Default: false (allow document audits if enabled)
    auditHtmlOnly?: boolean;

    // When true: Run document audits if enabled + document lane active
    // Default: false
    auditDocuments?: boolean;
  },

  // ... other config fields
}
```

### Example Configs

**Legacy mode (default):**

```yaml
nonHtmlPolicy:
  enabled: false
  # Feature completely inactive
```

**Two-track with HTML only:**

```yaml
nonHtmlPolicy:
  enabled: true
  auditHtmlOnly: true # No document lane
  auditDocuments: false
```

**Two-track with document lane:**

```yaml
nonHtmlPolicy:
  enabled: true
  auditHtmlOnly: false # Allow HTML + document audits
  auditDocuments: true
```

---

## Production Checklist

### Before Enabling Feature

- [ ] All 21 tests passing
- [ ] Backfill script tested with `--dry-run`
- [ ] Resource classifications validated
- [ ] No regressions in legacy mode (feature disabled)
- [ ] Monitoring/logging tested on staging
- [ ] Team trained on metrics interpretation
- [ ] Rollback procedure verified

### During Rollout

- [ ] Start with single test site
- [ ] Monitor first full scan cycle
- [ ] Verify metrics breakdown makes sense
- [ ] Check error logs for unexpected issues
- [ ] Gradually expand to more sites
- [ ] Document any site-specific behaviors

### Operational Support

- [ ] Run_metrics logs checked regularly
- [ ] Backfill script available for new deployments
- [ ] Feature flag toggle documented in runbooks
- [ ] Rollback steps clear to on-call team

---

## Quick Reference

### Enable Feature

```yaml
nonHtmlPolicy:
  enabled: true
  auditDocuments: true
```

### Disable Feature (Emergency)

```yaml
nonHtmlPolicy:
  enabled: false
```

### Backfill Existing DB

```bash
npx ts-node scripts/backfill-non-html-metadata.ts --db-path data/awa.sqlite --dry-run -v
npx ts-node scripts/backfill-non-html-metadata.ts --db-path data/awa.sqlite
```

### Run Tests

```bash
npm run test
```

### Check Metrics

Monitor logs for `run_metrics` events at scan completion.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Two-Track Non-HTML Scanning Architecture                 │
└─────────────────────────────────────────────────────────┘

          Feature Flag (nonHtmlPolicy.enabled)
                        │
         ┌──────────────┴──────────────┐
         │                             │
    false (legacy)              true (two-track)
         │                             │
         │                        Discovery
         │                        [Phase 1]
         │                             │
         │                      Resource Triage
         │                    {type, disposition}
         │                             │
         │                        Queue Metadata
         │                             │
         │                     ┌───────┴────────┐
         │                     │                │
         │              CLI Conditional      Discovery Worker
         │              Triage [imported]    Conditional Triage
         │                     │                │
         ├─────────────────────┴────────────────┤
         │                                      │
      Queue with metadata        [same as before]
         │
         │           Audit Worker
         │        [Phase 2: Gating]
         │
         ├─── enabled: false ────────────────┐
         │                                   │
         ├─style to legacy:────────┬────────┤
         │ treat all as            │         │
         │ auditable_html          │         │
         │                         │         │
         └─────────────────────────┴─────────┼─→ Plugins [HTML]
                                             │
                                        [no skip]
         ├─── enabled: true ──────────────────┐
         │                                     │
         ├─ Gating by disposition:      ┌─────┴─────┐
         │ skip non-auditable      HTML │  Document │
         │                              │           │
         │                         [Plugins]  [Doc Lane]
         │                           │       [Plugin filter]
         │                           │          │
         │                           ▼          ▼
         │                    Run HTML plugins   Run doc plugins
         │
         ├─ Metrics logging   [Phase 5]
         │                         │
         └──────────────┬──────────┘
                        │
                   run_metrics event
                {discovered, audited, skipped}
```

---

## Common Issues & Troubleshooting

### Issue: Tests failing after Phase 5 changes

**Solution:** Ensure test configs include `nonHtmlPolicy: {enabled: true}` if testing two-track behavior

### Issue: Feature not activating

**Solution:**

1. Verify config has `nonHtmlPolicy.enabled: true`
2. Check config is being loaded correctly
3. Run test with verbose logging to confirm flag check

### Issue: Backfill script errors

**Solution:**

1. Run with `--dry-run` first to validate
2. Check database is readable/writable
3. Verify DB path is correct
4. Review error logs for specific rows causing issues

### Issue: Emergency rollback needed

**Solution:**

```yaml
nonHtmlPolicy:
  enabled: false # Set this to false
```

Restart scanner. All new runs immediately revert to legacy behavior.

---

## Next Steps

1. **Deploy Phase 1 (Safe Baseline):** Code with `enabled: false`
2. **Backfill when ready:** Run migration script
3. **Enable per-site:** Gradually activate feature in configs
4. **Monitor:** Watch run_metrics logs for feedback
5. **Optimize:** Adjust document lane settings based on results

---

## Contacts & Resources

- Phase specs: [specs/non-html-scan-strategy/](phases-01-to-05.md)
- Test coverage: `npm run test`
- Metrics logging: Watch console/logs for `run_metrics` events
- Emergency support: Toggle `enabled: false` in config, restart
