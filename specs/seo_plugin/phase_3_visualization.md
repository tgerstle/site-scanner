# Phase 3: Visualization (CLI & Frontend Logic)

## Overview

This phase builds the capacity to visualize SEO data effectively. While the primary deliverable is a dashboard component, this specification defines the **CLI command** and backend data structure needed to support those visuals. The goal is to provide previews (Google SERP, LinkedIn/FB Cards) without needing a full browser rendering engine in the terminal.

## Objectives

- [ ] **3.1 Social Preview Logic**
  - Create `SeoPreviewBuilder` service.
  - Generates preview objects for React components to consume.
- [ ] **3.2 CLI Preview Output**
  - Implement `seo:preview` CLI command.
  - Output ASCII or structured JSON representation of social cards.
- [ ] **3.3 React Components**
  - `SeoSerpPreview.tsx`: Simulates Google search result.
  - `SeoSocialPreview.tsx`: Simulates Facebook/Twitter cards.

## Technical Implementation

### Preview Data Structure

The backend/CLI will return a sanitized object ready for rendering:

```typescript
interface SeoPreviewData {
  serp: {
    title: string; // Calculated: Truncated title + site name
    description: string; // Calculated: Truncated meta description
    url: string; // Formatted URL
    date?: string; // Extracted date if available
  };
  social: {
    facebook: {
      title: string;
      description: string;
      image: string | null;
      domain: string;
    };
    twitter: {
      title: string;
      description: string;
      image: string | null;
      cardType: "summary" | "summary_large_image";
      site: string | null;
    };
  };
}
```

### CLI Command

```bash
# Generate preview data for a URL (without saving to DB)
npm run cli seo:preview --url https://example.com --format json
```

**Output (JSON):**

```json
{
  "serp": { "title": "My Page...", "description": "..." },
  "social": { ... }
}
```

## Performance Checklist

- **Asset Loading**: Ensure placeholder images are used in frontend if real images fail to load (avoid layout shifts).
- **String Processing**: Truncation logic should be efficient (simple string slicing + ellipsis).

## Testing Plan

1.  **Unit Test: Preview Builder**
    - Input: Raw `SeoResult`.
    - Output: `SeoPreviewData`.
    - Verify truncation rules (e.g., Title > 60 chars gets truncated).
    - Verify fallback logic (e.g., `og:title` missing -> uses `<title>`).
2.  **Visual Test (Frontend)**
    - Storybook or component test for `SeoSocialPreview` rendering correctly with various data states (empty, full, missing image).
