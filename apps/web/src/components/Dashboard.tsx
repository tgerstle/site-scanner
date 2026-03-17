import React, { useEffect, useState } from "react";
import type { DashboardStats, QueueItem, RecentItem } from "../types/index.ts";
import QueueTable from "./QueueTable";
import RunTrigger from "./RunTrigger";
import LogViewer from "./LogViewer";
import { useDashboard } from "../hooks/useDashboard";

function formatDuration(start: string, end?: string) {
  const now = end ? new Date(end).getTime() : Date.now();
  const startTime = new Date(start).getTime();
  const ms = Math.max(0, now - startTime);

  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);

  const rs = s % 60;
  const rm = m % 60;

  if (h > 0) return `${h}h ${rm}m ${rs}s`;
  if (m > 0) return `${m}m ${rs}s`;
  return `${rs}s`;
}

function RunTimer({
  start,
  end,
  status,
}: {
  start: string;
  end?: string;
  status: string;
}) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const update = () => {
      const isDone = ["completed", "stopped", "failed"].includes(status);
      setElapsed(formatDuration(start, isDone ? end : undefined));
    };

    update();
    if (!["completed", "stopped", "failed"].includes(status)) {
      const i = setInterval(update, 1000);
      return () => clearInterval(i);
    }
  }, [start, end, status]);

  return (
    <span className="font-mono text-gray-500 tabular-nums text-sm bg-gray-50 px-2 rounded border border-gray-100">
      Duration: {elapsed}
    </span>
  );
}

export default function Dashboard({
  initialStats,
  initialRecentUrls,
  initialQueue,
}: {
  initialStats: DashboardStats;
  initialRecentUrls: RecentItem[];
  initialQueue: QueueItem[];
}) {
  const { stats, recentUrls, queue } = useDashboard({
    stats: initialStats,
    recentUrls: initialRecentUrls,
    queue: initialQueue,
  });

  const handleStopRun = async (runId: string) => {
    if (!confirm("Are you sure you want to stop this scan?")) return;
    try {
      const res = await fetch(`/api/runs/${runId}/stop`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(`Failed to stop run: ${data.message || data.error}`);
      } else {
        // Optimistically update UI or just wait for re-fetch
      }
    } catch (err: any) {
      console.error(err);
      alert("Error stopping run");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow border border-gray-100 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Start New Scan
        </h2>
        <RunTrigger />
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          System Runner Logs
        </h2>
        <LogViewer />
      </div>

      {(Array.isArray(stats) ? stats : []).map((runStats) => (
        <div
          key={runStats.runId}
          className="mb-8 border-t border-gray-100 pt-6 first:border-0 first:pt-0"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                Run:{" "}
                <span
                  title={runStats.runId}
                  className="font-mono text-sm bg-gray-100 px-2 py-1 rounded select-all border border-gray-200"
                >
                  {runStats.runId.split("_").pop() || runStats.runId}
                </span>
              </h3>
              <span
                className={`text-xs px-2 py-1 rounded-full uppercase font-bold tracking-wider ${
                  runStats.status === "running"
                    ? "bg-blue-100 text-blue-800"
                    : runStats.status === "completed"
                      ? "bg-green-100 text-green-800"
                      : runStats.status === "failed"
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-800"
                }`}
              >
                {runStats.status}
              </span>
              {["running", "pending"].includes(runStats.status) && (
                <button
                  onClick={() => handleStopRun(runStats.runId)}
                  className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors font-medium ml-2"
                  title="Force Stop This Scan"
                >
                  Stop
                </button>
              )}
            </div>

            <div className="hidden sm:block w-px h-5 bg-gray-300"></div>

            <div className="flex items-center gap-4 text-sm text-gray-600 flex-1 min-w-0">
              <span
                className="whitespace-nowrap"
                title={new Date(runStats.created_at).toLocaleString()}
              >
                {new Date(runStats.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <div className="hidden sm:block w-px h-5 bg-gray-300"></div>
              <RunTimer
                start={runStats.created_at}
                end={runStats.completed_at}
                status={runStats.status}
              />
              <div className="hidden sm:block w-px h-5 bg-gray-300"></div>
              <span
                className="truncate font-medium text-gray-800"
                title={runStats.url}
              >
                {runStats.url}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
              <h3 className="text-sm font-medium text-gray-500">Total Found</h3>
              <p className="text-3xl font-semibold mt-2 text-gray-800">
                {runStats.totalUrls || 0}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
              <h3 className="text-sm font-medium text-gray-500">
                Pending Setup
              </h3>
              <p className="text-3xl font-semibold mt-2 text-yellow-600">
                {runStats.pendingUrls || 0}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
              <h3 className="text-sm font-medium text-gray-500">Completed</h3>
              <p className="text-3xl font-semibold mt-2 text-green-600">
                {runStats.completedUrls || 0}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
              <h3 className="text-sm font-medium text-gray-500">Stopped</h3>
              <p className="text-3xl font-semibold mt-2 text-gray-400">
                {runStats.stoppedUrls || 0}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
              <h3 className="text-sm font-medium text-gray-500">Failed</h3>
              <p className="text-3xl font-semibold mt-2 text-red-600">
                {runStats.failedUrls || 0}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
              <h3 className="text-sm font-medium text-gray-500">
                Total A11y Violations
              </h3>
              <p className="text-3xl font-semibold mt-2 text-red-800">
                {runStats.totalViolations || 0}
              </p>
            </div>
          </div>
        </div>
      ))}

      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Current Queue</h2>
        <QueueTable items={queue} maxHeight="24rem" />
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          Top URLs (By Violations)
        </h2>
        <QueueTable items={recentUrls} />
      </div>
    </div>
  );
}
