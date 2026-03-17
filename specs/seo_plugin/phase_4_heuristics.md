# Phase 4: Opportunities & Heuristics

## Overview

This phase adds intelligence to the scanner by suggesting schema enhancements based on content analysis. It moves beyond "Is this valid?" to "What _should_ be here?". Since heuristics can be noisy, this logic runs separately to avoid blocking the main crawl loop.

## Objectives

- [ ] **4.1 Content Analysis Service**
  - Implement pattern matching for:
    - Products (price pattern `$xx.xx` + "Add to Cart").
    - Articles (date pattern + byline).
    - Breadcrumbs (nested list pattern).
    - Recipes (ingredients list pattern).
- [ ] **4.2 Gap Discovery Engine**
  - Cross-reference found schemas against detected content types.
  - Report "Opportunity: Missing Product Schema" if product pattern matches but schema is absent.
- [ ] **4.3 CLI Command**
  - Add `seo:suggestions` command.

## Technical Implementation

### Heuristics Logic

This logic will rely on specific selectors and text content analysis:

```typescript
// Heuristics Example
interface SeoHeuristic {
  name: string; // e.g., 'Product Detection'
  selector: string; // e.g., 'button:has-text("Add to Cart")'
  requiredText?: RegExp; // e.g., /\$\d+\.\d{2}/
  suggestedSchema: string; // e.g., 'Product'
}
```

### Gap Reporting Structure

Add to `SeoResult`:

```typescript
interface SeoOpportunity {
  type: "missing_schema" | "content_gap";
  confidence: "high" | "medium" | "low";
  details: string; // e.g., "Found price and 'Add to Cart', missing Product schema."
  schemaType: string;
}
```

### CLI Command

```bash
# Analyze saved results for opportunities
npm run cli result:opportunities --run-id <ID> --plugin seo-gap
```

## Performance Checklist

- **Lightweight Selectors**: Avoid overly complex CSS/XPath selectors that force heavy DOM traversal. Prefer IDs/classes/tag names.
- **Run Async**: Perform heuristic analysis _after_ the page load completes and data is extracted, or as a post-processing step on the saved HTML snapshot if available (though usually easier live).

## Testing Plan

1.  **Unit Test: Heuristic Matcher**
    - Fixtures: HTML snippets representing product pages, blog posts.
    - Assert correct heuristic triggers (e.g., product page fixture -> suggests Product Schema).
    - Assert negative matches (e.g., about page fixture -> no Product suggestion).
2.  **Integration Test: Gap Analysis**
    - Mock a page with product content but _without_ schema.
    - Run scanner -> verify `SeoResult.opportunities` contains "Missing Product Schema".
