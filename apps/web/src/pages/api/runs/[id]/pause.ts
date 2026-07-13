import type { APIRoute } from 'astro';
import { getDatabase } from '~/lib/queries';

export const POST: APIRoute = async ({ params }) => {
    const { id: runId } = params;

    if (!runId) {
        return new Response(JSON.stringify({ error: "Run ID is required" }), { status: 400 });
    }

    try {
        const db = getDatabase();
        if (!db) {
            throw new Error("Failed to connect to database");
        }

        const run = db.prepare("SELECT pid, status FROM runs WHERE id = ?").get(runId) as { pid: number, status: string } | undefined;

        if (!run) {
            return new Response(JSON.stringify({ error: "Run not found" }), { status: 404 });
        }

        if (run.status === 'paused') {
            return new Response(JSON.stringify({ message: `Run ${runId} is already paused` }), { status: 200 });
        }

        if (run.status === 'stopped' || run.status === 'completed' || run.status === 'failed') {
            return new Response(JSON.stringify({ error: `Run is already terminal (${run.status})` }), { status: 409 });
        }

        if (run.pid) {
            try {
                process.kill(run.pid, 0);
                process.kill(run.pid, 'SIGSTOP');
                console.log(`[API] Sent SIGSTOP to PID ${run.pid} for run ${runId}`);
            } catch (e: any) {
                if (e.code !== 'ESRCH') {
                    throw e;
                }
                console.warn(`[API] Process ${run.pid} not found for run ${runId}. Pausing DB state only.`);
            }
        }

        db.prepare("UPDATE runs SET status = 'paused', completed_at = NULL WHERE id = ?").run(runId);
        db.prepare(`
            UPDATE queue
            SET status = 'pending', worker_id = NULL
            WHERE run_id = ?
            AND status IN ('processing', 'processing_discovery', 'processing_audit', 'pending_audit')
        `).run(runId);

        return new Response(JSON.stringify({ message: `Run ${runId} paused successfully` }), { status: 200 });

    } catch (e: any) {
        console.error(`[API] Failed to pause run ${runId}:`, e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};
