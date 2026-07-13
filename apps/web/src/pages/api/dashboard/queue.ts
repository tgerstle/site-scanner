import type { APIRoute } from 'astro';
import { getQueue } from '../../../lib/queries';

export const GET: APIRoute = async () => {
    try {
        const queue = getQueue();
        return new Response(JSON.stringify(queue), {
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
