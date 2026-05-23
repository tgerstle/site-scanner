import React, { useState } from "react";
import { Download, FileDown, FileJson } from "lucide-react";

interface ExportTriggerProps {
  runId: string;
}

export const ExportTrigger: React.FC<ExportTriggerProps> = ({ runId }) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: "xlsx" | "csv" | "json") => {
    setIsExporting(true);
    try {
      const response = await fetch(
        `/api/runs/${runId}/export?format=${format}`,
      );
      if (!response.ok)
        throw new Error(`Export failed: ${response.statusText}`);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;

      let extension = format;
      if (format === "csv") extension = "zip"; // CSV exports as a zip of multiple files

      a.download = `scanner-export-${runId}.${extension}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Failed to generate export.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex gap-2">
      <a
        href={`/runs/${runId}/preview`}
        className="flex items-center gap-2 border border-slate-300 text-slate-700 px-4 py-2 rounded shadow hover:bg-slate-50 transition"
      >
        View Spreadsheets
      </a>
      <button
        onClick={() => handleExport("xlsx")}
        disabled={isExporting}
        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition disabled:opacity-50"
      >
        {isExporting ? (
          <Download size={16} className="animate-pulse" />
        ) : (
          <FileDown size={16} />
        )}
        Export XLSX
      </button>
      <button
        onClick={() => handleExport("csv")}
        disabled={isExporting}
        className="flex items-center gap-2 bg-slate-600 text-white px-4 py-2 rounded shadow hover:bg-slate-700 transition disabled:opacity-50"
      >
        {isExporting ? (
          <Download size={16} className="animate-pulse" />
        ) : (
          <FileDown size={16} />
        )}
        Export CSVs (ZIP)
      </button>
      <button
        onClick={() => handleExport("json")}
        disabled={isExporting}
        className="flex items-center gap-2 border border-slate-300 text-slate-700 px-4 py-2 rounded shadow hover:bg-slate-50 transition disabled:opacity-50"
      >
        {isExporting ? (
          <Download size={16} className="animate-pulse" />
        ) : (
          <FileJson size={16} />
        )}
        Export JSON
      </button>
    </div>
  );
};
