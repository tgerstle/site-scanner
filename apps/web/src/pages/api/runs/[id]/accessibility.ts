// apps/web/src/pages/api/runs/[id]/accessibility.ts
import type { APIRoute } from 'astro';
import { getCommonAccessibilityIssues } from '../../../../lib/queries';

export const GET: APIRoute = async ({ params }) => {
    const { id } = params;
    if (!id) {
        return new Response(JSON.stringify({ error: 'Run ID is required' }), { status: 400 });
    }

    try {
        const issues = getCommonAccessibilityIssues(id);
        return new Response(JSON.stringify(issues), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
