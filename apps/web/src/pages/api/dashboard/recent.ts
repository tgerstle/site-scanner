import type { APIRoute } from 'astro';
import { getRecentUrls } from '../../../lib/queries';

export const GET: APIRoute = async () => {
    try {
        const recent = getRecentUrls();
        return new Response(JSON.stringify(recent), {
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
