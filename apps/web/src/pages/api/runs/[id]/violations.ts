import type { APIRoute } from 'astro';
import { getPageViolations } from '../../../../lib/queries';

export const GET: APIRoute = async ({ params, request }) => {
    const { id } = params;
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");

    if (!id || !targetUrl) {
        return new Response(JSON.stringify({ error: "Run ID and target URL are required" }), { status: 400 });
    }

    try {
        const violations = getPageViolations(id, targetUrl);
        return new Response(JSON.stringify(violations), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
