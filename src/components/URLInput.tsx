import React, { useState } from "react";
import { Plus, Trash2, Globe } from "lucide-react";

interface URLInputProps {
  onSubmit: (urls: string[]) => void;
  loading?: boolean;
}

export default function URLInput({ onSubmit, loading = false }: URLInputProps) {
  const [urls, setUrls] = useState<string[]>([""]);
  const [errors, setErrors] = useState<string[]>([]);

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    const filledUrls = urls.filter((u) => u.trim());
    if (filledUrls.length === 0) {
      newErrors.push("At least one URL is required");
    }

    filledUrls.forEach((url, idx) => {
      try {
        new URL(url);
      } catch {
        newErrors.push(`Invalid URL at position ${idx + 1}: ${url}`);
      }
    });

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const filteredUrls = urls.filter((u) => u.trim());
    onSubmit(filteredUrls);
  };

  const addUrl = () => {
    setUrls([...urls, ""]);
  };

  const removeUrl = (index: number) => {
    setUrls(urls.filter((_, i) => i !== index));
  };

  const updateUrl = (index: number, value: string) => {
    const updated = [...urls];
    updated[index] = value;
    setUrls(updated);
  };

  return (
    <div className="bg-white rounded-lg border-2 border-gray-300 p-6">
      <div className="flex items-center gap-3 mb-6">
        <Globe className="text-blue-600" size={28} />
        <div>
          <h2 className="text-xl font-bold text-gray-900">Stage 2: Website Benchmarking</h2>
          <p className="text-gray-600 text-sm">Add URLs to extract ISQs</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-red-800 mb-2">Please fix the following errors:</h3>
            <ul className="list-disc list-inside space-y-1 text-red-700 text-sm">
              {errors.map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-gray-700">Websites URLs</label>
            <button
              type="button"
              onClick={addUrl}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              <Plus size={16} /> Add URL
            </button>
          </div>

          {urls.map((url, idx) => (
            <div key={idx} className="flex gap-3">
              <input
                type="url"
                value={url}
                onChange={(e) => updateUrl(idx, e.target.value)}
                placeholder="https://example.com/product"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                disabled={loading}
              />
              {urls.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeUrl(idx)}
                  disabled={loading}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 transition"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? "Extracting ISQs..." : "Start Processing"}
        </button>
      </form>
    </div>
  );
}
