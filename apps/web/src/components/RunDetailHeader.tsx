import React from "react";
import type { RunDetail } from "../types";

export default function RunDetailHeader({ run }: { run: RunDetail }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Run Report{" "}
            <span className="text-gray-500 text-lg font-normal">
              #{run.id.slice(-6)}
            </span>
          </h1>
          <p className="text-sm text-gray-500 flex gap-4">
            <span>Started {new Date(run.started_at).toLocaleString()}</span>
            {run.completed_at && (
              <span className="text-gray-400">
                Duration:{" "}
                {(() => {
                  const ms =
                    new Date(run.completed_at).getTime() -
                    new Date(run.started_at).getTime();
                  const s = Math.floor(ms / 1000);
                  const m = Math.floor(s / 60);
                  return `${m}m ${s % 60}s`;
                })()}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div
            className={`px-3 py-1 rounded-full text-sm font-semibold 
            ${
              run.status === "completed"
                ? "bg-green-100 text-green-800"
                : run.status === "running"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-gray-100 text-gray-800"
            }`}
          >
            {run.status.toUpperCase()}
          </div>

          <a
            href={`/api/runs/${run.id}/export?format=csv`}
            target="_blank"
            className="px-3 py-1 bg-white border border-gray-300 rounded text-sm font-medium hover:bg-gray-50"
          >
            Export CSV
          </a>
          <a
            href={`/api/runs/${run.id}/export?format=json`}
            target="_blank"
            className="px-3 py-1 bg-white border border-gray-300 rounded text-sm font-medium hover:bg-gray-50"
          >
            Export JSON
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-center divide-x divide-gray-100">
        <div className="p-2">
          <p className="text-xs font-medium text-gray-500 uppercase">Target</p>
          <p
            className="text-lg font-medium text-gray-900 truncate"
            title={run.config?.siteUrl}
          >
            {run.config?.siteUrl || "Custom List"}
          </p>
        </div>
        <div className="p-2">
          <p className="text-xs font-medium text-gray-500 uppercase">
            Total Pages
          </p>
          <p className="text-2xl font-bold text-gray-800">{run.url_count}</p>
        </div>
        <div className="p-2">
          <p className="text-xs font-medium text-gray-500 uppercase">
            Total A11y Violations
          </p>
          <p className="text-2xl font-bold text-red-600">
            {run.violation_count}
          </p>
        </div>
        <div className="p-2">
          <p className="text-xs font-medium text-gray-500 uppercase">
            Avg Issues/Page
          </p>
          <p className="text-2xl font-bold text-gray-800">
            {run.url_count > 0
              ? (run.violation_count / run.url_count).toFixed(1)
              : 0}
          </p>
        </div>
      </div>

      {run.avg_performance_score !== undefined && (
        <div className="mt-6 border-t border-gray-100 pt-4">
          <h3 className="text-sm font-medium text-gray-900 mb-4 px-1">
            Average Scores (Lighthouse)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Performance", value: run.avg_performance_score },
              { label: "Accessibility", value: run.avg_accessibility_score },
              { label: "Best Practices", value: run.avg_best_practices_score },
              { label: "SEO", value: run.avg_seo_score },
            ].map((score) => {
              const hasValue = score.value !== undefined;
              const displayValue = hasValue
                ? Math.round(score.value! * 100)
                : "-";
              let colorClass = "text-gray-400";
              if (hasValue) {
                if (score.value! >= 0.9) colorClass = "text-green-600";
                else if (score.value! >= 0.5) colorClass = "text-yellow-600";
                else colorClass = "text-red-600";
              }

              return (
                <div
                  key={score.label}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex flex-col items-center justify-center relative overflow-hidden group hover:border-blue-200 transition-colors"
                >
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {score.label}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-3xl font-bold ${colorClass}`}>
                      {displayValue}
                    </span>
                    {hasValue && (
                      <span className="text-gray-400 text-sm font-medium">
                        / 100
                      </span>
                    )}
                  </div>
                  {/* Gauge Background (Optional Visual Flair) */}
                  <div
                    className="absolute bottom-0 left-0 h-1 bg-current opacity-20 w-full"
                    style={{
                      width: hasValue ? `${score.value! * 100}%` : "0%",
                      backgroundColor: hasValue
                        ? score.value! >= 0.9
                          ? "#16a34a"
                          : score.value! >= 0.5
                            ? "#ca8a04"
                            : "#dc2626"
                        : "transparent",
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
