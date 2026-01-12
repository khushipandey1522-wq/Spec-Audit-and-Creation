import React from "react";
import type { ISQ } from "../types";

interface Stage2ResultsProps {
  isqs: {
    config: ISQ;
    keys: ISQ[];
  };
  onDownloadExcel: () => void;
}

export default function Stage2Results({ isqs }: Stage2ResultsProps) {
  const displayKeys = isqs.keys.slice(0, 3);
  const hasValidConfig = isqs.config && isqs.config.name && isqs.config.options.length > 0;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Stage 2: Website ISQ Extraction</h2>
      <p className="text-gray-600 mb-6">
        Extracted {hasValidConfig ? '1' : '0'} Config ISQ and {displayKeys.length} relevant Key ISQ{displayKeys.length !== 1 ? 's' : ''} from competitor websites
      </p>

      <div className="space-y-6">
        {hasValidConfig ? (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-400 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-red-900">Config ISQ</h3>
                <p className="text-sm text-red-700 mt-1">Most important specification affecting price and product variation</p>
              </div>
            </div>
            <div className="mb-3">
              <p className="font-bold text-lg text-gray-900">{isqs.config.name}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isqs.config.options.map((option, idx) => (
                <span key={idx} className="bg-red-200 text-red-900 px-4 py-2 rounded-full font-semibold border border-red-400">
                  {option}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6">
            <p className="text-yellow-800 font-semibold">No Config ISQ extracted</p>
            <p className="text-yellow-700 text-sm mt-1">The extraction did not identify a primary configuration specification</p>
          </div>
        )}

        {displayKeys.length > 0 ? (
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Key ISQs ({displayKeys.length})
            </h3>
            <div className="grid gap-4">
              {displayKeys.map((isq, idx) => (
                <div key={idx} className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-400 rounded-lg p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-bold text-lg text-gray-900">
                      {idx + 1}. {isq.name}
                    </p>
                    <div className="bg-blue-500 text-white px-3 py-1 rounded-full font-bold text-sm">
                      {isq.options.length} options
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isq.options.map((option, oIdx) => (
                      <span key={oIdx} className="bg-blue-200 text-blue-900 px-3 py-1.5 rounded-full font-medium border border-blue-400">
                        {option}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6">
            <p className="text-yellow-800 font-semibold">No Key ISQs extracted</p>
            <p className="text-yellow-700 text-sm mt-1">The extraction did not identify key specifications</p>
          </div>
        )}

        {displayKeys.length > 0 && displayKeys.length < 3 && (
          <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              Note: Found {displayKeys.length} relevant Key ISQ{displayKeys.length === 1 ? '' : 's'} from the website data. Quality over quantity - irrelevant specifications were filtered out.
            </p>
          </div>
        )}
        {displayKeys.length === 0 && hasValidConfig && (
          <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              Note: Only Config ISQ was found. No additional relevant Key ISQs were identified from the website data.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
