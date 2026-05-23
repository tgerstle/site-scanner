import React, { useEffect, useState } from "react";

interface PerformanceFinding {
  audit_id: string;
  title: string;
  description: string;
  affected_pages: number;
  avg_score: number;
  pages: { id: number; url: string; score: number }[];
}

interface CommonIssue {
  hash: string;
  audit_id: string;
  title: string;
  description: string;
  identifier: string;
  identifierType: "url" | "node" | "text";
  count: number;
  potentialSavingsBytes: number;
  potentialSavingsMs: number;
  pages: string[]; // JSON stringified {id, url, wastedBytes?, wastedMs?}
}

interface PerformanceInsightsProps {
  runId: string;
}

const Description = ({ text }: { text?: string }) => {
  const [expanded, setExpanded] = useState(false);

  if (!text) return null;

  // Parse markdown links [label](url)
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  const content = parts.map((part, i) => {
    const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (match) {
      return (
        <a
          key={i}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {match[1]}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });

  return (
    <div
      className={`text-xs text-gray-500 mt-1 max-w-xl cursor-pointer ${
        expanded ? "" : "line-clamp-2 overflow-hidden"
      }`}
      onClick={(e) => {
        e.stopPropagation();
        setExpanded(!expanded);
      }}
      title={expanded ? "Click to collapse" : "Click to read more"}
    >
      {content}
    </div>
  );
};

export default function PerformanceInsights({
  runId,
}: PerformanceInsightsProps) {
  const [findings, setFindings] = useState<PerformanceFinding[]>([]);
  const [commonIssues, setCommonIssues] = useState<CommonIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"audit_type" | "common_resource">(
    "common_resource",
  );

  const [expandedCommonIssueHash, setExpandedCommonIssueHash] = useState<
    string | null
  >(null);

  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  const toggleCommonIssueExpand = (hash: string) => {
    setExpandedCommonIssueHash(expandedCommonIssueHash === hash ? null : hash);
  };

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

        if (Array.isArray(data)) {
          setFindings(data);
        } else {
          setFindings(data.findings || []);
          setCommonIssues(data.commonIssues || []);
          // Default to common issues if there are any, else audits
          if (data.commonIssues?.length > 0) setView("common_resource");
          else setView("audit_type");
        }
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
  if (findings.length === 0 && commonIssues.length === 0)
    return (
      <div className="p-4 text-gray-500">
        No performance findings recorded for this run.
      </div>
    );

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden my-6">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            Sitewide Performance Recommendations
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Aggregated insights from all pages. Fix these to improve overall
            site performance.
          </p>
        </div>

        <div className="flex bg-gray-200 p-1 rounded-lg text-sm font-medium">
          <button
            onClick={() => setView("common_resource")}
            className={`px-3 py-1.5 rounded-md transition-colors ${view === "common_resource" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}
          >
            Common Offenders
          </button>
          <button
            onClick={() => setView("audit_type")}
            className={`px-3 py-1.5 rounded-md transition-colors ${view === "audit_type" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}
          >
            By Audit Type
          </button>
        </div>
      </div>

      {view === "audit_type" ? (
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
                      <Description text={finding.description} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {finding.affected_pages}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            (finding.avg_score || 0) < 0.5
                              ? "bg-red-100 text-red-800"
                              : (finding.avg_score || 0) < 0.9
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-green-100 text-green-800"
                          }`}
                        >
                          {Math.round((finding.avg_score || 0) * 100)}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {expandedAuditId === finding.audit_id && (
                    <tr className="bg-gray-50">
                      <td colSpan={4} className="px-6 py-4">
                        <div className="text-sm text-gray-700 bg-white p-4 rounded border border-gray-200 shadow-inner">
                          <h4 className="font-semibold mb-2 text-gray-900 border-b pb-1">
                            Affected Pages (
                            {finding.pages ? finding.pages.length : 0})
                          </h4>
                          <ul className="space-y-1 max-h-60 overflow-y-auto">
                            {(finding.pages || []).map((page, idx) => (
                              <li
                                key={page.id || idx}
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
                                  className={`ml-2 px-1.5 py-0.5 rounded ${
                                    (page.score || 0) < 0.5
                                      ? "bg-red-100 text-red-800"
                                      : (page.score || 0) < 0.9
                                        ? "bg-yellow-100 text-yellow-800"
                                        : "bg-green-100 text-green-800"
                                  }`}
                                >
                                  Score: {Math.round((page.score || 0) * 100)}
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
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="w-10 px-6 py-3"></th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Problem Resource / Element
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Issue Type
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Frequency
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Wasted
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {commonIssues.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    No common resource patterns found.
                  </td>
                </tr>
              ) : (
                commonIssues.map((issue) => {
                  const uniquePageCount = new Set(
                    issue.pages.map((p) => {
                      try {
                        return JSON.parse(p).url;
                      } catch {
                        return null;
                      }
                    }),
                  ).size;

                  return (
                    <React.Fragment key={issue.hash}>
                      <tr
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleCommonIssueExpand(issue.hash)}
                      >
                        <td className="px-6 py-4">
                          <button className="text-gray-500 focus:outline-none">
                            {expandedCommonIssueHash === issue.hash ? (
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
                          {issue.identifierType === "url" ? (
                            <a
                              href={issue.identifier}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline break-all block max-w-lg"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {issue.identifier}
                            </a>
                          ) : (
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded text-pink-600 font-mono break-all block max-w-lg">
                              {issue.identifier}
                            </code>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                          {issue.title}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                          <span className="font-semibold text-gray-900">
                            {uniquePageCount}
                          </span>{" "}
                          pages
                          <span className="text-xs text-gray-400 block">
                            ({issue.count} instances)
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {issue.potentialSavingsBytes > 0 && (
                            <div className="text-red-600 font-medium">
                              {Math.round(issue.potentialSavingsBytes / 1024)}{" "}
                              KB
                            </div>
                          )}
                          {issue.potentialSavingsMs > 0 && (
                            <div className="text-orange-600 font-medium">
                              {Math.round(issue.potentialSavingsMs)} ms
                            </div>
                          )}
                        </td>
                      </tr>
                      {expandedCommonIssueHash === issue.hash && (
                        <tr className="bg-gray-50">
                          <td colSpan={5} className="px-6 py-4">
                            <div className="text-sm text-gray-700 bg-white p-4 rounded border border-gray-200 shadow-inner">
                              <h4 className="font-semibold mb-2 text-gray-900 border-b pb-1">
                                Affected Pages ({uniquePageCount})
                              </h4>
                              {issue.description && (
                                <div className="mb-3 text-gray-600 bg-blue-50 p-2 rounded text-xs border border-blue-100">
                                  <Description text={issue.description} />
                                </div>
                              )}

                              <div className="mb-4">
                                <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                  {issue.identifierType === "url"
                                    ? "Full Resource URL"
                                    : "Element / Snippet"}
                                </h5>
                                <div className="bg-gray-100 p-2 rounded text-xs font-mono break-all border border-gray-200 text-gray-800 whitespace-pre-wrap">
                                  {issue.identifier}
                                </div>
                              </div>

                              <ul className="space-y-1 max-h-60 overflow-y-auto">
                                {issue.pages &&
                                  issue.pages
                                    .slice(0, 100)
                                    .map((pageStr, idx) => {
                                      try {
                                        const page = JSON.parse(pageStr);
                                        return (
                                          <li
                                            key={idx}
                                            className="flex justify-between items-center text-xs py-1 hover:bg-gray-50 px-2 rounded"
                                          >
                                            <a
                                              href={`/url/${page.id}`}
                                              className="text-blue-600 hover:text-blue-800 truncate flex-1 block"
                                              title={page.url}
                                            >
                                              {page.url}
                                            </a>
                                            {(page.wastedBytes > 0 ||
                                              page.wastedMs > 0) && (
                                              <span className="text-gray-500 ml-2 whitespace-nowrap">
                                                {page.wastedBytes > 0 &&
                                                  `${Math.round(page.wastedBytes / 1024)} KB`}
                                                {page.wastedBytes > 0 &&
                                                  page.wastedMs > 0 &&
                                                  ", "}
                                                {page.wastedMs > 0 &&
                                                  `${Math.round(page.wastedMs)} ms`}
                                              </span>
                                            )}
                                          </li>
                                        );
                                      } catch {
                                        return null;
                                      }
                                    })}
                                {issue.pages && issue.pages.length > 100 && (
                                  <li className="text-xs text-gray-500 italic p-2 border-t mt-1 text-center bg-gray-50">
                                    And {issue.pages.length - 100} more pages...
                                  </li>
                                )}
                              </ul>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
