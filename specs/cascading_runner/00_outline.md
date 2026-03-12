# Cascading Test Runner Project Outline

This folder contains the specifications for the "Cascading Test Runner" refactor. This architecture transforms the scanner from a flat, broad crawler into an intelligent, context-aware auditing system.

## Project Goals

1.  **Context Awareness:** Scan logic adapts based on the type of page (e.g., Product vs. Blog).
2.  **Efficiency:** Avoid running irrelevant tests (e.g., "Add to Cart" checks on an "About" page).
3.  **Hierarchical & Cascading:** Tests flow from Global (All Pages) -> Routing (Identification) -> Contextual (Specific Types) -> Fragments (Features).
4.  **Configurability:** Users can define custom Page Types and Rules via `awaconfig.json` with a robust default preset.

## Phased Implementation Plan

| Phase    | Description               | Status      | File                                                         |
| :------- | :------------------------ | :---------- | :----------------------------------------------------------- |
| **01**   | **Configuration & Types** | Not Started | [01_configuration_types.md](./01_configuration_types.md)     |
| **02**   | **Classifier Engine**     | Not Started | [02_classifier_logic.md](./02_classifier_logic.md)           |
| **02.5** | **Sitemap Integration**   | Not Started | [02_5_sitemap_integration.md](./02_5_sitemap_integration.md) |
| **03**   | **Audit Worker Logic**    | Not Started | [03_audit_worker_refactor.md](./03_audit_worker_refactor.md) |
| **04**   | **Database & CLI Tools**  | Not Started | [04_database_and_cli.md](./04_database_and_cli.md)           |
| **05**   | **Testing Strategy**      | Not Started | [05_testing_strategy.md](./05_testing_strategy.md)           |
| **06**   | **Impact Analysis**       | Completed   | [06_impact_analysis.md](./06_impact_analysis.md)             |

## Core Concept: The "Cascade"

The `AuditWorker` will no longer simply "Run All Plugins". Instead, it follows this flow:

1.  **Global Phase:** Run lightweight checks required for _every_ page (Technical SEO, basic perf).
2.  **Discovery/Routing Phase:**
    - Run the **Classifier** against the DOM.
    - Determine `PageType` (e.g., `product`, `article`, `global_fallback`).
3.  **Contextual Phase:**
    - Look up the list of plugins meant for this `PageType`.
    - Execute _only_ those plugins.
4.  **Fragment Phase:**
    - Detect specific features (e.g., `<video>`, `<form>`).
    - Run specific micro-tests for those elements.

## Tracking

- [ ] Phase 1: Configuration Schemas Defined
- [ ] Phase 2: Classifier Logic Implemented & Tested
- [ ] Phase 3: Audit Worker Refactored
- [ ] Phase 4: CLI `classify` command & DB Updates
