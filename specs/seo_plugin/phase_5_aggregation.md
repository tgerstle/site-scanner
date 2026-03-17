# Phase 5: Aggregation & Scaled Insights

## Overview

This final phase shifts the scanner from analyzing individual pages to analyzing the entire site architecture. It identifies systemic SEO issues (e.g., template bugs) and aggregates findings across many URLs. The goal is to provide high-level insights for project leads/developers rather than just listing errors.

## Objectives

- [ ] **5.1 Template Analysis Logic**
  - Group URLs by path pattern (`/product/*`, `/blog/*`).
  - Compare Schema types across groups (e.g., "90% of products missing price").
- [ ] **5.2 Site-Wide Health Check**
  - Duplicate Title/Meta Description detection across the _entire scan_.
  - Canonical consistency check (Percentage of pages with `canonial != self`).
  - Social card readiness (Percentage missing `og:image`).
- [ ] **5.3 Schema Coverage Report**
  - Aggregate Schema Types found (`Product`, `Article`, `Organization`).
  - Visualize distribution (Pie/Bar chart data source).

## Technical Implementation

### Aggregation Queries

Run complex SQL queries against the `results` table (using `json_extract`).

**Example: Duplicate Titles**

```sql
SELECT json_extract(seo_result, '$.meta.title') as title, COUNT(*) as count
FROM results
WHERE run_id = ?
GROUP BY title
HAVING count > 1
ORDER BY count DESC;
```

**Example: Suggest Template Issue**

```sql
-- Identify pattern (e.g. /product/...) where Schema is missing commonly
SELECT
  path_pattern,
  COUNT(*) as total,
  SUM(CASE WHEN json_extract(seo_result, '$.jsonLd') IS NULL THEN 1 ELSE 0 END) as missing_schema
FROM (
  SELECT
    CASE
      WHEN url LIKE '%/product/%' THEN '/product/*'
      WHEN url LIKE '%/blog/%' THEN '/blog/*'
      ELSE 'other'
    END as path_pattern,
    seo_result
  FROM results
)
GROUP BY path_pattern;
```

### CLI Command

```bash
# Generate site-wide SEO report
npm run cli scan:report --run-id <ID> --type seo-aggregate
```

**Output (JSON):**

```json
{
  "duplicateTitles": [
    { "title": "Home", "count": 5, "urls": [...] }
  ],
  "schemaCoverage": {
    "Product": 50,
    "Article": 12,
    "Organization": 1
  },
  "templateIssues": [
    { "pattern": "/product/*", "issue": "Missing 'offers.priceCurrency' in 90% of pages" }
  ]
}
```

## Performance Checklist

- **Database Optimization**: Ensure `seo_result` column is properly indexed if possible (though JSON indexing in SQLite is tricky, consider extracted virtual columns for heavy aggregations).
- **Batch Processing**: For massive scans (10k+ pages), process aggregation in batches to avoid locking the DB.

## Testing Plan

1.  **Unit Test: Aggregation Logic**
    - Seed DB with mock scan results (5 pages with same title).
    - Run aggregator function.
    - Assert `duplicateTitles` contains expected entry with count 5.
2.  **Logic Test: Template Grouping**
    - Seed DB with varied URL patterns.
    - Verify grouping logic correctly buckets URLs into `/product/`, `/blog/`, etc.
