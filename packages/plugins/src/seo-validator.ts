import type { SeoResult, SeoValidationResult } from "@scanner/types";

export class SeoValidator {
    static validate(data: SeoResult, _currentUrl: string): SeoValidationResult {
        const meta: SeoValidationResult["meta"] = {
            status: "pass",
            errors: [],
            warnings: []
        };
        const schema: SeoValidationResult["schema"] = {
            valid: true,
            errors: []
        };

        let score = 100;

        // 1. Title Validation
        if (!data.meta.title) {
            meta.errors.push("Missing <title> tag");
            score -= 20;
        } else {
            const titleLen = data.meta.title.length;
            if (titleLen < 10) { // Relaxed from 30
                meta.warnings.push(`Title is too short (${titleLen} chars). Recommended: 30-60.`);
                score -= 5;
            } else if (titleLen > 60) {
                meta.warnings.push(`Title is too long (${titleLen} chars). Recommended: 30-60.`);
                score -= 5;
            }
        }

        // 2. Description Validation
        if (!data.meta.description) {
            meta.errors.push("Missing meta description");
            score -= 20;
        } else {
            const descLen = data.meta.description.length;
            if (descLen < 50) {
                meta.warnings.push(`Description is too short (${descLen} chars). Recommended: 50-160.`);
                score -= 5;
            } else if (descLen > 160) {
                meta.warnings.push(`Description is too long (${descLen} chars). Recommended: 50-160.`);
                score -= 5;
            }
        }

        // 3. Canonical Validation
        if (!data.meta.canonical) {
            meta.warnings.push("Missing canonical tag");
            score -= 10;
        }

        // 4. Heading Structure (H1 check)
        const h1s = data.headings.filter(h => h.level === 1);
        if (h1s.length === 0) {
            meta.errors.push("Missing H1 heading");
            score -= 15;
        } else if (h1s.length > 1) {
            meta.warnings.push(`Multiple H1 headings found (${h1s.length})`);
            score -= 10;
        }

        // 5. Image Alt Text
        // Only check first 10 for score impact to avoid penalizing gallery pages too heavily linearly
        const imagesChecked = data.images.slice(0, 10);
        const missingAlt = imagesChecked.filter(img => !img.alt || img.alt.trim() === "");
        if (missingAlt.length > 0) {
            meta.warnings.push(`${missingAlt.length} images (in sample of ${imagesChecked.length}) missing alt text`);
            score -= 5;
        }

        // 6. JSON-LD Presence
        if (data.jsonLd.length === 0) {
            meta.warnings.push("No JSON-LD structured data found");
            score -= 10;
        } else {
            // Basic Schema.org Structure Check
            data.jsonLd.forEach((block, index) => {
                const context = block["@context"];
                const type = block["@type"];

                if (!context || !type) {
                    schema.valid = false;
                    schema.errors.push({
                        path: `jsonLd[${index}]`,
                        message: "Missing @context or @type",
                        schemaType: "unknown"
                    });
                    score -= 5;
                }
            });
        }

        // H1 mismatch with Title (optional check, good for SEO)
        if (data.meta.title && h1s.length === 1) {
            // Simple similarity check could go here, but omitted for now
        }

        // Determine final status
        if (meta.errors.length > 0) meta.status = "fail";
        else if (meta.warnings.length > 0) meta.status = "warn";

        // Clamp score
        return {
            meta,
            schema,
            score: Math.max(0, Math.round(score))
        };
    }
}
