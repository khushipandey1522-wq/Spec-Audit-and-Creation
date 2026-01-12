import React, { useState } from "react";
import { Upload, AlertCircle } from "lucide-react";
import type { AuditInput } from "../types";

interface AuditInputProps {
  onSubmit: (data: AuditInput) => void;
  loading?: boolean;
}

export default function AuditInput({ onSubmit, loading = false }: AuditInputProps) {
  const [mcatName, setMcatName] = useState("");
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [jsonData, setJsonData] = useState<any>(null);
  const [specsCount, setSpecsCount] = useState(0);
  const [error, setError] = useState("");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setJsonFile(file);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        setJsonData(parsed);

        let count = 0;
        if (parsed.finalized_specs) {
          count += parsed.finalized_specs.finalized_primary_specs?.specs?.length || 0;
          count += parsed.finalized_specs.finalized_secondary_specs?.specs?.length || 0;
          count += parsed.finalized_specs.finalized_tertiary_specs?.specs?.length || 0;
        } else if (parsed.Specifications && Array.isArray(parsed.Specifications)) {
          count = parsed.Specifications.length;
        } else if (Array.isArray(parsed)) {
          count = parsed.length;
        } else if (parsed.specifications) {
          count = parsed.specifications.length;
        }
        setSpecsCount(count);
        setError("");
      } catch (err) {
        setError("Invalid JSON file. Please upload a valid JSON file.");
        setJsonData(null);
        setSpecsCount(0);
      }
    };

    reader.readAsText(file);
  };

  const validateAndSubmit = () => {
    if (!mcatName.trim()) {
      setError("MCAT Name is required");
      return;
    }

    if (!jsonData) {
      setError("Please upload a specifications JSON file");
      return;
    }

    let specifications = [];

    if (jsonData.category_name) {
      if (jsonData.category_name.toLowerCase() !== mcatName.toLowerCase()) {
        setError(`MCAT Name does not match uploaded JSON. Expected: "${jsonData.category_name}"`);
        return;
      }

      if (jsonData.finalized_specs) {
        const { finalized_primary_specs, finalized_secondary_specs, finalized_tertiary_specs } =
          jsonData.finalized_specs;

        if (finalized_primary_specs?.specs) {
          specifications.push(
            ...finalized_primary_specs.specs.map((s: any) => ({
              spec_name: s.spec_name,
              options: s.options || [],
              input_type: s.input_type,
              tier: "Primary" as const,
            }))
          );
        }

        if (finalized_secondary_specs?.specs) {
          specifications.push(
            ...finalized_secondary_specs.specs.map((s: any) => ({
              spec_name: s.spec_name,
              options: s.options || [],
              input_type: s.input_type,
              tier: "Secondary" as const,
            }))
          );
        }

        if (finalized_tertiary_specs?.specs) {
          specifications.push(
            ...finalized_tertiary_specs.specs.map((s: any) => ({
              spec_name: s.spec_name,
              options: s.options || [],
              input_type: s.input_type,
              tier: "Tertiary" as const,
            }))
          );
        }
      }
    } else if (jsonData.MCAT_Name && jsonData.Specifications) {
      const typeToTierMap: Record<string, "Primary" | "Secondary" | "Tertiary"> = {
        "Config": "Primary",
        "Key": "Secondary",
        "Regular": "Tertiary"
      };

      specifications = jsonData.Specifications.map((s: any) => ({
        spec_name: s.name,
        options: s.options || [],
        input_type: "radio_button",
        tier: typeToTierMap[s.type] || "Tertiary",
      }));
    } else if (Array.isArray(jsonData)) {
      specifications = jsonData.map((s: any) => ({
        spec_name: s.spec_name || s.name || "",
        options: s.options || [],
        input_type: s.input_type || "radio_button",
        tier: s.tier,
      }));
    } else if (jsonData.specifications) {
      specifications = jsonData.specifications.map((s: any) => ({
        spec_name: s.spec_name || s.name || "",
        options: s.options || [],
        input_type: s.input_type || "radio_button",
        tier: s.tier,
      }));
    }

    if (specifications.length === 0) {
      setError("No specifications found in the uploaded JSON file");
      return;
    }

    const auditInput: AuditInput = {
      mcat_name: mcatName.trim(),
      specifications,
    };

    setError("");
    onSubmit(auditInput);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Specification Auditor and Generator</h1>
        <p className="text-gray-600 mb-8">
          Audit your product specifications and extract ISQs from competitor URLs
        </p>

        <div className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="font-semibold text-red-800">Error</h3>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              MCAT Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={mcatName}
              onChange={(e) => setMcatName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="e.g., Stainless Steel Sheet"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Specifications JSON <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
                id="json-upload"
                disabled={loading}
              />
              <label
                htmlFor="json-upload"
                className={`flex items-center justify-center gap-3 w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition cursor-pointer ${
                  loading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <Upload className="text-gray-400" size={24} />
                <div className="text-center">
                  <p className="text-gray-700 font-medium">
                    {jsonFile ? jsonFile.name : "Click to upload JSON file"}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {jsonFile ? "File loaded successfully" : "or drag and drop your file here"}
                  </p>
                </div>
              </label>
            </div>

            {jsonData && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  <span className="font-semibold">File loaded:</span> {specsCount} specifications found
                </p>
              </div>
            )}
          </div>

          <button
            onClick={validateAndSubmit}
            disabled={loading || !mcatName.trim() || !jsonData}
            className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? "Processing..." : "Start Processing"}
          </button>
        </div>
      </div>
    </div>
  );
}
