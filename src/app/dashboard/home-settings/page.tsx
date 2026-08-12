"use client";

import { useEffect, useState } from "react";

export default function HomeSettingsPage() {
  const [data, setData] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/admin/home-settings")
      .then((res) => res.json())
      .then((json) => {
        // Strip _id and updatedAt for cleaner editing
        const { _id, updatedAt, ...rest } = json;
        setData(JSON.stringify(rest, null, 2));
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const parsed = JSON.parse(data);
      const res = await fetch("/api/admin/home-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError("Invalid JSON format or save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading settings...</div>;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Home Page Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage the global Reviews, Popular Shops, Categories, and FAQs shown on the public home page.
            Edit the JSON configuration below.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 rounded bg-green-50 p-4 text-sm text-green-700 border border-green-200">
          Settings saved successfully!
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <textarea
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="h-[600px] w-full rounded border border-gray-300 bg-gray-50 p-4 font-mono text-sm text-gray-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          spellCheck={false}
        />
      </div>
      <div className="mt-4 text-xs text-gray-500">
        <strong>Tip:</strong> Ensure you are using valid JSON (double quotes for keys and string values). Do not remove the main array structures: <code>reviews</code>, <code>popularShops</code>, <code>categories</code>, and <code>faqs</code>.
      </div>
    </div>
  );
}
