import React, { useState, useEffect, useMemo } from "react";
import type { PageSummary } from "../types";
import SeoDetailsViewer from "./SeoDetailsViewer";

interface PageResultTableProps {
  pages: PageSummary[];
  runId: string;
}

export default function PageResultTable({
  pages,
  runId,
}: PageResultTableProps) {
  const [data, setData] = useState(pages);

  useEffect(() => {
    setData(pages);
  }, [pages]);

  const [isSortedAsc, setIsSortedAsc] = useState(false);
  const [sortBy, setSortBy] = useState<keyof PageSummary>("violation_count");
  const [filterText, setFilterText] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const handleSort = (key: keyof PageSummary) => {
    const isAsc = sortBy === key ? !isSortedAsc : true;
    setSortBy(key);
    setIsSortedAsc(isAsc);
  };

  const processedData = useMemo(() => {
    // 1. Filter
    let result = data.filter(
      (page) =>
        page.url.toLowerCase().includes(filterText.toLowerCase()) ||
        page.status.toLowerCase().includes(filterText.toLowerCase()),
    );

    // 2. Sort
    result = result.sort((a, b) => {
      let valA = a[sortBy] as any;
      let valB = b[sortBy] as any;

      // Handle null/undef
      if (valA == null) valA = "";
      if (valB == null) valB = "";

      if (valA < valB) return isSortedAsc ? -1 : 1;
      if (valA > valB) return isSortedAsc ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, filterText, sortBy, isSortedAsc]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-[calc(100vh-12rem)]">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center shrink-0">
        <h2 className="text-lg font-bold text-gray-800">
          Scanned Pages ({processedData.length})
        </h2>
        <input
          type="text"
          placeholder="Filter URL or status..."
          className="px-3 py-2 border rounded text-sm w-64"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
      </div>

      <div className="overflow-auto flex-1">
        <table className="min-w-full divide-y divide-gray-200 relative">
          <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50"
              >
                #
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 bg-gray-50"
                onClick={() => handleSort("url")}
              >
                URL {sortBy === "url" && (isSortedAsc ? "▲" : "▼")}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 bg-gray-50"
                onClick={() => handleSort("status")}
              >
                Status {sortBy === "status" && (isSortedAsc ? "▲" : "▼")}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 bg-gray-50"
                onClick={() => handleSort("depth")}
              >
                Depth {sortBy === "depth" && (isSortedAsc ? "▲" : "▼")}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 bg-gray-50"
                onClick={() => handleSort("violation_count")}
              >
                Violations{" "}
                {sortBy === "violation_count" && (isSortedAsc ? "▲" : "▼")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                Attributes
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 bg-gray-50"
                onClick={() => handleSort("performance_score")}
                title="Lighthouse Performance Score"
              >
                Perf{" "}
                {sortBy === "performance_score" && (isSortedAsc ? "▲" : "▼")}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 bg-gray-50"
                onClick={() => handleSort("seo_score")}
                title="SEO Health Score"
              >
                SEO {sortBy === "seo_score" && (isSortedAsc ? "▲" : "▼")}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {processedData.map((page, index) => (
              <React.Fragment key={page.url}>
                <tr
                  className={`hover:bg-gray-50 ${page.status === "failed" ? "bg-red-50" : ""}`}
                >
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {index + 1}
                  </td>
                  <td
                    className="px-6 py-4 text-sm font-mono text-gray-900 max-w-md truncate"
                    title={page.url}
                  >
                    {page.url}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${
                      page.status === "completed"
                        ? "bg-green-100 text-green-800"
                        : page.status === "failed" || page.status === "stopped"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                    }`}
                    >
                      {page.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {page.depth}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${page.violation_count > 0 ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"}`}
                    >
                      {page.violation_count}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 items-start">
                      {page.pageTypes && page.pageTypes.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {page.pageTypes.map((t) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 font-medium"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      {page.redirectUrl && (
                        <div
                          className="text-xs text-amber-600 flex items-center gap-1 max-w-[200px] truncate"
                          title={`Redirects to: ${page.redirectUrl}`}
                        >
                          <span className="font-bold text-amber-700">➜</span>
                          <a
                            href={page.redirectUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline text-amber-700"
                          >
                            {(() => {
                              try {
                                const u = new URL(page.url);
                                const r = new URL(page.redirectUrl);
                                if (u.hostname !== r.hostname) {
                                  return r.hostname + r.pathname;
                                }
                                return r.pathname + r.search;
                              } catch {
                                return page.redirectUrl;
                              }
                            })()}
                          </a>
                        </div>
                      )}
                      {!page.pageTypes?.length && !page.redirectUrl && (
                        <span className="text-gray-300 text-xs">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {page.performance_score !== undefined ? (
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                      ${
                        page.performance_score >= 0.9
                          ? "bg-green-100 text-green-800"
                          : page.performance_score >= 0.5
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                      }`}
                        title={`Perf: ${Math.round(page.performance_score * 100)}, A11y: ${Math.round((page.accessibility_score || 0) * 100)}, SEO: ${Math.round((page.seo_score || 0) * 100)}`}
                      >
                        {Math.round(page.performance_score * 100)}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {page.seo_score !== undefined ? (
                      (() => {
                        const normalizedScore =
                          page.seo_score > 1
                            ? page.seo_score
                            : page.seo_score * 100;
                        return (
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                          ${
                            normalizedScore >= 90
                              ? "bg-green-100 text-green-800"
                              : normalizedScore >= 50
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                          }`}
                            title={`SEO Score: ${Math.round(normalizedScore)}`}
                          >
                            {Math.round(normalizedScore)}
                          </span>
                        );
                      })()
                    ) : (
                      <span className="text-gray-300 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <div className="flex gap-3 justify-end items-center">
                      {(page.violation_count > 0 ||
                        page.status === "completed") && (
                        <a
                          href={`/runs/${runId}/violations?url=${encodeURIComponent(
                            page.url,
                          )}`}
                          className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-xs font-medium transition-colors"
                        >
                          Inspect
                        </a>
                      )}
                      {page.seo_result && (
                        <button
                          onClick={() =>
                            setExpandedRow(
                              expandedRow === page.url ? null : page.url,
                            )
                          }
                          className="text-gray-600 hover:text-gray-900 underline text-sm whitespace-nowrap"
                        >
                          {expandedRow === page.url ? "Hide SEO" : "SEO"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedRow === page.url && page.seo_result && (
                  <tr className="bg-gray-50 animate-in fade-in slide-in-from-top-1 duration-200">
                    <td colSpan={9} className="px-6 py-6 border-b shadow-inner">
                      <SeoDetailsViewer
                        seoResult={page.seo_result}
                        url={page.url}
                      />
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
