"use client";

import { useEffect, useState } from "react";

type HomeReview = { author: string; rating: number; comment: string };
type HomePopularShop = { name: string; url: string };
type HomeCategory = { name: string; iconName: string; url: string };
type HomeFaq = { question: string; answer: string };

const TABS = [
  { id: "reviews", label: "Reviews" },
  { id: "popularShops", label: "Popular Shops" },
  { id: "categories", label: "Categories" },
  { id: "faqs", label: "FAQs" },
];

export default function HomeSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState("reviews");

  const [reviews, setReviews] = useState<HomeReview[]>([]);
  const [popularShops, setPopularShops] = useState<HomePopularShop[]>([]);
  const [categories, setCategories] = useState<HomeCategory[]>([]);
  const [faqs, setFaqs] = useState<HomeFaq[]>([]);

  useEffect(() => {
    fetch("/api/admin/home-settings")
      .then((res) => res.json())
      .then((json) => {
        setReviews(Array.isArray(json.reviews) ? json.reviews : []);
        setPopularShops(Array.isArray(json.popularShops) ? json.popularShops : []);
        setCategories(Array.isArray(json.categories) ? json.categories : []);
        setFaqs(Array.isArray(json.faqs) ? json.faqs : []);
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
      const payload = {
        reviews,
        popularShops,
        categories,
        faqs,
      };

      const res = await fetch("/api/admin/home-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // --- Handlers for Reviews ---
  const addReview = () => setReviews([{ author: "", rating: 5, comment: "" }, ...reviews]);
  const updateReview = (index: number, key: keyof HomeReview, value: any) => {
    const next = [...reviews];
    next[index] = { ...next[index], [key]: value };
    setReviews(next);
  };
  const removeReview = (index: number) => setReviews(reviews.filter((_, i) => i !== index));

  // --- Handlers for Popular Shops ---
  const addShop = () => setPopularShops([...popularShops, { name: "", url: "" }]);
  const updateShop = (index: number, key: keyof HomePopularShop, value: string) => {
    const next = [...popularShops];
    next[index] = { ...next[index], [key]: value };
    setPopularShops(next);
  };
  const removeShop = (index: number) => setPopularShops(popularShops.filter((_, i) => i !== index));

  // --- Handlers for Categories ---
  const addCategory = () => setCategories([...categories, { name: "", iconName: "", url: "" }]);
  const updateCategory = (index: number, key: keyof HomeCategory, value: string) => {
    const next = [...categories];
    next[index] = { ...next[index], [key]: value };
    setCategories(next);
  };
  const removeCategory = (index: number) => setCategories(categories.filter((_, i) => i !== index));

  // --- Handlers for FAQs ---
  const addFaq = () => setFaqs([...faqs, { question: "", answer: "" }]);
  const updateFaq = (index: number, key: keyof HomeFaq, value: string) => {
    const next = [...faqs];
    next[index] = { ...next[index], [key]: value };
    setFaqs(next);
  };
  const removeFaq = (index: number) => setFaqs(faqs.filter((_, i) => i !== index));


  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading settings...</div>;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Home Page Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage the global sections on the public home page.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50 transition"
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

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
                activeTab === tab.id
                  ? "border-emerald-500 text-emerald-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        
        {/* REVIEWS TAB */}
        {activeTab === "reviews" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">Reviews / Testimonials</h2>
              <button onClick={addReview} className="text-sm text-emerald-600 font-medium hover:text-emerald-700">+ Add Review</button>
            </div>
            {reviews.length === 0 && <p className="text-sm text-gray-500">No reviews added.</p>}
            <div className="space-y-4">
              {reviews.map((r, idx) => (
                <div key={idx} className="p-4 border border-gray-200 rounded-lg relative bg-gray-50">
                  <button onClick={() => removeReview(idx)} className="absolute top-4 right-4 text-red-500 text-sm font-medium hover:underline">Remove</button>
                  <div className="grid grid-cols-2 gap-4 mb-4 pr-16">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Author Name</label>
                      <input
                        type="text"
                        value={r.author}
                        onChange={(e) => updateReview(idx, "author", e.target.value)}
                        className="w-full border-gray-300 rounded-md shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2 border"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Rating (1-5)</label>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={r.rating}
                        onChange={(e) => updateReview(idx, "rating", Number(e.target.value))}
                        className="w-full border-gray-300 rounded-md shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2 border"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Comment</label>
                    <textarea
                      value={r.comment}
                      onChange={(e) => updateReview(idx, "comment", e.target.value)}
                      className="w-full border-gray-300 rounded-md shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2 border"
                      rows={3}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* POPULAR SHOPS TAB */}
        {activeTab === "popularShops" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">Popular Shops (Pills)</h2>
              <button onClick={addShop} className="text-sm text-emerald-600 font-medium hover:text-emerald-700">+ Add Shop</button>
            </div>
            {popularShops.length === 0 && <p className="text-sm text-gray-500">No popular shops added.</p>}
            <div className="space-y-4">
              {popularShops.map((s, idx) => (
                <div key={idx} className="p-4 border border-gray-200 rounded-lg relative bg-gray-50">
                  <button onClick={() => removeShop(idx)} className="absolute top-4 right-4 text-red-500 text-sm font-medium hover:underline">Remove</button>
                  <div className="grid grid-cols-2 gap-4 pr-16">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Shop Name</label>
                      <input
                        type="text"
                        value={s.name}
                        onChange={(e) => updateShop(idx, "name", e.target.value)}
                        className="w-full border-gray-300 rounded-md shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2 border"
                        placeholder="e.g. AliExpress"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">URL / Slug</label>
                      <input
                        type="text"
                        value={s.url}
                        onChange={(e) => updateShop(idx, "url", e.target.value)}
                        className="w-full border-gray-300 rounded-md shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2 border"
                        placeholder="e.g. /aliexpress"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CATEGORIES TAB */}
        {activeTab === "categories" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">Categories</h2>
              <button onClick={addCategory} className="text-sm text-emerald-600 font-medium hover:text-emerald-700">+ Add Category</button>
            </div>
            {categories.length === 0 && <p className="text-sm text-gray-500">No categories added.</p>}
            <div className="space-y-4">
              {categories.map((c, idx) => (
                <div key={idx} className="p-4 border border-gray-200 rounded-lg relative bg-gray-50">
                  <button onClick={() => removeCategory(idx)} className="absolute top-4 right-4 text-red-500 text-sm font-medium hover:underline">Remove</button>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pr-16">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Category Name</label>
                      <input
                        type="text"
                        value={c.name}
                        onChange={(e) => updateCategory(idx, "name", e.target.value)}
                        className="w-full border-gray-300 rounded-md shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2 border"
                        placeholder="e.g. Electronics"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Icon Name (Emoji or text)</label>
                      <input
                        type="text"
                        value={c.iconName}
                        onChange={(e) => updateCategory(idx, "iconName", e.target.value)}
                        className="w-full border-gray-300 rounded-md shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2 border"
                        placeholder="e.g. 💻"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">URL / Link</label>
                      <input
                        type="text"
                        value={c.url}
                        onChange={(e) => updateCategory(idx, "url", e.target.value)}
                        className="w-full border-gray-300 rounded-md shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2 border"
                        placeholder="e.g. /?search=electronics"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FAQS TAB */}
        {activeTab === "faqs" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">Global FAQs</h2>
              <button onClick={addFaq} className="text-sm text-emerald-600 font-medium hover:text-emerald-700">+ Add FAQ</button>
            </div>
            {faqs.length === 0 && <p className="text-sm text-gray-500">No FAQs added.</p>}
            <div className="space-y-4">
              {faqs.map((f, idx) => (
                <div key={idx} className="p-4 border border-gray-200 rounded-lg relative bg-gray-50">
                  <button onClick={() => removeFaq(idx)} className="absolute top-4 right-4 text-red-500 text-sm font-medium hover:underline">Remove</button>
                  <div className="mb-4 pr-16">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Question</label>
                    <input
                      type="text"
                      value={f.question}
                      onChange={(e) => updateFaq(idx, "question", e.target.value)}
                      className="w-full border-gray-300 rounded-md shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2 border"
                      placeholder="e.g. How does cashback work?"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Answer</label>
                    <textarea
                      value={f.answer}
                      onChange={(e) => updateFaq(idx, "answer", e.target.value)}
                      className="w-full border-gray-300 rounded-md shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2 border"
                      rows={4}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
