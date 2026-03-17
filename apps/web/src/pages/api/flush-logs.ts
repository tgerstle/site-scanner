
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from 'node:url';

type APIRoute = (context: { request: Request }) => Promise<Response>;

export const POST: APIRoute = async () => {
    try {
        const isDev = process.env.NODE_ENV !== "production";
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const depth = isDev ? "../../../../../" : "../../../../../../";
        const projectRoot = path.resolve(__dirname, depth);

        // Assume built CLI 
        const cliBuildPath = path.join(projectRoot, "packages/cli/dist/index.js");

        const cmd = "node";
        const args = [cliBuildPath, "flush-logs"];

        return new Promise((resolve) => {
            const child = spawn(cmd, args, { cwd: projectRoot });
            child.on("close", (code) => {
                if (code === 0) {
                    resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
                } else {
                    resolve(new Response(JSON.stringify({ error: "Failed to flush logs" }), { status: 500 }));
                }
            });
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
