import React from "react";

export default function ViolationViewer({
  violations,
  url,
}: {
  violations: any[];
  url: string;
}) {
  // If violations is null or not array, handle gracefully
  const findings = Array.isArray(violations) ? violations : [];

  if (findings.length === 0) {
    return (
      <div className="p-12 text-center bg-white rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          No Violations Found
        </h2>
        <p className="text-gray-500 mb-4">
          This page passed all configured accessibility checks.
        </p>
        <p className="text-sm font-mono bg-gray-50 inline-block px-3 py-1 rounded text-gray-600">
          {url}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h1 className="text-xl font-bold text-gray-900 mb-2 break-all">
          Violation Report
        </h1>
        <div className="text-sm font-mono text-gray-600 bg-gray-50 p-2 rounded mb-4 break-all">
          {url}
        </div>
        <p className="text-sm text-gray-500">
          Found{" "}
          <span className="font-bold text-red-600">{findings.length}</span>{" "}
          types of violations.
        </p>
      </div>

      {findings.map((v: any, idx: number) => (
        <div
          key={idx}
          className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
        >
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-md font-bold text-gray-800 flex items-center gap-2">
                {v.id}
                <span
                  className={`px-2 py-0.5 rounded text-xs uppercase font-bold
                  ${
                    v.impact === "critical"
                      ? "bg-red-800 text-white"
                      : v.impact === "serious"
                        ? "bg-red-600 text-white"
                        : v.impact === "moderate"
                          ? "bg-yellow-500 text-white"
                          : "bg-blue-500 text-white"
                  }`}
                >
                  {v.impact}
                </span>
              </h3>
              <p className="text-sm text-gray-600 mt-1">{v.description}</p>
            </div>
            {v.helpUrl && (
              <a
                href={v.helpUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-blue-600 hover:underline shrink-0"
              >
                Remediation Guide &rarr;
              </a>
            )}
          </div>

          <div className="p-6">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
              Failing Elements ({v.nodes?.length || 0})
            </h4>
            <div className="space-y-6">
              {v.nodes?.map((node: any, nIdx: number) => (
                <div
                  key={nIdx}
                  className="bg-white border border-gray-200 rounded-lg p-4 font-mono text-xs shadow-sm"
                >
                  <div className="mb-3 flex gap-2">
                    <span className="font-bold text-gray-500 uppercase tracking-widest text-[10px] w-16 shrink-0 pt-0.5">
                      Selector
                    </span>
                    <code className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded break-all">
                      {node.target && node.target.join(", ")}
                    </code>
                  </div>

                  <div className="mb-3 flex gap-2">
                    <span className="font-bold text-gray-500 uppercase tracking-widest text-[10px] w-16 shrink-0 pt-0.5">
                      Snippet
                    </span>
                    <div className="bg-gray-800 text-gray-100 p-3 rounded w-full overflow-x-auto whitespace-pre-wrap">
                      {node.html}
                    </div>
                  </div>

                  {node.failureSummary && (
                    <div className="flex gap-2">
                      <span className="font-bold text-gray-500 uppercase tracking-widest text-[10px] w-16 shrink-0 pt-0.5">
                        Fix
                      </span>
                      <div className="text-gray-700 whitespace-pre-wrap bg-yellow-50 p-2 rounded w-full border border-yellow-100">
                        {node.failureSummary}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
