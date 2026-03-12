import type { APIRoute } from 'astro';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const POST: APIRoute = async () => {
    const isDev = process.env.NODE_ENV !== "production";

    // Robust path resolution using import.meta.url
    // Current file: apps/web/src/pages/api/stop.ts
    // We want to get to the monorepo root
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    // Generic path resolution logic based on build structure
    // In dev: apps/web/src/pages/api/stop.ts (5 levels deep from root)
    // In prod: apps/web/dist/server/pages/api/stop.astro.mjs (6 levels deep from root)
    const depth = isDev ? "../../../../../" : "../../../../../../";
    const projectRoot = path.resolve(__dirname, depth);

    // Fallback: if we are in a built output structure, logs might help debug
    console.log(`[API Debug] Current dir: ${__dirname}, Project Root: ${projectRoot}`);

    const cliSourcePath = path.join(projectRoot, "packages/cli/src/index.ts");
    const cliBuildPath = path.join(projectRoot, "packages/cli/dist/index.js");

    const command = isDev ? "npx" : "node";
    const args = isDev
        ? ["tsx", cliSourcePath, "stop", "--all"]
        : [cliBuildPath, "stop", "--all"];

    console.log(`[API] Killing runs via CLI: ${command} ${args.join(" ")}`);

    return new Promise<Response>((resolve) => {
        const child = spawn(command, args, {
            cwd: projectRoot,
            env: { ...process.env },
            stdio: ["ignore", "pipe", "pipe"]
        });

        let output = "";
        let errorOutput = "";

        child.stdout.on('data', (data) => {
            const chunk = data.toString();
            output += chunk;
            console.log(`[CLI stdout] ${chunk}`);
        });

        child.stderr.on('data', (data) => {
            const chunk = data.toString();
            errorOutput += chunk;
            console.error(`[CLI stderr] ${chunk}`);
        });

        child.on('close', (code) => {
            const success = code === 0;
            const message = success
                ? (output.trim() || "Stop command executed successfully")
                : (errorOutput.trim() || "Stop command failed");

            resolve(new Response(JSON.stringify({
                success,
                message,
                logs: output,
                errors: errorOutput
            }), {
                status: success ? 200 : 500,
                headers: { "Content-Type": "application/json" }
            }));
        });

        child.on('error', (err) => {
            console.error(`[API Error] Failed to spawn: ${err.message}`);
            resolve(new Response(JSON.stringify({
                success: false,
                error: err.message
            }), { status: 500 }));
        });
    });
}

