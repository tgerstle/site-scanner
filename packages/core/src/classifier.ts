import { Page, Response } from "playwright";
import { ScannerConfig } from "@scanner/types";

export interface ClassificationResult {
  types: string[];
  meta: {
    jsonLdSource: "dynamic" | "static" | "none";
    isDynamic: boolean;
  };
}

export class PageClassifier {
  constructor(private config: ScannerConfig) {}

  /**
   * Determines the Page Types for a given URL and Playwright Page context.
   * Always includes "global".
   */
  async classify(
    url: string,
    page: Page,
    response: Response | null = null,
  ): Promise<ClassificationResult> {
    const matchedTypes: Set<string> = new Set(["global"]);
    const definitions = this.config.definitions || {};
    let isDynamic = false;

    // Extract JSON-LD types from the page first
    let jsonLdTypes: Set<string> = new Set();
    try {
      const types = await page.evaluate(() => {
        const found: string[] = [];
        const scripts = document.querySelectorAll(
          'script[type="application/ld+json"]',
        );
        scripts.forEach((s) => {
          try {
            const json = JSON.parse(s.textContent || "{}");
            const check = (obj: any) => {
              if (!obj || typeof obj !== "object") return;
              if (obj["@type"]) {
                if (Array.isArray(obj["@type"])) found.push(...obj["@type"]);
                else found.push(obj["@type"]);
              }
              if (Array.isArray(obj["@graph"])) obj["@graph"].forEach(check);
              // Also check inside mainEntity if present
              if (obj.mainEntity) check(obj.mainEntity);
            };
            if (Array.isArray(json)) {
              json.forEach(check);
            } else {
              check(json);
            }
          } catch {}
        });
        return found;
      });
      jsonLdTypes = new Set(types);
      if (response && jsonLdTypes.size > 0 && response.ok()) {
        const raw = await response.text().catch(() => "");
        // Simple heuristic: If raw text doesn't contain a key schema type, it's dynamic
        // Need to iterate types
        for (const t of Array.from(jsonLdTypes)) {
          // Check if type string appears in raw HTML
          // This is case-sensitive, but types are usually consistent
          if (
            !raw.includes(`"@type": "${t}"`) &&
            !raw.includes(`"@type":"${t}"`)
          ) {
            // Could be dynamic
            // But also try simple string match just in case
            if (!raw.includes(t)) {
              isDynamic = true;
              break;
            }
          }
        }
      }
    } catch (e) {
      console.warn(`Error extracting JSON-LD for ${url}`, e);
    }

    for (const [type, def] of Object.entries(definitions)) {
      // 0. Check Exclusions first
      if (def.excludePattern) {
        try {
          const excludeRegex = new RegExp(def.excludePattern);
          if (excludeRegex.test(url)) {
            continue; // Skip this type
          }
        } catch {
          console.warn(
            `Invalid excludePattern regex for type '${type}': ${def.excludePattern}`,
          );
        }
      }

      let isMatch = false;

      // 1. Schema Type Check (Highest Priority)
      // @ts-ignore - schemaType is new property
      if (def.schemaType) {
        const required = Array.isArray(def.schemaType)
          ? def.schemaType
          : [def.schemaType];
        // Check if ANY required type is present in jsonLdTypes, case-insensitive check
        const hasMatch = required.some(
          (t: string) =>
            jsonLdTypes.has(t) ||
            Array.from(jsonLdTypes).some(
              (found) => found.toLowerCase() === t.toLowerCase(),
            ),
        );

        if (hasMatch) {
          isMatch = true;
        }
      }

      // 2. Selector Check (Strong Signal)
      if (!isMatch && def.selector) {
        try {
          // Quick check for existence.
          // Note: This relies on the selector being present in the DOM snapshot at this moment.
          // For more complex SPAs, we might need a timeout, but classify usually runs after network idle.
          const element = await page.$(def.selector);
          if (element) {
            isMatch = true;
          }
        } catch (e) {
          // Selector might be invalid or page closed
          console.warn(
            `Error checking selector '${def.selector}' for type '${type}':`,
            e,
          );
        }
      }

      // 3. URL Pattern Check (Weak Signal)
      // Only check if selector didn't already match (or if no selector defined)
      // Actually, spec says if selector matches we are good.
      if (!isMatch && def.urlPattern) {
        try {
          const urlRegex = new RegExp(def.urlPattern);
          if (urlRegex.test(url)) {
            isMatch = true;
          }
        } catch {
          console.warn(
            `Invalid urlPattern regex for type '${type}': ${def.urlPattern}`,
          );
        }
      }

      if (isMatch) {
        matchedTypes.add(type);
      }
    }

    return {
      types: Array.from(matchedTypes),
      meta: {
        jsonLdSource: isDynamic
          ? "dynamic"
          : jsonLdTypes.size > 0
            ? "static"
            : "none",
        isDynamic,
      },
    };
  }
}
