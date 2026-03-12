import type { APIRoute } from "astro";
import * as fs from "node:fs";
import * as path from "node:path";

export const GET: APIRoute = async () => {
  try {
    let logPath = process.env.AWA_DB_PATH
      ? path.join(path.dirname(process.env.AWA_DB_PATH), "scanner_run.log")
      : path.resolve(process.cwd(), "../../scanner_run.log");

    if (!fs.existsSync(logPath)) {
      // fallback for when running inside node directly or dev server
      logPath = path.resolve(process.cwd(), "scanner_run.log");
    }

    if (!fs.existsSync(logPath)) {
      return new Response(JSON.stringify({ logs: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Read last 100 lines
    const fileContent = fs.readFileSync(logPath, "utf-8");
    const lines = fileContent.trim().split("\n").filter(Boolean);
    const tail = lines.slice(-100);

    const logs = tail.map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { message: line };
      }
    });

    return new Response(JSON.stringify({ logs }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
