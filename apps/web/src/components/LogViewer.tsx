import React, { useEffect, useState } from "react";

export default function LogViewer() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch("/api/logs");
        if (res.ok) {
          const data = await res.json();
          // Reverse logs to show newest first
          setLogs((data.logs || []).reverse());
        }
      } catch (err) {}
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 font-mono text-sm h-64 overflow-y-auto">
      {logs.length === 0 ? (
        <div className="text-gray-500">Waiting for logs...</div>
      ) : (
        logs.map((log, idx) => (
          <div key={idx} className="mb-1">
            <span className="text-gray-500 mr-3">
              [
              {log.timestamp
                ? new Date(log.timestamp).toLocaleTimeString()
                : ""}
              ]
            </span>
            <span
              className={`mr-2 ${log.severity === "error" ? "text-red-400" : log.severity === "warn" ? "text-yellow-400" : "text-blue-400"}`}
            >
              {log.event?.toUpperCase()}
            </span>
            <span className="text-gray-300">
              {log.message || JSON.stringify(log)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
