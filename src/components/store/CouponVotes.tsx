"use client";

import { useEffect, useState } from "react";

type VoteType = "up" | "down";

interface Props {
  couponId: string;
  storeSlug: string;
}

export default function CouponVotes({ couponId, storeSlug }: Props) {
  const [counts, setCounts] = useState<{ up: number; down: number } | null>(null);
  const [userVote, setUserVote] = useState<VoteType | null>(null);
  const [voting, setVoting] = useState(false);

  const storageKey = `foxzil_vote_${couponId}`;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey) as VoteType | null;
      if (stored === "up" || stored === "down") setUserVote(stored);
    } catch {}

    fetch(`/api/coupon-votes?ids=${encodeURIComponent(couponId)}`)
      .then((r) => r.json())
      .then((data) => {
        const c = data[couponId];
        if (c) setCounts(c);
      })
      .catch(() => {});
  }, [couponId, storageKey]);

  async function vote(type: VoteType) {
    if (userVote || voting) return;
    setVoting(true);

    // Optimistic update
    setCounts((prev) =>
      prev
        ? { ...prev, [type]: prev[type] + 1 }
        : { up: type === "up" ? 1 : 0, down: type === "down" ? 1 : 0 },
    );
    setUserVote(type);
    try {
      localStorage.setItem(storageKey, type);
    } catch {}

    try {
      const res = await fetch("/api/coupon-votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponId, storeSlug, voteType: type }),
      });
      if (res.ok) {
        const data = await res.json();
        setCounts(data);
      }
    } catch {}
    setVoting(false);
  }

  const up = counts?.up ?? 0;
  const down = counts?.down ?? 0;

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[11px] text-gray-400 font-medium whitespace-nowrap shrink-0">
          Did this work?
        </span>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => vote("up")}
            disabled={!!userVote || voting}
            aria-label="This coupon worked"
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition border whitespace-nowrap ${
              userVote === "up"
                ? "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm"
                : userVote
                  ? "bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed"
                  : "bg-white border-gray-200 text-gray-500 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 cursor-pointer"
            }`}
          >
            <span>👍</span>
            {up > 0 && <span className="tabular-nums">{up}</span>}
          </button>

          <button
            onClick={() => vote("down")}
            disabled={!!userVote || voting}
            aria-label="This coupon did not work"
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition border whitespace-nowrap ${
              userVote === "down"
                ? "bg-red-50 border-red-300 text-red-600 shadow-sm"
                : userVote
                  ? "bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed"
                  : "bg-white border-gray-200 text-gray-500 hover:bg-red-50 hover:border-red-300 hover:text-red-600 cursor-pointer"
            }`}
          >
            <span>👎</span>
            {down > 0 && <span className="tabular-nums">{down}</span>}
          </button>
        </div>

        {userVote && (
          <span className="text-[11px] text-gray-400 italic truncate">Thanks!</span>
        )}
      </div>
    </div>
  );
}
