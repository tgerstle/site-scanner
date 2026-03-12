import type { APIRoute } from 'astro';
import { getRunDetails, deleteRun } from '../../../lib/queries';

export const GET: APIRoute = async ({ params }) => {
    const { id } = params;
    if (!id) {
        return new Response(JSON.stringify({ error: "Run ID is required" }), { status: 400 });
    }

    try {
        const run = getRunDetails(id);
        if (!run) {
            return new Response(JSON.stringify({ error: "Run not found" }), { status: 404 });
        }
        return new Response(JSON.stringify(run), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

export const DELETE: APIRoute = async ({ params }) => {
    const { id } = params;
    if (!id) {
        return new Response(JSON.stringify({ error: 'Run ID missing' }), { status: 400 });
    }

    try {
        const run = getRunDetails(id);
        if (!run) {
            return new Response(JSON.stringify({ error: 'Run not found' }), { status: 404 });
        }

        if (run.status === 'running') {
            return new Response(JSON.stringify({ error: 'Cannot delete a running scan. Please stop it first.' }), { status: 400 });
        }

        const success = deleteRun(id);
        if (success) {
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        } else {
            return new Response(JSON.stringify({ error: 'Failed to delete run' }), { status: 500 });
        }
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};
