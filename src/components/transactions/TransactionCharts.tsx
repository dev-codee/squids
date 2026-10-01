"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { Transaction } from "@/lib/transactions";

interface TransactionChartsProps {
  transactions: Transaction[];
  /** The full filtered (but unpaginated) transaction list for chart aggregation. */
  allFiltered: Transaction[];
}

// Accent palette
const COLORS = {
  accent: "#4f46e5",
  green: "#16a34a",
  amber: "#d97706",
  red: "#dc2626",
  blue: "#2563eb",
  purple: "#7c3aed",
  pink: "#db2777",
  teal: "#0d9488",
  orange: "#ea580c",
  cyan: "#0891b2",
  indigo: "#4f46e5",
};

const BAR_COLORS = [
  COLORS.accent,
  COLORS.blue,
  COLORS.purple,
  COLORS.teal,
  COLORS.pink,
  COLORS.orange,
  COLORS.cyan,
  COLORS.green,
  COLORS.amber,
  COLORS.red,
];

const STATUS_COLORS: Record<string, string> = {
  approved: COLORS.green,
  pending: COLORS.amber,
  declined: COLORS.red,
  deleted: "#9ca3af",
};

// ---------------------------------------------------------------------------
// Data aggregation helpers
// ---------------------------------------------------------------------------

function aggregateByDay(transactions: Transaction[]) {
  const map = new Map<string, number>();
  for (const tx of transactions) {
    const day = tx.transactionDate
      ? new Date(tx.transactionDate).toISOString().slice(0, 10)
      : "unknown";
    map.set(day, (map.get(day) ?? 0) + tx.commission);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, commission]) => ({
      date,
      commission: Math.round(commission * 100) / 100,
    }));
}

function aggregateByAdvertiser(transactions: Transaction[]) {
  const map = new Map<string, number>();
  for (const tx of transactions) {
    const name = tx.advertiserName || `#${tx.advertiserId}`;
    map.set(name, (map.get(name) ?? 0) + tx.commission);
  }
  return Array.from(map.entries())
    .map(([name, commission]) => ({
      name: name.length > 20 ? name.slice(0, 18) + "…" : name,
      commission: Math.round(commission * 100) / 100,
    }))
    .sort((a, b) => b.commission - a.commission)
    .slice(0, 10);
}

function aggregateByStatus(transactions: Transaction[]) {
  const map = new Map<string, number>();
  for (const tx of transactions) {
    const status = tx.status || "unknown";
    map.set(status, (map.get(status) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TransactionCharts({
  allFiltered,
}: TransactionChartsProps) {
  const dailyData = aggregateByDay(allFiltered);
  const advertiserData = aggregateByAdvertiser(allFiltered);
  const statusData = aggregateByStatus(allFiltered);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Line chart: commission over time */}
      <div className="col-span-1 rounded-xl border border-gray-200 bg-white p-4 shadow-card lg:col-span-2">
        <h3 className="mb-3 text-sm font-semibold text-gray-800">
          Commission Over Time
        </h3>
        {dailyData.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-400">
            No data to display
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickFormatter={(v) => {
                  const d = new Date(v);
                  return `${d.getDate()}/${d.getMonth() + 1}`;
                }}
              />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} width={60} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="commission"
                stroke={COLORS.accent}
                strokeWidth={2}
                dot={{ r: 3, fill: COLORS.accent }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Pie chart: status distribution */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-card">
        <h3 className="mb-3 text-sm font-semibold text-gray-800">
          Status Distribution
        </h3>
        {statusData.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-400">
            No data to display
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) =>
                  `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {statusData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={STATUS_COLORS[entry.name] ?? "#9ca3af"}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bar chart: commission by top 10 advertisers */}
      <div className="col-span-1 rounded-xl border border-gray-200 bg-white p-4 shadow-card lg:col-span-3">
        <h3 className="mb-3 text-sm font-semibold text-gray-800">
          Top 10 Advertisers by Commission
        </h3>
        {advertiserData.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-400">
            No data to display
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={advertiserData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis
                type="category"
                dataKey="name"
                width={140}
                tick={{ fontSize: 11, fill: "#6b7280" }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="commission" name="Commission" radius={[0, 4, 4, 0]}>
                {advertiserData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={BAR_COLORS[index % BAR_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
