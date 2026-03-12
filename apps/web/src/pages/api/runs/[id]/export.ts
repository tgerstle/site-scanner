
import type { APIRoute } from 'astro';
import { getRunDetails } from '../../../../lib/queries';

export const GET: APIRoute = async ({ params, request }) => {
    const { id } = params;
    if (!id) {
        return new Response(JSON.stringify({ error: 'Run ID missing' }), { status: 400 });
    }

    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';

    const run = getRunDetails(id);
    if (!run) {
        return new Response(JSON.stringify({ error: 'Run not found' }), { status: 404 });
    }

    if (format === 'csv') {
        // CSV Export
        const headers = ['URL', 'Status', 'Depth', 'Violations'];
        const rows = run.pages.map(page => [
            `"${page.url}"`, // Quote URL
            page.status,
            page.depth,
            page.violation_count
        ]);

        // Add Summary Row at top? Usually CSVs are flat.
        // Let's just do page list for CSV.
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        return new Response(csvContent, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="wa_audit_${id}.csv"`,
            },
        });
    }

    // JSON Export (Default)
    return new Response(JSON.stringify(run, null, 2), {
        headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="wa_audit_${id}.json"`,
        },
    });
};
