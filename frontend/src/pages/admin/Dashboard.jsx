import { useEffect, useState } from "react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import MetricCard from "@/components/MetricCard";
import api from "@/lib/api";
import { money } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package, ShoppingCart, IndianRupee, Store, Users, TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar,
} from "recharts";

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/dashboard/admin")
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <PageContainer>
        <PageHeader title="Dashboard" subtitle="Live business overview" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        subtitle="Live overview of today's operations"
        testid="admin-dashboard"
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard testid="metric-stock" icon={Package} tone="blue" label="Godown Stock" value={data.total_stock.toLocaleString("en-IN")} hint="units available" />
        <MetricCard testid="metric-sales" icon={ShoppingCart} tone="emerald" label="Today's Sales" value={money(data.today_sales)} hint={`${data.today_qty} units sold`} />
        <MetricCard testid="metric-collections" icon={IndianRupee} tone="violet" label="Today's Collections" value={money(data.today_collections)} />
        <MetricCard testid="metric-vendors" icon={Store} tone="amber" label="Vendors" value={data.total_vendors} hint="active shops" />
        <MetricCard testid="metric-salespersons" icon={Users} tone="slate" label="Salespersons" value={data.total_salespersons} hint="active" />
        <MetricCard testid="metric-top" icon={TrendingUp} tone="rose" label="Top Product" value={data.top_products?.[0]?.product_name?.split(" ")[0] || "—"} hint={data.top_products?.[0] ? `${data.top_products[0].qty} units` : ""} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-lg">Sales — Last 7 days</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.sales_trend_7d} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748B" }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
                <Tooltip
                  contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => money(v)}
                />
                <Line type="monotone" dataKey="sales" stroke="#1E3A8A" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-lg">Top Selling Products</CardTitle>
          </CardHeader>
          <CardContent>
            {data.top_products?.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.top_products} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="product_name" tick={{ fontSize: 10, fill: "#64748B" }} interval={0} angle={-20} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="qty" fill="#1E3A8A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500 py-12 text-center">No sales data yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
