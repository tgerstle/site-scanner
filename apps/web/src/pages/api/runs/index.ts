import type { APIRoute } from 'astro';
import { getRuns } from '../../../lib/queries';

export const GET: APIRoute = async () => {
    try {
        const runs = getRuns();
        return new Response(JSON.stringify(runs), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
