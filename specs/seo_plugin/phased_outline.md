# SEO & Schema Metadata Scanner Plugin - Phased Implementation

This document outlines the phased implementation strategy for the SEO and Schema Metadata scanning plugin. The goal is to extract, validate, and visualize SEO-critical information, including meta tags, Open Graph data, and JSON-LD structured data.

## Objectives

- **Extraction**: Capture all relevant meta tags (standard, OG, Twitter) and JSON-LD scripts.
- **Validation**: Verify the structure and content of the data against best practices and Schema.org definitions.
- **Visualization**: Provide actionable previews (SERP, Social Cards) and data inspectors.
- **Discovery**: Suggest missing schema opportunities based on page content analysis.
- **Aggregation**: Identify systemic issues across page templates (e.g., "All products missing price meta") rather than just individual URL errors.

## Phase 1: Data Extraction & Storage

**Goal**: Update the core scanner to collect raw SEO data without processing it yet.

- [x] **1. Database Schema Updates**
  - **Task**: Add `seo_result` JSON column to `results` table.
- [x] **2. Plugin Implementation (`SEOMetadataPlugin`)**
  - **Platform**: `packages/plugins/src/seo-metadata.ts` - Implemented.
  - **Extraction Logic**: Standard Tags, OG/Twitter Tags, JSON-LD, Headings, Images.

## Phase 2: Validation & Analysis

**Goal**: Check the integrity and quality of the extracted data.

- [x] **1. Meta Tag Validation**
  - **Tools**: `SeoValidator` class (basic logic).
  - **Checks**: Title/Desc length, Canonical, Robots, Image Alt text.
- [ ] **2. Schema.org Validation**
  - **Tools**: `ajv` + `schema-org-json-schemas` (Pending Integration).
  - **Logic**: Validate extracted JSON-LD against official schemas.
  - **Current Status**: Basic presence check implemented; full schema validation pending.

## Phase 3: Visualization (UI/UX)

**Goal**: Show the user what their page looks like on the web and inspect raw data.

- [x] **1. Social Previews (The "Share" View)**
  - **Component**: `SeoSocialPreview.tsx` - Completed.
- [x] **2. Google SERP Preview**
  - **Component**: `SeoSerpPreview.tsx` - Completed.
- [x] **3. Data Inspector**
  - **Component**: `SeoDetailsViewer.tsx` - Completed.
  - **Features**: Headings structure list, JSON-LD raw viewer, Validation summary.

## Phase 4: Opportunities & Heuristics

**Goal**: Suggest what _could_ be there but isn't.

### 1. Content Analysis (Heuristics)

- **Logic**: Analyze page content to guess the "Entity Type".
  - _If page has `price` pattern ($XX.XX) + "Add to Cart" button_ -> Suggest **`Product`** schema.
  - _If URL contains `/blog/` or `/news/` + Author byline_ -> Suggest **`Article`** schema.
  - _If address/phone number in footer_ -> Suggest **`LocalBusiness`** schema.
  - _If recipe-like structure (Ingredients list)_ -> Suggest **`Recipe`** schema.

### 2. Gap Reporting

- **Output**: A new "Opportunities" section in the report.
  - "We detected a Product on this page, but no `Product` schema was found."
  - "Breadcrumb links found, but `BreadcrumbList` schema is missing."

## Phase 5: Aggregation & Scaled Insights

**Goal**: Move beyond single-page testing to identify systemic issues likely caused by page templates or site configuration.

### 1. Template-Level Analysis

- **Logic**:
  - Group URLs by path pattern depth (e.g., `/products/*`, `/blog/*`).
  - Compare Schema types across the group.
- **Insights**:
  - "90% of your Product pages are missing the `offers.priceCurrency` field." (Systemic template error)
  - "All /blog/ pages have `Article` schema, but 3 are missing `author`." (Content error)

### 2. Site-Wide Meta Tag Health

- **Aggregate Metrics**:
  - **Duplicate Title Tags**: Identify clusters of pages sharing the exact same `<title>`.
  - **Missing Meta Descriptions**: Total count and list of URLs.
  - **Canonical Consistency**: Percentage of pages where `canonical` != `self`.
  - **Social Card Readiness**: Percentage of pages missing `og:image`.

### 3. Schema Coverage Report

- **Visualization**: Bar chart showing Schema Type distribution.
  - "Your site has 500 Products, 20 Articles, and 1 Organization."
- **Opportunity Matrix**:
  - "You have 50 pages with Breadcrumb links but 0 `BreadcrumbList` schemas implemented."

---

## Technical Dependencies (To Be Added)

- **`ajv`**: For JSON Schema validation.
- **`schema-org-json-schemas`**: For schema definitions (or a maintained alternative if stale).
- **`cheerio`**: (Optional) if refined HTML parsing is needed outside browser context.
