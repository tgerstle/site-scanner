import React, { useState, useEffect } from "react";

export const ExportDataPreview = ({ runId }: { runId: string }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("global");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/runs/${runId}/export?format=json`);
        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error("Failed to load preview data", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [runId]);

  if (loading)
    return (
      <div className="p-8 text-center text-slate-500 animate-pulse">
        Loading dataset...
      </div>
    );
  if (!data)
    return (
      <div className="p-8 text-center text-red-500">
        Failed to load export preview data.
      </div>
    );

  const tabs = Object.keys(data).filter(
    (key) => data[key] && Array.isArray(data[key]),
  );

  return (
    <div className="space-y-4">
      <div className="flex border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-medium capitalize transition-colors ${
              activeTab === tab
                ? "border-b-2 border-blue-600 text-blue-700"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab} List ({data[tab].length})
          </button>
        ))}
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow border border-slate-100 max-h-[800px]">
        <DataTable rows={data[activeTab]} />
      </div>
    </div>
  );
};

const DataTable = ({ rows }: { rows: any[] }) => {
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);

  if (!rows || rows.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500">
        No data available for this category.
      </div>
    );
  }

  const headers = Object.keys(rows[0]);

  const sortedRows = React.useMemo(() => {
    let sortableItems = [...rows];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (aValue === null || aValue === undefined) aValue = "";
        if (bValue === null || bValue === undefined) bValue = "";

        // Handle numeric sorting natively if both are numbers
        if (typeof aValue === "number" && typeof bValue === "number") {
          return sortConfig.direction === "asc"
            ? aValue - bValue
            : bValue - aValue;
        }

        // Convert exactly to string to reliably alphabetize
        const aString = String(aValue).toLowerCase();
        const bString = String(bValue).toLowerCase();

        if (aString < bString) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (aString > bString) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [rows, sortConfig]);

  const requestSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  return (
    <table className="min-w-full text-sm text-left">
      <thead className="bg-slate-50 text-slate-700 uppercase sticky top-0 shadow-sm z-10">
        <tr>
          {headers.map((h) => (
            <th
              key={h}
              className="px-4 py-3 font-semibold border-b border-slate-200 whitespace-nowrap bg-slate-50 cursor-pointer select-none hover:bg-slate-200 transition-colors"
              onClick={() => requestSort(h)}
            >
              <div className="flex items-center gap-2">
                {h}
                <span className="text-slate-400 text-xs w-3">
                  {sortConfig?.key === h
                    ? sortConfig.direction === "asc"
                      ? "▲"
                      : "▼"
                    : ""}
                </span>
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {sortedRows.map((row, i) => (
          <tr key={i} className="hover:bg-slate-50 transition-colors">
            {headers.map((h) => {
              const val = row[h];
              const displayVal =
                val === null || val === undefined
                  ? ""
                  : typeof val === "object"
                    ? JSON.stringify(val)
                    : String(val);

              return <ExpandableCell key={h} displayVal={displayVal} />;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const ExpandableCell = ({ displayVal }: { displayVal: string }) => {
  const [expanded, setExpanded] = useState(false);

  // Decide whether the content is likely long enough to need truncation
  const isLong = displayVal.length > 50;

  if (!isLong) {
    return (
      <td className="px-4 py-2 border-r border-slate-100 last:border-r-0 max-w-[300px] whitespace-nowrap">
        {displayVal}
      </td>
    );
  }

  return (
    <td
      onClick={() => setExpanded(!expanded)}
      className={`px-4 py-2 border-r border-slate-100 last:border-r-0 cursor-pointer hover:bg-slate-100 transition-all group relative align-top ${
        expanded ? "min-w-[400px] max-w-[800px]" : "max-w-[300px]"
      }`}
      title={expanded ? "Click to collapse" : "Click to expand"}
    >
      <div
        className={
          expanded
            ? "break-words whitespace-normal break-all overflow-hidden"
            : "truncate"
        }
      >
        {displayVal}
      </div>
      {!expanded && (
        <span className="absolute right-1 top-2 text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity bg-white px-1 shadow-sm rounded">
          Expand
        </span>
      )}
    </td>
  );
};
