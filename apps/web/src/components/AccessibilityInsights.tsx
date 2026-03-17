// apps/web/src/components/AccessibilityInsights.tsx
import React, { useState, useEffect } from "react";
import type { CommonA11yIssue } from "../types";

// Helper component for descriptions
const Description = ({ text }: { text?: string }) => {
  if (!text) return null;
  const parts = text.split(/(\[.*?\]\(.*?\))/g);
  return (
    <div className="text-gray-600 text-xs mt-1">
      {parts.map((part, i) => {
        const match = part.match(/\[(.*?)\]\((.*?)\)/);
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
        return part;
      })}
    </div>
  );
};

interface InsightsProps {
  runId: string;
}

export default function AccessibilityInsights({ runId }: InsightsProps) {
  const [issues, setIssues] = useState<CommonA11yIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIssueRule, setExpandedIssueRule] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!runId) return;

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/runs/${runId}/accessibility`);
        if (!res.ok) throw new Error("Failed to fetch accessibility insights");
        const data = await res.json();
        setIssues(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [runId]);

  const toggleExpand = (ruleId: string) => {
    if (expandedIssueRule === ruleId) {
      setExpandedIssueRule(null);
    } else {
      setExpandedIssueRule(ruleId);
    }
  };

  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case "critical":
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Critical
          </span>
        );
      case "serious":
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            Serious
          </span>
        );
      case "moderate":
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Moderate
          </span>
        );
      case "minor":
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Minor
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {impact}
          </span>
        );
    }
  };

  if (loading)
    return (
      <div className="p-4 text-gray-500">Loading accessibility insights...</div>
    );
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden mb-8">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          Sitewide Accessibility Opportunities
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Common accessibility violations aggregated across all scanned pages.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10"
              >
                {/* Expander */}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Impact
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Rule / Description
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Frequency
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {issues.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  No accessibility issues found across the scanned pages.
                </td>
              </tr>
            ) : (
              issues.map((issue) => (
                <React.Fragment key={issue.rule_id}>
                  <tr
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => toggleExpand(issue.rule_id)}
                  >
                    <td className="px-6 py-4">
                      <button className="text-gray-500 focus:outline-none">
                        {expandedIssueRule === issue.rule_id ? (
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getImpactBadge(issue.impact)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {issue.help}
                        {issue.helpUrl && (
                          <a
                            href={issue.helpUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-xs text-blue-500 hover:text-blue-700"
                            onClick={(e) => e.stopPropagation()}
                          >
                            (Learn more)
                          </a>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {issue.description}
                      </div>
                      <div className="text-xs text-gray-400 font-mono mt-1">
                        Rule ID: {issue.rule_id}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <span className="font-semibold text-gray-900">
                        {issue.affected_pages_count}
                      </span>{" "}
                      pages
                      <span className="text-xs text-gray-400 block">
                        ({issue.total_instances} total instances)
                      </span>
                    </td>
                  </tr>
                  {expandedIssueRule === issue.rule_id && (
                    <tr className="bg-gray-50">
                      <td colSpan={4} className="px-6 py-4">
                        <div className="text-sm text-gray-700 bg-white p-4 rounded border border-gray-200 shadow-inner">
                          <h4 className="font-semibold mb-2 text-gray-900 border-b pb-1">
                            Affected Pages ({issue.affected_pages_count})
                          </h4>
                          <ul className="space-y-1 max-h-60 overflow-y-auto">
                            {issue.pages.slice(0, 100).map((page, idx) => (
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
                                <span className="text-gray-500 ml-2 whitespace-nowrap">
                                  {page.count} instances
                                </span>
                              </li>
                            ))}
                            {issue.pages.length > 100 && (
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
