# Phase 2: Validation & Analysis

## Overview

This phase introduces validation logic to analyze the extracted data against Schema.org constraints and best practices. It utilizes `ajv` and `schema-org-json-schemas` to validate structured data. The goal is to flag errors, missing required properties, and inconsistent metadata.

## Objectives - **PARTIAL**

- [x] **2.1 Validation Engine**
  - Implement `SeoValidator` class/service.
- [x] **2.2 Meta Tag & Content Validation**
  - Title length (30-60 chars).
  - Description length (50-160 chars).
  - Canonical validation (self-referencing logic).
  - Robots validation (index/follow status).
  - Headings structure (H1 presence, hierarchy).
  - Image Alt Text presence (sampling).
- [ ] **2.3 Schema.org Validation (PENDING)**
  - Load package `ajv` and `schema-org-json-schemas`.
  - Validate extracted JSON-LD against these schemas.
  - Report errors in a structured format (property path, missing property, invalid type).
- [ ] **2.4 CLI Command**
  - Ability to run validation against stored results or live input.

## Technical Implementation

### Validation Output Structure

Extend `SeoResult` to include `validation`:

```typescript
interface SeoValidationResult {
  meta: {
    status: "pass" | "warn" | "fail";
    errors: string[];
    warnings: string[];
  };
  schema: {
    valid: boolean;
    errors: Array<{
      path: string | null;
      message: string;
      schemaType: string;
    }>;
  };
  score: number; // Overall SEO Health Score (0-100)
}
```

### CLI Command

```bash
# Analyze existing scan results for SEO issues
npm run cli results analyze --run-id <ID> --plugin seo-validation
```

## Testing Plan (`tests/seo-validator.test.ts`)

1.  **Unit Test: Validation Logic**
    - Feed valid and invalid JSON-LD objects to `SeoValidator`.
    - Assert correct error reporting (e.g., "Missing required property 'price' in Product").
    - Verify Meta Tag length checks (too short/long strings).
2.  **Integration Test: Full Workflow**
    - End-to-end: Scan a page with known bad schema -> Check DB -> Run Validation -> Check Errors.

## Performance Checklist

- **Pre-compilation**: Ensure `ajv` schemas are pre-compiled once (singleton pattern) to avoid recompilation overhead per page.
- **Lazy Loading**: Only load schemas relevant to the document type being validated.
