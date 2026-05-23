// apps/web/src/pages/api/classify.ts

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from 'node:url';

type APIRoute = (context: { request: Request }) => Promise<Response>;

export const POST: APIRoute = async ({ request }) => {
    console.log("[API] Classify endpoint hit");
    let body;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
    }
    const { url } = body;

    if (!url || typeof url !== "string") {
        return new Response(JSON.stringify({ error: "Invalid URL provided" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const isDev = process.env.NODE_ENV !== "production";
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const depth = isDev ? "../../../../../" : "../../../../../";
        const projectRoot = path.resolve(__dirname, depth);

        // This relies on tsx being available which might be specific to dev
        // In clean production build, we should run the built JS
        const cliBuildPath = path.join(projectRoot, "packages/cli/dist/index.js");
        
        // Command Construction
        // If dist exists, use node dist/index.js
        // Else use npx tsx src/index.ts

        // For now, let's reuse trigger.ts logic or simplify:
        // Just use `node packages/cli/dist/index.js` assuming build is done

        // const cmd = "node";
        // const args = [cliBuildPath, "classify", "--url", url];

        // BUT, since we have been using ts-node/tsx contexts...
        // Let's copy trigger.ts pattern for dev robustness

        let cmd = "node";
        let args = [cliBuildPath, "classify", "--url", url];

        // Since we are running from Astro dev server, likely in source mode
        // Let's assume we want to run the BUILT cli for stability.
        // User should run `npm run build` before using dashboard in prod way.

        // For development convenience:
        // Use tsx if dist doesn't exist?

        
        return new Promise((resolve) => {
            console.log(`[API] Spawning: ${cmd} ${args.join(" ")}`);
            const child = spawn(cmd, args, {
                cwd: projectRoot,
                env: process.env // pass PATH
            });

            let stdout = "";
            let stderr = "";

            child.stdout.on("data", (data) => stdout += data.toString());
            child.stderr.on("data", (data) => stderr += data.toString());

            child.on("close", (code) => {
                if (code !== 0) {
                    console.error("[API] Classify Error:", stderr);
                    resolve(new Response(JSON.stringify({ error: "Classification failed", details: stderr, raw: stdout }), { status: 500 }));
                } else {
                    try {
                        // Find the JSON array
                        const match = stdout.match(/\[.*\]/s);
                        if (match) {
                            const types = JSON.parse(match[0]);
                            resolve(new Response(JSON.stringify({ types, raw: stdout }), { status: 200 }));
                        } else {
                            resolve(new Response(JSON.stringify({ error: "Could not parse output", raw: stdout }), { status: 500 }));
                        }
                    } catch (e: any) {
                        resolve(new Response(JSON.stringify({ error: "JSON Parse Error", details: e.message, raw: stdout }), { status: 500 }));
                    }
                }
            });
        });

    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
