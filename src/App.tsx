import { useState } from "react";
import AuditInput from "./components/AuditInput";
import AuditResults from "./components/AuditResults";
import URLInput from "./components/URLInput";
import Stage2Results from "./components/Stage2Results";
import Stage3Results from "./components/Stage3Results";
import { auditSpecificationsWithGemini, extractISQWithGemini, generateBuyerISQsFromSpecs } from "./utils/api";
import { generateAuditExcel, generateCombinedExcel } from "./utils/excel";
import type { AuditInput as AuditInputType, AuditResult, UploadedSpec, ISQ, InputData } from "./types";
import { Download, RefreshCw } from "lucide-react";

type AppStage = "input" | "audit" | "url_input" | "final_results";

function App() {
  const [stage, setStage] = useState<AppStage>("input");
  const [mcatName, setMcatName] = useState("");
  const [originalSpecs, setOriginalSpecs] = useState<UploadedSpec[]>([]);
  const [auditResults, setAuditResults] = useState<AuditResult[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [isqs, setIsqs] = useState<{ config: ISQ; keys: ISQ[]; buyers: ISQ[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"stage1" | "stage2" | "stage3">("stage1");
  const [processingStage, setProcessingStage] = useState<string>("");

  const handleAuditSubmit = async (data: AuditInputType) => {
    setMcatName(data.mcat_name);
    setOriginalSpecs(data.specifications);
    setLoading(true);
    setError("");
    setProcessingStage("Auditing specifications...");

    try {
      const results = await auditSpecificationsWithGemini(data);
      setAuditResults(results);
      setStage("audit");
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
      console.error(err);
    } finally {
      setLoading(false);
      setProcessingStage("");
    }
  };

  const handleProceedToStage2 = () => {
    setStage("url_input");
  };

  const handleURLSubmit = async (submittedUrls: string[]) => {
    setUrls(submittedUrls);
    setLoading(true);
    setError("");
    setProcessingStage("Extracting ISQs from URLs...");

    try {
      const inputData: InputData = {
        pmcat_name: mcatName,
        pmcat_id: "",
        mcats: [{ mcat_name: mcatName, mcat_id: "" }],
        urls: submittedUrls,
      };

      const result = await extractISQWithGemini(inputData, submittedUrls);

      console.log("🎯 Generating buyer ISQs from common specs...");
      setProcessingStage("Generating buyer ISQs...");

      const buyerISQs = generateBuyerISQsFromSpecs(originalSpecs, {
        config: result.config,
        keys: result.keys
      });

      console.log("✅ Buyer ISQs generated:", buyerISQs);

      setIsqs({
        ...result,
        buyers: buyerISQs
      });
      setStage("final_results");
      setActiveTab("stage1");
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
      console.error(err);
    } finally {
      setLoading(false);
      setProcessingStage("");
    }
  };

  const handleRerunStage2 = async () => {
    if (urls.length === 0) {
      setError("No URLs found to rerun. Please go back to Stage 2.");
      return;
    }

    setLoading(true);
    setError("");
    setProcessingStage("Re-extracting ISQs from URLs...");

    try {
      const inputData: InputData = {
        pmcat_name: mcatName,
        pmcat_id: "",
        mcats: [{ mcat_name: mcatName, mcat_id: "" }],
        urls: urls,
      };

      const result = await extractISQWithGemini(inputData, urls);

      console.log("🎯 Regenerating buyer ISQs from common specs...");
      setProcessingStage("Generating buyer ISQs...");

      const buyerISQs = generateBuyerISQsFromSpecs(originalSpecs, {
        config: result.config,
        keys: result.keys
      });

      console.log("✅ Buyer ISQs regenerated:", buyerISQs);

      setIsqs({
        ...result,
        buyers: buyerISQs
      });
      setActiveTab("stage2");
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
      console.error(err);
    } finally {
      setLoading(false);
      setProcessingStage("");
    }
  };

  const handleReset = () => {
    setStage("input");
    setMcatName("");
    setOriginalSpecs([]);
    setAuditResults([]);
    setUrls([]);
    setIsqs(null);
    setError("");
    setActiveTab("stage1");
  };

  const downloadJSON = (data: any, filename: string) => {
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadStage1Excel = () => {
    generateAuditExcel(mcatName, auditResults, originalSpecs);
  };

  const handleDownloadStage1JSON = () => {
    downloadJSON({ audit_results: auditResults, specifications: originalSpecs }, "stage1_audit.json");
  };

  const handleDownloadStage2JSON = () => {
    if (!isqs) return;
    downloadJSON(isqs, "stage2_isqs.json");
  };

  const handleDownloadStage3JSON = () => {
    if (!isqs) return;
    downloadJSON({ buyer_isqs: isqs.buyers }, "stage3_buyer_isqs.json");
  };

  const handleDownloadCombinedExcel = () => {
    if (!isqs) return;
    generateCombinedExcel(mcatName, auditResults, originalSpecs, isqs);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {error && (
        <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg max-w-md z-50">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {processingStage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-100 border border-blue-400 text-blue-700 px-6 py-3 rounded-lg shadow-lg z-50">
          <p className="font-semibold">{processingStage}</p>
        </div>
      )}

      <div className="min-h-screen py-8">
        {stage === "input" && (
          <AuditInput onSubmit={handleAuditSubmit} loading={loading} />
        )}

        {stage === "audit" && (
          <div className="w-full max-w-6xl mx-auto px-6">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <AuditResults
                auditResults={auditResults}
                originalSpecs={originalSpecs}
                onProceedToStage2={handleProceedToStage2}
              />
            </div>
          </div>
        )}

        {stage === "url_input" && (
          <div className="w-full max-w-4xl mx-auto px-6 space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Audit Complete</h2>
                <p className="text-gray-600">
                  Now add competitor URLs to extract buyer ISQs for <strong>{mcatName}</strong>
                </p>
              </div>

              <URLInput onSubmit={handleURLSubmit} loading={loading} />
            </div>
          </div>
        )}

        {stage === "final_results" && isqs && (
          <div className="w-full max-w-6xl mx-auto px-6">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Final Results</h1>
                  <p className="text-gray-600 mt-1">
                    Complete audit and ISQ extraction for <strong>{mcatName}</strong>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleRerunStage2}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw size={20} />
                    Rerun Stage 2
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white font-semibold rounded-lg hover:from-gray-700 hover:to-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw size={20} />
                    New Analysis
                  </button>
                </div>
              </div>

              <div className="border-b border-gray-200 mb-8">
                <div className="flex gap-4">
                  <button
                    onClick={() => setActiveTab("stage1")}
                    className={`px-6 py-3 font-semibold transition ${
                      activeTab === "stage1"
                        ? "text-blue-600 border-b-2 border-blue-600"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Stage 1: Audit
                  </button>
                  <button
                    onClick={() => setActiveTab("stage2")}
                    className={`px-6 py-3 font-semibold transition ${
                      activeTab === "stage2"
                        ? "text-blue-600 border-b-2 border-blue-600"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Stage 2: ISQs
                  </button>
                  <button
                    onClick={() => setActiveTab("stage3")}
                    className={`px-6 py-3 font-semibold transition ${
                      activeTab === "stage3"
                        ? "text-blue-600 border-b-2 border-blue-600"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Stage 3: Buyer ISQs
                  </button>
                </div>
              </div>

              {activeTab === "stage1" && (
                <div>
                  <AuditResults
                    auditResults={auditResults}
                    originalSpecs={originalSpecs}
                    onProceedToStage2={() => {}}
                    showNextStepButton={false}
                  />
                  <div className="mt-8 pt-8 border-t border-gray-200">
                    <button
                      onClick={handleDownloadStage1Excel}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition"
                    >
                      <Download size={20} />
                      Download Stage 1 Audit Results (Excel)
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "stage2" && (
                <div>
                  <Stage2Results isqs={isqs} onDownloadExcel={() => {}} />
                  <div className="mt-8 pt-8 border-t border-gray-200">
                    <button
                      onClick={handleDownloadStage2JSON}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-lg hover:from-green-700 hover:to-green-800 transition"
                    >
                      <Download size={20} />
                      Download Stage 2 ISQs (JSON)
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "stage3" && isqs && (
                <div>
                  <Stage3Results
                    stage1Data={{
                      seller_specs: [
                        {
                          pmcat_name: mcatName,
                          pmcat_id: "",
                          mcats: [
                            {
                              category_name: mcatName,
                              mcat_id: "",
                              finalized_specs: {
                                finalized_primary_specs: {
                                  specs: originalSpecs.filter(s => s.tier === 'Primary' || !s.tier).map(s => ({
                                    spec_name: s.spec_name,
                                    options: s.options,
                                    input_type: s.input_type || 'text' as 'radio_button' | 'multi_select',
                                    affix_flag: 'None' as 'None' | 'Prefix' | 'Suffix',
                                    affix_presence_flag: '0' as '0' | '1'
                                  }))
                                },
                                finalized_secondary_specs: {
                                  specs: originalSpecs.filter(s => s.tier === 'Secondary').map(s => ({
                                    spec_name: s.spec_name,
                                    options: s.options,
                                    input_type: s.input_type || 'text' as 'radio_button' | 'multi_select',
                                    affix_flag: 'None' as 'None' | 'Prefix' | 'Suffix',
                                    affix_presence_flag: '0' as '0' | '1'
                                  }))
                                },
                                finalized_tertiary_specs: {
                                  specs: []
                                }
                              }
                            }
                          ]
                        }
                      ]
                    }}
                    isqs={isqs}
                  />

                  <div className="pt-8 border-t border-gray-200 space-y-4">
                    <button
                      onClick={handleDownloadCombinedExcel}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-lg hover:from-green-700 hover:to-green-800 transition"
                    >
                      <Download size={20} />
                      Download Complete Analysis (Excel - All Stages)
                    </button>
                    <button
                      onClick={handleDownloadStage3JSON}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-600 to-amber-700 text-white font-semibold rounded-lg hover:from-amber-700 hover:to-amber-800 transition"
                    >
                      <Download size={20} />
                      Download Stage 3 Buyer ISQs (JSON)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
