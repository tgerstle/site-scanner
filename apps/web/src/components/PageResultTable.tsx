import React, { useState, useEffect, useMemo } from "react";
import type { PageSummary } from "../types";

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
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 bg-gray-50"
                onClick={() => handleSort("performance_score")}
                title="Lighthouse Performance Score"
              >
                Perf{" "}
                {sortBy === "performance_score" && (isSortedAsc ? "▲" : "▼")}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {processedData.map((page, index) => (
              <tr
                key={page.url}
                className={`hover:bg-gray-50 ${page.status === "failed" ? "bg-red-50" : ""}`}
              >
                <td className="px-6 py-4 text-sm text-gray-500">{index + 1}</td>
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
                <td className="px-6 py-4 text-right text-sm font-medium">
                  {(page.violation_count > 0 ||
                    page.status === "completed") && (
                    <a
                      href={`/runs/${runId}/violations?url=${encodeURIComponent(page.url)}`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Inspect
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
