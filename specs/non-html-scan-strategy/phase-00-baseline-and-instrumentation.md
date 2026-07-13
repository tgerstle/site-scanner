# Phase 0 — Baseline & Instrumentation (Living Spec)

Status: Planned  
Depends on: none

## Goal

Create measurable baseline signals before behavior changes so each later phase can prove improvement in usability and correctness.

---

## Scope

- Add baseline query scripts and expected metrics definitions.
- No runtime behavior changes.
- No plugin gating changes.

---

## Baseline metrics to collect

Per run:

- `discovered_total` = total queue rows
- `non_html_by_extension` = count by known extension classes
- `failed_non_html_estimate` = failed queue rows where URL likely non-HTML
- `results_total` = number of persisted results rows
- `a11y_findings_total`
- `performance_findings_total`

### SQL probes (sample)

```sql
SELECT COUNT(*) AS discovered_total
FROM queue
WHERE run_id = ?;

SELECT
  CASE
    WHEN lower(url) GLOB '*.pdf*' THEN 'pdf'
    WHEN lower(url) GLOB '*.png*' OR lower(url) GLOB '*.jpg*' OR lower(url) GLOB '*.jpeg*' OR lower(url) GLOB '*.gif*' OR lower(url) GLOB '*.webp*' THEN 'image'
    WHEN lower(url) GLOB '*.mp4*' OR lower(url) GLOB '*.webm*' THEN 'video'
    ELSE 'other'
  END AS class,
  COUNT(*) AS count
FROM queue
WHERE run_id = ?
GROUP BY class;
```

---

## Files to touch (spec only, future implementation)

- `scripts/` (add non-html baseline measurement scripts)
- optional dashboard probe endpoint for internal diagnostics:
  - `apps/web/src/pages/api/dashboard/stats.ts`
  - `apps/web/src/lib/queries.ts`

---

## Tests / validation

Manual validation:

- Run a known mixed-content site scan.
- Capture baseline values to snapshot file in `specs/non-html-scan-strategy/baselines/`.

Automated checks (future):

- Add `vitest` test that computes baseline classification counts from fixture data.

Commands:

- `npm run test`
- `npm run test:e2e`

---

## Completion checklist

- [ ] Baseline SQL probes documented and repeatable
- [ ] At least 3 representative run snapshots recorded
- [ ] Baseline report committed in spec folder

---

## Living change log

### 2026-07-10

- Initial phase spec authored.
