import type { AuditContext, AuditPlugin } from "@scanner/types";

let playAudit: any = null;

export const LighthousePlugin: AuditPlugin = {
    name: "lighthouse",
    async run(ctx: AuditContext) {
        if (!playAudit) {
            try {
                const mod = await import("playwright-lighthouse");
                playAudit = mod.playAudit;
            } catch (err) {
                ctx.log("playwright-lighthouse not installed. Skipping lighthouse audit.");
                return;
            }
        }

        // Lighthouse audit requires a CDP port. We assume the browser was launched
        // with --remote-debugging-port and it is passed in the context.
        const port = (ctx as any).cdpPort;

        if (!port) {
            ctx.log("Lighthouse plugin requires 'cdpPort' to be set on the AuditContext. Skipping.");
            return;
        }

        try {
            const result = await playAudit({
                page: ctx.page,
                port: port,
                thresholds: {
                    performance: 0,
                    accessibility: 0,
                    "best-practices": 0,
                    seo: 0,
                    pwa: 0,
                },
                ignoreError: true, // Don't throw if thresholds aren't met
                disableLogs: true,
            });

            if (result && result.lhr && result.lhr.categories) {
                ctx.results.seo_score = result.lhr.categories.seo?.score;
                ctx.results.custom_data = {
                    ...ctx.results.custom_data,
                    performance_score: result.lhr.categories.performance?.score,
                    accessibility_score: result.lhr.categories.accessibility?.score,
                    best_practices_score: result.lhr.categories["best-practices"]?.score,
                };

                // Extract Performance Opportunities & Diagnostics
                const audits = result.lhr.audits;
                const findings: any[] = [];

                // We want audits that are part of the 'performance' category and have a score < 1 (failing/warning)
                // The category definition has a list of auditRefs.
                const perfAuditRefs = result.lhr.categories.performance?.auditRefs || [];

                for (const ref of perfAuditRefs) {
                    const audit = audits[ref.id];
                    // Valid audit with score < 1 (1 is perfect, 0 is bad, null is informative)
                    // We also include informative (null) if it's a diagnostic with details?
                    // Typically 'load-opportunities' have a score. 'diagnostics' might be null or score.
                    if (audit && typeof audit.score === 'number' && audit.score < 0.9) {
                        findings.push({
                            id: audit.id,
                            title: audit.title,
                            description: audit.description,
                            score: audit.score,
                            displayValue: audit.displayValue,
                            details: audit.details
                        });
                    }
                }
                ctx.results.performance_findings = findings;

                ctx.log(`Lighthouse audit successful. Perf: ${result.lhr.categories.performance?.score}`);
            } else {
                ctx.log("Lighthouse audit returned no LHR categories.");
            }
        } catch (err: any) {
            ctx.log(`Lighthouse audit failed: ${err.message}`);
            ctx.flags.hasErrors = true;
        }
    },
};
