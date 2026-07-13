import type { APIRoute } from 'astro';
import { getStats } from '../../../lib/queries';

export const GET: APIRoute = async () => {
    try {
        const stats = getStats();
        return new Response(JSON.stringify(stats), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
