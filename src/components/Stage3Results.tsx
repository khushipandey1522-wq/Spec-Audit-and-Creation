import React, { useState } from "react";
import type { ISQ } from "../types";

interface Stage3ResultsProps {
  commonSpecs: Array<{
    spec_name: string;
    options: string[];
    category: string;
  }>;
  buyerISQs: ISQ[];
}

interface CommonSpecItem {
  spec_name: string;
  options: string[];
  category: string;
}

export default function Stage3Results({ commonSpecs, buyerISQs }: Stage3ResultsProps) {
  const [showAllBuyerISQs, setShowAllBuyerISQs] = useState(false);

  const primaryCommonSpecs = commonSpecs.filter((s) => s.category === "Primary");
  const secondaryCommonSpecs = commonSpecs.filter((s) => s.category === "Secondary");

  const displayedBuyerISQs = showAllBuyerISQs ? buyerISQs : buyerISQs.slice(0, 2);
  const hasMoreBuyerISQs = buyerISQs.length > 2;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Stage 3: Final Specifications</h2>
      <p className="text-gray-600 mb-8">
        Common Specifications & Buyer ISQs
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT: Common Specifications with ALL Options */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-blue-900 flex items-center gap-2">
              <span className="inline-block w-10 h-10 bg-blue-300 rounded-full flex items-center justify-center text-blue-900 text-lg font-bold">
                {commonSpecs.length}
              </span>
              Common Specifications
            </h3>
            <div className="text-sm text-blue-700 font-medium">
              {primaryCommonSpecs.length} Primary, {secondaryCommonSpecs.length} Secondary
            </div>
          </div>
          <p className="text-sm text-blue-700 mb-6">
            All common specs found in both Stage 1 & Stage 2
          </p>

          <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
            {commonSpecs.length === 0 ? (
              <div className="bg-white border border-blue-200 p-4 rounded-lg text-center">
                <p className="text-gray-600">No common specifications found</p>
              </div>
            ) : (
              commonSpecs.map((spec, idx) => (
                <SpecCard key={idx} spec={spec} />
              ))
            )}
          </div>
        </div>

        {/* RIGHT: Buyer ISQs */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-amber-900 flex items-center gap-2">
              <span className="inline-block w-10 h-10 bg-amber-300 rounded-full flex items-center justify-center text-amber-900 text-lg font-bold">
                {buyerISQs.length}
              </span>
              Buyer ISQs
            </h3>
            <div className="text-sm text-amber-700 font-medium">
              First 2 common specs with up to 8 options each
            </div>
          </div>
          <p className="text-sm text-amber-700 mb-6">
            Based on buyer search patterns
          </p>

          {buyerISQs.length === 0 ? (
            <div className="bg-white border border-amber-200 p-6 rounded-lg text-center">
              <p className="text-gray-600">No Buyer ISQs generated</p>
            </div>
          ) : (
            <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
              {displayedBuyerISQs.map((spec, idx) => (
                <BuyerISQCard key={idx} spec={spec} index={idx} />
              ))}

              {hasMoreBuyerISQs && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => setShowAllBuyerISQs(!showAllBuyerISQs)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 font-medium rounded-lg transition-colors"
                  >
                    {showAllBuyerISQs ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                        Show Less
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        Show All {buyerISQs.length} Buyer ISQs
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SpecCard({
  spec,
}: {
  spec: CommonSpecItem;
}) {
  // Check if this spec has "No common options available"
  const hasNoCommonOptions = spec.options.length === 1 && 
    spec.options[0].toLowerCase().includes('no common options available');

  return (
    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="font-semibold text-gray-900 text-lg">{spec.spec_name}</div>
          <div className="text-xs text-gray-600 mt-2">
            <span className="inline-block bg-blue-100 px-2 py-1 rounded">
              {spec.category}
            </span>
            <span className="ml-2 text-gray-500 text-xs">
              {hasNoCommonOptions ? "No common options" : `${spec.options.length} common options`}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {hasNoCommonOptions ? (
          <span className="text-gray-400 italic text-sm">
            No common options available
          </span>
        ) : (
          spec.options.map((option, idx) => (
            <span key={idx} className="text-blue-800 bg-white border border-blue-300 px-3 py-1 rounded-full text-sm">
              {option}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function BuyerISQCard({ spec, index }: { spec: ISQ; index: number }) {
  return (
    <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="font-semibold text-gray-900 text-lg flex items-center gap-2">
            <span className="inline-block w-6 h-6 bg-amber-300 rounded-full flex items-center justify-center text-amber-900 text-xs font-bold">
              {index + 1}
            </span>
            {spec.name}
          </div>
          <div className="text-xs text-gray-600 mt-2">
            <span className="inline-block bg-amber-100 px-2 py-1 rounded">
              {spec.options.length} options
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {spec.options.length > 0 ? (
          spec.options.map((option, idx) => (
            <span key={idx} className="text-amber-800 bg-white border border-amber-300 px-3 py-1 rounded-full text-sm">
              {option}
            </span>
          ))
        ) : (
          <span className="text-gray-400 italic text-sm">
            No options available
          </span>
        )}
      </div>
    </div>
  );
}