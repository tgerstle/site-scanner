import React from "react";
import type { DashboardStats, QueueItem, RecentItem } from "../types/index.ts";
import QueueTable from "./QueueTable";
import RunTrigger from "./RunTrigger";
import LogViewer from "./LogViewer";
import { useDashboard } from "../hooks/useDashboard";

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
                Total Violations
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
