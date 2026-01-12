import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import type { AuditResult, UploadedSpec } from "../types";

interface AuditResultsProps {
  auditResults: AuditResult[];
  originalSpecs: UploadedSpec[];
  onProceedToStage2: () => void;
  showNextStepButton?: boolean;
}

export default function AuditResults({
  auditResults,
  originalSpecs,
  onProceedToStage2,
  showNextStepButton = true,
}: AuditResultsProps) {
  const [expandedSpecs, setExpandedSpecs] = useState<Set<string>>(new Set());

  // DEBUG LOGS
  useEffect(() => {
    console.log("🔍 [AuditResults] auditResults:", auditResults);
    console.log("📊 [AuditResults] originalSpecs:", originalSpecs);
    console.log("📈 [AuditResults] Incorrect count:", auditResults.filter(r => r.status === "incorrect").length);
  }, [auditResults, originalSpecs]);

  const toggleExpanded = (specName: string) => {
    const newExpanded = new Set(expandedSpecs);
    if (newExpanded.has(specName)) {
      newExpanded.delete(specName);
    } else {
      newExpanded.add(specName);
    }
    setExpandedSpecs(newExpanded);
  };

  // FIXED: Merge audit results with original specs - NO DEFAULT CORRECT
  const displaySpecs = originalSpecs.map(spec => {
    const matchingResult = auditResults.find(r => 
      r.specification.toLowerCase() === spec.spec_name.toLowerCase() ||
      isSemanticallySimilar(r.specification, spec.spec_name)
    );
    
    if (matchingResult) {
      return {
        ...spec,
        auditResult: matchingResult
      };
    }
    
    // If no match found, mark as NOT AUDITED instead of default correct
    return {
      ...spec,
      auditResult: {
        specification: spec.spec_name,
        status: "not-audited",
        explanation: "Not processed in audit",
        problematic_options: []
      }
    };
  });

  const correctCount = displaySpecs.filter(s => s.auditResult.status === "correct").length;
  const incorrectCount = displaySpecs.filter(s => s.auditResult.status === "incorrect").length;
  const notAuditedCount = displaySpecs.filter(s => s.auditResult.status === "not-audited").length;
  const allCorrect = incorrectCount === 0 && notAuditedCount === 0;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Stage 1: Audit Results</h2>
        <p className="text-gray-600 text-sm">Review specification audit results</p>
      </div>

      {/* Summary Cards - Now 3 cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-green-50 border border-green-200 rounded p-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="text-green-600" size={18} />
            <div>
              <p className="text-lg font-bold text-green-900">{correctCount}</p>
              <p className="text-xs text-green-700">Correct</p>
            </div>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded p-3">
          <div className="flex items-center gap-2">
            <XCircle className="text-red-600" size={18} />
            <div>
              <p className="text-lg font-bold text-red-900">{incorrectCount}</p>
              <p className="text-xs text-red-700">Incorrect</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded p-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-400 rounded-full flex items-center justify-center">
              <span className="text-white text-xs">?</span>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{notAuditedCount}</p>
              <p className="text-xs text-gray-700">Not Audited</p>
            </div>
          </div>
        </div>
      </div>

      {/* DEBUG Info */}
      {auditResults.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs">
          <p><strong>DEBUG:</strong> Audit received {auditResults.length} results</p>
          <p>Incorrect specs: {auditResults.filter(r => r.status === "incorrect").map(r => r.specification).join(", ")}</p>
        </div>
      )}

      {/* Specifications List */}
      <div className="space-y-3 mb-4">
        {displaySpecs.map((spec, idx) => {
          const isCorrect = spec.auditResult.status === "correct";
          const isIncorrect = spec.auditResult.status === "incorrect";
          const isNotAudited = spec.auditResult.status === "not-audited";
          const isExpanded = expandedSpecs.has(spec.spec_name);
          const hasIssues = isIncorrect && spec.auditResult.explanation;

          return (
            <div
              key={idx}
              className={`border rounded overflow-hidden ${
                isCorrect
                  ? "border-green-200 bg-green-50"
                  : isIncorrect
                  ? "border-red-200 bg-red-50"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              {/* Specification Header */}
              <div className={`p-3 ${
                isCorrect ? "bg-green-100" : 
                isIncorrect ? "bg-red-100" : 
                "bg-gray-100"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    {isCorrect ? (
                      <CheckCircle className="text-green-600 flex-shrink-0" size={16} />
                    ) : isIncorrect ? (
                      <XCircle className="text-red-600 flex-shrink-0" size={16} />
                    ) : (
                      <div className="w-5 h-5 bg-gray-400 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs">?</span>
                      </div>
                    )}
                    <div>
                      <h3 className={`text-sm font-semibold ${
                        isCorrect ? "text-green-900" : 
                        isIncorrect ? "text-red-900" : 
                        "text-gray-900"
                      }`}>
                        {spec.spec_name}
                        {isNotAudited && (
                          <span className="ml-2 text-xs font-normal text-gray-600">
                            (Not audited)
                          </span>
                        )}
                      </h3>
                      {spec.tier && (
                        <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${
                          isCorrect
                            ? "bg-green-200 text-green-800"
                            : isIncorrect
                            ? "bg-red-200 text-red-800"
                            : "bg-gray-200 text-gray-800"
                        }`}>
                          {spec.tier}
                        </span>
                      )}
                    </div>
                  </div>

                  {hasIssues && (
                    <button
                      onClick={() => toggleExpanded(spec.spec_name)}
                      className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded text-xs font-medium flex-shrink-0"
                    >
                      {isExpanded ? "Hide" : "Details"}
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  )}
                </div>

                {/* Expandable Explanation - Only for incorrect specs */}
                {hasIssues && isExpanded && spec.auditResult.explanation && (
                  <div className="mt-2 p-2 bg-white border border-red-200 rounded text-xs">
                    <h4 className="font-semibold text-red-900 mb-1">Issues:</h4>
                    <p className="text-red-800 mb-2">{spec.auditResult.explanation}</p>
                    
                    {spec.auditResult.problematic_options && 
                     spec.auditResult.problematic_options.length > 0 && (
                      <div>
                        <h5 className="font-medium text-red-800 mb-1">Problematic Options:</h5>
                        <div className="flex flex-wrap gap-1">
                          {spec.auditResult.problematic_options.map((option, optIdx) => (
                            <span
                              key={optIdx}
                              className="px-1.5 py-0.5 bg-red-100 text-red-800 rounded text-xs border border-red-300"
                            >
                              {option}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Options */}
              <div className="p-3">
                <div className="flex flex-wrap gap-1">
                  {spec.options.map((option, oIdx) => {
                    const isProblematic = spec.auditResult.problematic_options?.includes(option);

                    return (
                      <span
                        key={oIdx}
                        className={`px-2 py-1 rounded text-xs ${
                          isProblematic
                            ? "bg-red-200 text-red-900 border border-red-400"
                            : isCorrect
                              ? "bg-green-200 text-green-900 border border-green-300"
                              : isIncorrect
                                ? "bg-yellow-100 text-yellow-900 border border-yellow-300"
                                : "bg-gray-100 text-gray-700 border border-gray-300"
                        }`}
                      >
                        {option}
                        {isProblematic && (
                          <span className="ml-1 text-red-600 font-bold">⚠</span>
                        )}
                      </span>
                    );
                  })}
                </div>
                
                {/* Show duplicate options warning */}
                {isIncorrect && spec.auditResult.problematic_options && spec.auditResult.problematic_options.length > 0 && (
                  <div className="mt-2 text-xs text-red-600">
                    ⚠ {spec.auditResult.problematic_options.length} problematic option(s) found
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Status Message */}
      {allCorrect ? (
        <div className="mb-3 p-3 bg-green-50 border border-green-300 rounded">
          <div className="flex items-center gap-2">
            <CheckCircle className="text-green-600" size={16} />
            <div>
              <p className="font-medium text-green-900 text-sm">All specifications are correct!</p>
            </div>
          </div>
        </div>
      ) : incorrectCount > 0 ? (
        <div className="mb-3 p-3 bg-red-50 border border-red-300 rounded">
          <div className="flex items-center gap-2">
            <XCircle className="text-red-600" size={16} />
            <div>
              <p className="font-medium text-red-900 text-sm">
                Issues found in {incorrectCount} specification(s)
                {notAuditedCount > 0 && `, ${notAuditedCount} not audited`}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-3 p-3 bg-gray-50 border border-gray-300 rounded">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-400 rounded-full flex items-center justify-center">
              <span className="text-white text-xs">?</span>
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">
                {notAuditedCount} specification(s) were not audited
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Next Step Button */}
      {showNextStepButton && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <button
            onClick={onProceedToStage2}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded hover:from-blue-700 hover:to-blue-800 transition text-sm"
          >
            <RefreshCw size={14} />
            Extract Buyer ISQs using Website Benchmarking
          </button>
        </div>
      )}
    </div>
  );
}

// Helper function
function isSemanticallySimilar(spec1: string, spec2: string): boolean {
  const normalize = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9\s]/g, ' ');
  const norm1 = normalize(spec1);
  const norm2 = normalize(spec2);
  
  if (norm1 === norm2) return true;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
  
  return false;
}