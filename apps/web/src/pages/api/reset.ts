import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { APIRoute } from 'astro';

export const POST: APIRoute = async () => {
    const isDev = process.env.NODE_ENV !== "production";

    // Generic path resolution logic based on build structure
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const depth = isDev ? "../../../../../" : "../../../../../../";
    const projectRoot = path.resolve(__dirname, depth);

    const cliSourcePath = path.join(projectRoot, "packages/cli/src/index.ts");
    const cliBuildPath = path.join(projectRoot, "packages/cli/dist/index.js");

    // Safer execution path: Use local node_modules binary if available to avoid npx prompts/install
    const localTsxPath = path.join(projectRoot, "node_modules/.bin/tsx");
    // Only use 'tsx' directly if dev environment and local binary exists
    // Fallback to 'npx' if necessary, but prefer 'node' + loader logic usually

    let command, args;

    if (isDev) {
        command = localTsxPath;
        args = [cliSourcePath, "reset", "--force"];
    } else {
        command = "node";
        args = [cliBuildPath, "reset", "--force"];
    }

    console.log(`[API] Resetting DB via CLI: ${command} ${args.join(" ")}`);

    return new Promise<Response>((resolve) => {
        const child = spawn(command, args, {
            cwd: projectRoot,
            env: { ...process.env }, // Pass environment variables
            stdio: ["ignore", "pipe", "pipe"]
        });

        let output = "";
        let errorOutput = "";

        child.stdout.on('data', (data) => {
            const chunk = data.toString();
            output += chunk;
        });

        child.stderr.on('data', (data) => {
            const chunk = data.toString();
            errorOutput += chunk;
        });

        child.on('close', (code) => {
            if (code === 0) {
                // Success
                console.log(`[API] Reset success. Output: ${output}`);
                resolve(new Response(JSON.stringify({
                    message: "Database reset successfully.",
                    debugOutput: output
                }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" }
                }));
            } else {
                // Failure
                console.error(`[API] Reset failed (code ${code}). Stderr: ${errorOutput}`);
                resolve(new Response(JSON.stringify({
                    error: "Failed to reset database.",
                    details: errorOutput || "Unknown error",
                    debugOutput: output
                }), {
                    status: 500,
                    headers: { "Content-Type": "application/json" }
                }));
            }
        });

        child.on('error', (err) => {
            console.error(`[API] Spawn error: ${err.message}`);
            resolve(new Response(JSON.stringify({
                error: "Failed to run CLI process",
                details: err.message
            }), {
                status: 500,
                headers: { "Content-Type": "application/json" }
            }));
        });
    });
};
