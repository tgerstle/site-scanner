import React, { useState } from "react";

export default function RunWarnings({ alerts }: { alerts: any[] }) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-r shadow-sm">
      <div className="flex items-start">
        <div className="flex-shrink-0 pt-0.5">
          <svg
            className="h-5 w-5 text-yellow-400"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3 w-full">
          <h3 className="text-sm font-medium text-yellow-800">
            Run Adjustments & Warnings
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <ul className="space-y-3 list-none pl-0">
              {alerts.map((alert, i) => (
                <li key={alert.id || i} className="block">
                  <AlertItem alert={alert} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertItem({ alert }: { alert: any }) {
  const isDuplicate = alert.type === "duplicate_content";
  const [expanded, setExpanded] = useState(false);

  let details = null;
  try {
    if (alert.details_json) {
      details =
        typeof alert.details_json === "string"
          ? JSON.parse(alert.details_json)
          : alert.details_json;
    }
  } catch (e) {
    console.error("Failed to parse alert details", e);
  }

  if (!isDuplicate || !details || !Array.isArray(details)) {
    return <span>{alert.message}</span>;
  }

  return (
    <div>
      <div className="flex items-center flex-wrap gap-2">
        <span>{alert.message}</span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs uppercase tracking-wide font-bold text-yellow-800 bg-yellow-200 hover:bg-yellow-300 px-2 py-0.5 rounded transition-colors"
        >
          {expanded ? "Hide Details" : "View Details"}
        </button>
      </div>
      {expanded && (
        <div className="mt-3 bg-white border border-yellow-200 rounded p-4 text-gray-800 shadow-inner max-h-[500px] overflow-y-auto">
          <p className="text-xs text-gray-500 mb-3 italic">
            Below are groups of URLs that appear to be duplicates (e.g. trailing
            slashes, case sensitivity). Compare their scores to decide which
            version to canonicalize.
          </p>
          {details.map((group: any, idx: number) => (
            <div
              key={idx}
              className="mb-6 last:mb-0 border-b border-gray-100 last:border-0 pb-4 last:pb-0"
            >
              <div className="bg-gray-50 p-2 rounded mb-2 border border-gray-100">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-2">
                  Normalized Pattern:
                </span>
                <code className="text-xs font-mono text-blue-600">
                  {group.normalizedUrl}
                </code>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
                      <th className="py-2 px-3 font-medium">Variant URL</th>
                      <th
                        className="py-2 px-3 font-medium whitespace-nowrap"
                        title="Performance Score"
                      >
                        Perf
                      </th>
                      <th
                        className="py-2 px-3 font-medium whitespace-nowrap"
                        title="SEO Score"
                      >
                        SEO
                      </th>
                      <th
                        className="py-2 px-3 font-medium whitespace-nowrap"
                        title="Accessibility Violations"
                      >
                        A11y
                      </th>
                      <th className="py-2 px-3 font-medium whitespace-nowrap">
                        Redirects To
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {group.variants.map((v: any, vIdx: number) => {
                      const isBest = vIdx === 0 && v.score > 0; // Sorted by perf desc in backend
                      return (
                        <tr
                          key={vIdx}
                          className={`hover:bg-gray-50 ${isBest ? "bg-green-50/30" : ""}`}
                        >
                          <td className="py-2 px-3 break-all font-mono text-gray-700">
                            <a
                              href={v.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {v.url}
                            </a>
                            {isBest && (
                              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">
                                Best Perf
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {v.score !== undefined ? (
                              <span
                                className={`inline-block w-8 text-center rounded px-1 ${
                                  v.score >= 0.9
                                    ? "bg-green-100 text-green-800"
                                    : v.score >= 0.5
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-red-100 text-red-800"
                                }`}
                              >
                                {Math.round(v.score * 100)}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {v.seo !== undefined && v.seo !== null ? (
                              <span
                                className={`font-medium ${v.seo >= 0.9 ? "text-green-600" : "text-orange-600"}`}
                              >
                                {Math.round(v.seo * 100)}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="py-2 px-3 text-gray-600">
                            {v.a11y !== undefined ? v.a11y : "-"}
                          </td>
                          <td className="py-2 px-3 text-gray-500 italic max-w-xs truncate">
                            {v.redirect ? (
                              <span className="text-purple-600 flex items-center gap-1">
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                                  />
                                </svg>
                                {v.redirect}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
