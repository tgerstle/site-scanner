import type { APIRoute } from 'astro';
import { getDb } from 'db';
import * as path from 'node:path';
import {
    flattenA11y,
    flattenPerformance,
    flattenSeo,
    generateGlobalRollup,
    generateCsvZipBuffer,
    generateXlsxBuffer
} from 'core';

export const GET: APIRoute = async ({ params, request }) => {
    const { id } = params;

    if (!id) {
        return new Response(JSON.stringify({ error: 'Run ID is required.' }), { status: 400 });
    }

    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'xlsx';

    try {
        const dbPath = process.env.AWA_DB_PATH || path.resolve(process.cwd(), "../../data/awa.sqlite");
        const db = getDb(dbPath);

        const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as any;
        if (!run) {
            db.close();
            return new Response(JSON.stringify({ error: `Run ID ${id} not found.` }), { status: 404 });
        }

        const a11yData = flattenA11y(db, id);
        const performanceData = flattenPerformance(db, id);
        const seoData = flattenSeo(db, id);
        const globalRollup = generateGlobalRollup(a11yData, performanceData, seoData);

        db.close();

        const datasets = {
            global: globalRollup,
            a11y: a11yData,
            performance: performanceData,
            seo: seoData
        };

        let buffer: Buffer | undefined;
        let contentType = '';
        let fileName = '';

        if (format === 'csv') {
            buffer = await generateCsvZipBuffer(datasets);
            contentType = 'application/zip';
            fileName = `scanner-export-${id}.zip`;
        } else if (format === 'json') {
            return new Response(JSON.stringify(datasets, null, 2), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Disposition': `attachment; filename="scanner-export-${id}.json"`
                }
            });
        } else {
            buffer = await generateXlsxBuffer(datasets);
            // fallback content type mapping
            contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            fileName = `scanner-export-${id}.xlsx`;
        }

        if (!buffer) {
            return new Response(JSON.stringify({ error: 'Failed to generate export file.' }), { status: 500 });
        }

        return new Response(buffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${fileName}"`
            }
        });

    } catch (error: any) {
        console.error("Export API Error:", error);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { status: 500 });
    }
};
