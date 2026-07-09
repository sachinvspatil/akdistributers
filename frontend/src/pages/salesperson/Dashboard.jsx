import { useEffect, useState } from "react";
import api, { money } from "@/lib/api";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import MetricCard from "@/components/MetricCard";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, ShoppingCart, IndianRupee, Wallet, Boxes, TrendingUp } from "lucide-react";

export default function SalespersonDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/dashboard/salesperson").then((r) => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <PageContainer>
        <PageHeader title="My Dashboard" subtitle="Today's summary" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="My Dashboard" subtitle="Today's summary" testid="sp-dashboard" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <MetricCard testid="sp-opening" icon={Boxes} tone="blue" label="Opening Stock" value={data.opening_stock} hint="units allocated today" />
        <MetricCard testid="sp-sold" icon={ShoppingCart} tone="emerald" label="Sold" value={data.sold_qty} hint="units" />
        <MetricCard testid="sp-remaining" icon={Package} tone="amber" label="Remaining Stock" value={data.remaining_stock} />
        <MetricCard testid="sp-sales" icon={TrendingUp} tone="violet" label="Today's Sales" value={money(data.today_sales)} />
        <MetricCard testid="sp-collections" icon={IndianRupee} tone="slate" label="Collections" value={money(data.today_collections)} />
        <MetricCard testid="sp-commission" icon={Wallet} tone="rose" label="Commission Earned" value={money(data.commission)} />
      </div>

      <Card className="mt-6 border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="p-5 pb-3"><p className="text-sm font-heading font-bold text-slate-900">My Stock — Today</p></div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Allocated</TableHead>
                  <TableHead className="text-right">Sold</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.inventory.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">No stock allocated today</TableCell></TableRow>
                ) : data.inventory.map((i) => (
                  <TableRow key={i.product_id}>
                    <TableCell className="font-medium">{i.product_name}<div className="text-xs text-slate-500">{i.brand} · {i.sku}</div></TableCell>
                    <TableCell className="text-right tabular-nums">{money(i.selling_price)}</TableCell>
                    <TableCell className="text-right tabular-nums">{i.allocated}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-700">{i.sold}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{i.remaining}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
