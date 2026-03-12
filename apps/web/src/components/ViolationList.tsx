import React from "react";

export default function ViolationList({ violations = [] }: { violations: any[] }) {
  if (!violations || violations.length === 0) {
    return (
      <div className="text-gray-500 italic p-4 border rounded bg-gray-50">
        No violations found. Awesome!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {violations.map((v, i) => (
        <div key={i} className="bg-red-50 border border-red-100 p-4 rounded-lg">
          <div className="flex justify-between items-start">
            <h4 className="font-semibold text-red-800">{v.rule_id || v.id}</h4>
            <span className="bg-red-200 text-red-800 text-xs px-2 py-1 rounded uppercase tracking-wide">
              {v.impact}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-700">
            Count: <span className="font-medium">{v.count || 1}</span>
          </p>
          {v.help && <p className="mt-1 text-sm text-gray-600">{v.help}</p>}
        </div>
      ))}
    </div>
  );
}
