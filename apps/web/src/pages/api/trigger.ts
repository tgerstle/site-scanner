// apps/web/src/pages/api/trigger.ts

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from 'node:url';

// Define APIRoute type manually if not available globally
type APIRoute = (context: { request: Request }) => Promise<Response>;

export const POST: APIRoute = async ({ request }) => {
    console.log("[API] Trigger endpoint hit");
    let body;
    try {
        body = await request.json();
        console.log("[API] Received body:", JSON.stringify(body));
    } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
    }
    const { url, urls, depth: reqDepth, concurrency, throttleMs, throttleJitter, stealth, userAgent, locale, timezoneId, proxy, blockAssets, humanize, plugins, networkIdleTimeout, twoTrackEnabled, auditDocuments } = body;

    if ((!url || typeof url !== "string") && (!urls || !Array.isArray(urls) || urls.length === 0)) {
        return new Response(JSON.stringify({ error: "Invalid URL or URL list provided" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const isDev = process.env.NODE_ENV !== "production";

    // Generic path resolution matching other endpoints (stop.ts, reset.ts)
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const depth = isDev ? "../../../../../" : "../../../../../";
    const projectRoot = path.resolve(__dirname, depth);
    console.log(`[API] Derived Project Root: ${projectRoot}`);

    const cliSourcePath = path.join(projectRoot, "packages/cli/src/index.ts");
    const cliBuildPath = path.join(projectRoot, "packages/cli/dist/index.js");

    // Safer execution path: Use local tsx package directly to avoid bin/symlink issues
    const tsxCliPath = path.join(projectRoot, "node_modules/tsx/dist/cli.mjs");

    let command: string;
    let args: string[];

    // Construct command arguments
    const targetList = (urls && Array.isArray(urls)) ? urls.join(',') : null;
    const targetUrl = url;

    // Build args array first
    let cliArgs = ["start"];
    if (targetList) {
        cliArgs.push("-l", targetList);
    } else if (targetUrl) {
        cliArgs.push("-u", targetUrl);
    }

    // Add optional recursive depth
    if (reqDepth !== undefined && reqDepth !== null && String(reqDepth).trim() !== "") {
        cliArgs.push("-d", String(reqDepth));
    }

    // Add optional concurrency (number of parallel audit workers)
    if (concurrency !== undefined && concurrency !== null && String(concurrency).trim() !== "") {
        cliArgs.push("-j", String(concurrency));
    }

    // Add optional throttle / jitter (politeness delay between jobs)
    if (throttleMs !== undefined && throttleMs !== null && String(throttleMs).trim() !== "") {
        cliArgs.push("--throttle", String(throttleMs));
    }
    if (throttleJitter !== undefined && throttleJitter !== null && String(throttleJitter).trim() !== "") {
        cliArgs.push("--jitter", String(throttleJitter));
    }

    // Stealth / anti-detection options (mirror config + CLI)
    if (stealth === true) cliArgs.push("--stealth");
    if (humanize === true) cliArgs.push("--humanize");
    if (blockAssets === false) cliArgs.push("--no-block-assets");
    if (typeof userAgent === "string" && userAgent.trim() !== "") cliArgs.push("--user-agent", userAgent);
    if (typeof locale === "string" && locale.trim() !== "") cliArgs.push("--locale", locale);
    if (typeof timezoneId === "string" && timezoneId.trim() !== "") cliArgs.push("--timezone", timezoneId);
    if (proxy && typeof proxy === "object" && typeof proxy.server === "string" && proxy.server.trim() !== "") {
        cliArgs.push("--proxy", proxy.server);
        if (typeof proxy.username === "string" && proxy.username !== "") cliArgs.push("--proxy-user", proxy.username);
        if (typeof proxy.password === "string" && proxy.password !== "") cliArgs.push("--proxy-pass", proxy.password);
    }

    // Add optional plugins
    if (plugins && Array.isArray(plugins) && plugins.length > 0) {
        cliArgs.push("-p", ...plugins);
    }

    if (networkIdleTimeout !== undefined && networkIdleTimeout !== null) {
        cliArgs.push("--network-timeout", String(networkIdleTimeout));
    }

    if (twoTrackEnabled === true) {
        cliArgs.push("--two-track");
    }

    if (auditDocuments === true) {
        cliArgs.push("--audit-documents");
    }

    if (isDev) {
        // Dev: node -> tsx -> source
        command = "node";
        args = [tsxCliPath, cliSourcePath, ...cliArgs];
    } else {
        // Prod: node -> build
        command = "node";
        args = [cliBuildPath, ...cliArgs];
    }

    console.log(`[API] Spawning CLI command: ${command} ${args.join(" ")} in CWD: ${projectRoot}`);

    return new Promise<Response>((resolve) => {
        let responseSent = false;
        let stdoutBuffer = "";
        let stderrBuffer = "";

        const child = spawn(command, args, {
            cwd: projectRoot, // Run from root to ensure config/paths align
            env: { ...process.env }, // Inherit env vars like PATH
            detached: true // Allow child to run independently
        });

        // Ensure we don't hold the parent process open
        child.unref();

        child.stdout.on("data", (data) => {
            const chunk = data.toString();
            stdoutBuffer += chunk;

            // Search for the runId pattern we added to the CLI: '{"runId":"...","status":"started"}'
            // We use a regex to extract it
            const match = chunk.match(/"runId"\s*:\s*"([^"]+)"/);

            if (match && !responseSent) {
                const runId = match[1];
                responseSent = true;

                // We got what we needed, we can return success
                resolve(new Response(JSON.stringify({
                    runId,
                    message: "Run started via CLI"
                }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" }
                }));
            }
        });

        child.stderr.on("data", (data) => {
            stderrBuffer += data.toString();
        });

        child.on("error", (err) => {
            console.error("Failed to start CLI process:", err);
            if (!responseSent) {
                responseSent = true;
                resolve(new Response(JSON.stringify({
                    error: "Failed to start CLI process",
                    details: err.message
                }), {
                    status: 500,
                    headers: { "Content-Type": "application/json" },
                }));
            }
        });

        child.on("close", (code) => {
            if (!responseSent) {
                responseSent = true;
                if (code === 0) {
                    // Process finished successfully but we missed the ID?
                    resolve(new Response(JSON.stringify({
                        message: "CLI process finished successfully (runId not captured)",
                        logs: stdoutBuffer
                    }), {
                        status: 200,
                        headers: { "Content-Type": "application/json" }
                    }));
                } else {
                    resolve(new Response(JSON.stringify({
                        error: "CLI process failed",
                        details: stderrBuffer || stdoutBuffer,
                        exitCode: code
                    }), {
                        status: 500,
                        headers: { "Content-Type": "application/json" }
                    }));
                }
            }
        });

        // Timeout: If CLI hangs without outputting ID for too long (e.g. 5 seconds)
        // We assume it's running but maybe we missed the output or it's slow
        setTimeout(() => {
            if (!responseSent) {
                responseSent = true;
                // We resolve with what we have. The process is still running (detached).
                // We return a 202 Accepted to indicate it's processing
                resolve(new Response(JSON.stringify({
                    message: "Run initiated (monitoring timeout, check dashboard for status)",
                    logs: stdoutBuffer
                }), {
                    status: 202,
                    headers: { "Content-Type": "application/json" }
                }));
            }
        }, 5000);
    });
};
