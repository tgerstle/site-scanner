import type { APIRoute } from 'astro';
import { getDatabase } from '~/lib/queries';
import { stopRun } from 'db';

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

        if (run.status === 'stopped' || run.status === 'completed' || run.status === 'failed') {
            return new Response(JSON.stringify({ message: "Run is already stopped" }), { status: 200 });
        }

        // Kill process if running
        if (run.pid) {
            try {
                // Check if process exists before killing
                process.kill(run.pid, 0);
                process.kill(run.pid, 'SIGTERM');
                console.log(`[API] Sent SIGTERM to PID ${run.pid} for run ${runId}`);
            } catch (e: any) {
                if (e.code === 'ESRCH') {
                    // Process already dead
                    console.warn(`[API] Process ${run.pid} not found for run ${runId}. Updating status manually.`);
                } else {
                    console.error(`[API] Error killing process ${run.pid}:`, e);
                    // We continue to stopRun() call to ensure DB consistency
                }
            }
        }

        // Always clean up DB state (status='stopped', queue items stopped)
        // using the shared helper from db package
        stopRun(db, runId);

        return new Response(JSON.stringify({ message: `Run ${runId} stopped successfully` }), { status: 200 });

    } catch (e: any) {
        console.error(`[API] Failed to stop run ${runId}:`, e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};
