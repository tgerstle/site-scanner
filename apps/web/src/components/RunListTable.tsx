import React, { useState } from "react";
import type { RunSummary } from "../types";
import { Trash2 } from "lucide-react";

function formatDistanceToNow(date: Date) {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

export default function RunListTable({
  runs: initialRuns,
}: {
  runs: RunSummary[];
}) {
  const [runs, setRuns] = useState(initialRuns);

  const handleDelete = async (runId: string, event: React.MouseEvent) => {
    event.preventDefault(); // Prevent navigation if button is inside a link (it isn't, but good practice)

    if (
      !window.confirm(
        "Are you sure you want to permanently delete this scan history? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/runs/${runId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setRuns((prev) => prev.filter((r) => r.id !== runId));
      } else {
        alert("Failed to delete run. Please try again.");
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("An error occurred while deleting the run.");
    }
  };

  if (runs.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500 bg-white rounded-lg border border-gray-100">
        No scan history found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Target
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Pages
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Violations
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Action
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {runs.map((run) => (
            <tr key={run.id} className="hover:bg-gray-50 group">
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    run.status === "completed"
                      ? "bg-green-100 text-green-800"
                      : run.status === "running"
                        ? "bg-yellow-100 text-yellow-800"
                        : run.status === "failed"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {run.status}
                </span>
              </td>
              <td
                className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate"
                title={run.config?.siteUrl || "Custom List"}
              >
                {run.config?.siteUrl || "Custom List"}
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {run.url_count}
              </td>
              <td className="px-6 py-4 text-sm text-red-600 font-medium">
                {run.violation_count}
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {run.started_at
                  ? formatDistanceToNow(new Date(run.started_at))
                  : "N/A"}
              </td>
              <td className="px-6 py-4 text-right text-sm flex justify-end gap-3 items-center">
                <a
                  href={`/runs/${run.id}`}
                  className="text-blue-600 hover:text-blue-900 font-medium"
                >
                  View Details
                </a>
                <button
                  onClick={(e) => handleDelete(run.id, e)}
                  className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-md hover:bg-red-50"
                  title="Delete Run"
                >
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
