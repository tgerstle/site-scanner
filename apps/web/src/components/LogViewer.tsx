import React, { useEffect, useState } from "react";

export default function LogViewer() {
  const [logs, setLogs] = useState<any[]>([]);

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/logs");
      if (res.ok) {
        const data = await res.json();
        // Reverse logs to show newest first
        setLogs((data.logs || []).reverse());
      }
    } catch {}
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleFlush = async () => {
    try {
      await fetch("/api/flush-logs", { method: "POST" });
      setLogs([]);
    } catch {
      console.error(e);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg font-mono text-sm h-64 flex flex-col">
      <div className="flex justify-between items-center px-4 py-2 border-b border-gray-800 bg-gray-900 sticky top-0">
        <span className="text-gray-400 text-xs uppercase tracking-wider font-bold">
          Live Logs
        </span>
        <button
          onClick={handleFlush}
          className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded border border-gray-700 transition-colors"
        >
          Flush Logs
        </button>
      </div>

      <div className="overflow-y-auto p-4 flex-1">
        {logs.length === 0 ? (
          <div className="text-gray-500 italic text-xs">
            Waiting for logs...
          </div>
        ) : (
          logs.map((log, idx) => (
            <div key={idx} className="mb-1 text-xs">
              <span className="text-gray-500 mr-2 tabular-nums">
                [
                {log.timestamp
                  ? new Date(log.timestamp).toLocaleTimeString()
                  : ""}
                ]
              </span>
              <span
                className={`mr-2 font-bold ${log.severity === "error" ? "text-red-400" : log.severity === "warn" ? "text-amber-400" : "text-blue-400"}`}
              >
                {log.event?.toUpperCase()}
              </span>
              <span className="text-gray-300 break-words">
                {log.message || JSON.stringify(log)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
