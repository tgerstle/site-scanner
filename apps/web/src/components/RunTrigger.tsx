import React, { useState } from "react";

export default function RunTrigger() {
  const [mode, setMode] = useState<"single" | "list">("single");
  const [url, setUrl] = useState("https://example.com");
  const [urlList, setUrlList] = useState("");
  const [depth, setDepth] = useState<number | "">("");
  const [plugins, setPlugins] = useState<string[]>(["axe", "lighthouse"]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const triggerRun = async () => {
    setLoading(true);
    setMessage("");

    const payload =
      mode === "single"
        ? { url, depth, plugins }
        : {
            urls: urlList
              .split(/[\n,]+/)
              .map((u) => u.trim())
              .filter(Boolean),
            depth,
            plugins,
          };

    if (mode === "list" && (payload as any).urls.length === 0) {
      setMessage("Please enter at least one URL");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Run started safely (ID: ${data.runId})`);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    }
    setLoading(false);
  };

  const stopAllRuns = async () => {
    if (!confirm("Are you sure you want to stop all active scans?")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/stop", { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        setMessage(data.message || "All runs stopped successfully");
      } else {
        setMessage(`Failed: ${data.message || data.error || "Unknown error"}`);
      }
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="bg-white p-4 rounded shadow-sm border border-gray-200">
      <div className="flex gap-4 mb-4">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="radio"
            name="mode"
            checked={mode === "single"}
            onChange={() => setMode("single")}
            className="w-4 h-4 text-blue-600"
          />
          <span className="text-gray-700 font-medium">Single URL Crawl</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="radio"
            name="mode"
            checked={mode === "list"}
            onChange={() => setMode("list")}
            className="w-4 h-4 text-blue-600"
          />
          <span className="text-gray-700 font-medium">
            List of URLs (Audit Only)
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-4">
        {mode === "single" ? (
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="px-3 py-2 border rounded w-full max-w-lg outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://example.com"
          />
        ) : (
          <div className="w-full max-w-lg">
            <textarea
              value={urlList}
              onChange={(e) => setUrlList(e.target.value)}
              className="px-3 py-2 border rounded w-full h-32 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              placeholder={`https://example.com/page1\nhttps://example.com/page2`}
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter URLs one per line or comma separated
            </p>
          </div>
        )}

        <div className="bg-gray-50 p-3 rounded border border-gray-200 text-sm max-w-lg">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <label className="font-medium text-gray-700 w-24">
                Max Depth:
              </label>
              <input
                type="number"
                min="0"
                max="10"
                value={depth}
                onChange={(e) =>
                  setDepth(
                    e.target.value === "" ? "" : parseInt(e.target.value),
                  )
                }
                placeholder={mode === "list" ? "0 (Audit Only)" : "3"}
                className="px-2 py-1 border rounded w-32"
              />
            </div>
            <div className="flex items-start gap-2 pt-1">
              <label className="font-medium text-gray-700 w-24 pt-0.5">
                Plugins:
              </label>
              <div className="flex gap-4">
                {["axe", "lighthouse"].map((p) => (
                  <label
                    key={p}
                    className="flex items-center gap-1 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={plugins.includes(p)}
                      onChange={(e) => {
                        if (e.target.checked) setPlugins([...plugins, p]);
                        else setPlugins(plugins.filter((x) => x !== p));
                      }}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="capitalize">{p}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={triggerRun}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded transition-colors"
          >
            {loading
              ? "Processing..."
              : mode === "single"
                ? "Start Crawl"
                : "Audit List"}
          </button>

          <button
            onClick={stopAllRuns}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded transition-colors ml-auto"
          >
            Stop All Scans
          </button>

          <button
            onClick={async () => {
              if (
                !confirm(
                  "Are you sure you want to WIPE THE DATABASE? This cannot be undone.",
                )
              )
                return;
              setLoading(true);
              try {
                const res = await fetch("/api/reset", { method: "POST" });
                const data = await res.json();
                if (res.ok) {
                  setMessage(data.message);
                  setTimeout(() => window.location.reload(), 1000);
                } else {
                  setMessage(
                    `Failed: ${data.message || data.error || "Unknown error"}`,
                  );
                }
              } catch (err: any) {
                setMessage(`Error: ${err.message}`);
              }
              setLoading(false);
            }}
            disabled={loading}
            className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded transition-colors ml-2"
            title="Delete all data"
          >
            Wipe DB
          </button>
        </div>

        {message && (
          <div className="text-sm text-gray-700 p-2 bg-gray-50 rounded border border-gray-100">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
