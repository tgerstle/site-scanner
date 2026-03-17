import React, { useState } from "react";

export default function ViolationList({
  violations = [],
}: {
  violations: any[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!violations || violations.length === 0) {
    return (
      <div className="text-gray-500 italic p-4 border rounded bg-gray-50">
        No violations found. Awesome!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {violations.map((v, i) => {
        const ruleId = v.rule_id || v.id;
        const isExpanded = expandedId === ruleId;
        const nodeCount = v.nodes?.length || 0;

        return (
          <div
            key={i}
            className="bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden"
          >
            {/* Header */}
            <div
              className="p-4 bg-gray-50 flex justify-between items-start cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => setExpandedId(isExpanded ? null : ruleId)}
            >
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-gray-900">{ruleId}</h4>
                  <span
                    className={`text-xs px-2 py-0.5 rounded uppercase font-medium tracking-wide ${
                      v.impact === "critical" || v.impact === "serious"
                        ? "bg-red-100 text-red-800"
                        : v.impact === "moderate"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {v.impact}
                  </span>
                </div>

                <p className="mt-1 text-sm text-gray-600 font-medium">
                  {v.help}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {nodeCount} occurrences found on this page
                </p>
              </div>
              <button className="text-gray-400">
                {isExpanded ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 15l7-7 7 7"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7 7"
                    />
                  </svg>
                )}
              </button>
            </div>

            {/* Expanded Details */}
            {isExpanded && v.nodes && v.nodes.length > 0 && (
              <div className="border-t border-gray-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 table-fixed">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-1/2">
                          Element (Target)
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-1/2">
                          Issue & Fix
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {v.nodes.map((node: any, nIdx: number) => (
                        <tr key={nIdx}>
                          <td className="px-4 py-3 text-sm font-mono text-gray-600 align-top break-all">
                            <div className="bg-gray-100 p-2 rounded text-xs mb-2 border border-gray-200">
                              {node.target &&
                                (Array.isArray(node.target)
                                  ? node.target.join(" > ")
                                  : node.target)}
                            </div>
                            {node.html && (
                              <div className="text-xs text-gray-500 border-l-2 border-blue-200 pl-2 italic">
                                {node.html}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 align-top">
                            {node.failureSummary && (
                              <div className="text-xs bg-red-50 p-2 rounded border border-red-100 text-red-900">
                                <span className="font-bold block mb-1">
                                  Fix Required:
                                </span>
                                <p className="whitespace-pre-wrap leading-relaxed">
                                  {node.failureSummary}
                                </p>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-3 bg-gray-50 text-right border-t border-gray-100">
                  {v.helpUrl && (
                    <a
                      href={v.helpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline font-medium"
                    >
                      Read full documentation for {ruleId} &rarr;
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
