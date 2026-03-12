import React, { useEffect, useState } from "react";

interface PerformanceFinding {
  audit_id: string;
  title: string;
  description: string;
  affected_pages: number;
  avg_score: number;
  pages: { id: number; url: string; score: number }[];
}

interface PerformanceInsightsProps {
  runId: string;
}

export default function PerformanceInsights({
  runId,
}: PerformanceInsightsProps) {
  const [findings, setFindings] = useState<PerformanceFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  const toggleExpand = (auditId: string) => {
    setExpandedAuditId(expandedAuditId === auditId ? null : auditId);
  };

  useEffect(() => {
    if (!runId) return;

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/runs/${runId}/performance`);
        if (!res.ok) throw new Error("Failed to fetch performance data");
        const data = await res.json();
        setFindings(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [runId]);

  if (loading)
    return (
      <div className="p-4 text-gray-500">Loading performance insights...</div>
    );
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;
  if (findings.length === 0)
    return (
      <div className="p-4 text-gray-500">
        No performance findings recorded for this run.
      </div>
    );

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden my-6">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h3 className="text-lg font-medium text-gray-900">
          Sitewide Performance Recommendations
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Aggregated from all pages in this scan. Fix these to improve overall
          site performance.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="w-8 px-6 py-3"></th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Recommendation
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Affected Pages
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Avg Score (Severity)
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {findings.map((finding) => (
              <React.Fragment key={finding.audit_id}>
                <tr
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => toggleExpand(finding.audit_id)}
                >
                  <td className="px-6 py-4">
                    <button className="text-gray-500 focus:outline-none">
                      {expandedAuditId === finding.audit_id ? (
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {finding.title}
                    </div>
                    <div
                      className="text-xs text-gray-500 mt-1 max-w-xl truncate"
                      title={finding.description}
                    >
                      {finding.description}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {finding.affected_pages}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          finding.avg_score < 0.5
                            ? "bg-red-100 text-red-800"
                            : finding.avg_score < 0.9
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-green-100 text-green-800"
                        }`}
                      >
                        {Math.round(finding.avg_score * 100)}
                      </span>
                    </div>
                  </td>
                </tr>
                {expandedAuditId === finding.audit_id && (
                  <tr className="bg-gray-50">
                    <td colSpan={4} className="px-6 py-4">
                      <div className="text-sm text-gray-700 bg-white p-4 rounded border border-gray-200 shadow-inner">
                        <h4 className="font-semibold mb-2 text-gray-900 border-b pb-1">
                          Affected Pages ({finding.pages.length})
                        </h4>
                        <ul className="space-y-1 max-h-60 overflow-y-auto">
                          {finding.pages.map((page) => (
                            <li
                              key={page.id}
                              className="flex justify-between items-center text-xs py-1 hover:bg-gray-50 px-2 rounded"
                            >
                              <a
                                href={`/url/${page.id}`}
                                className="text-blue-600 hover:text-blue-800 truncate flex-1 block"
                                title={page.url}
                              >
                                {page.url}
                              </a>
                              <span
                                className={`ml-2 px-1.5 py-0.5 rounded ${page.score < 0.5 ? "bg-red-100 text-red-800" : page.score < 0.9 ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}`}
                              >
                                Score: {Math.round(page.score * 100)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
