import { useEffect, useState } from "react";
import api, { money, todayStr } from "@/lib/api";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default function AdminSalesPage() {
  const [sales, setSales] = useState([]);
  const [date, setDate] = useState(todayStr());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get("/sales", { params: { date } }).then((r) => setSales(r.data)).finally(() => setLoading(false));
  }, [date]);

  const total = sales.reduce((s, x) => s + x.sale_value, 0);
  const qty = sales.reduce((s, x) => s + x.quantity, 0);

  return (
    <PageContainer>
      <PageHeader title="Sales" subtitle={`${sales.length} entries · ${qty} units · ${money(total)}`} testid="admin-sales-page" />
      <div className="mb-4 flex gap-3 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs">Date</Label>
          <Input data-testid="sales-date-filter" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </div>
      </div>
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Salesperson</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-500">Loading…</TableCell></TableRow>
                ) : sales.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-500">No sales for {date}</TableCell></TableRow>
                ) : sales.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-slate-500 text-xs">{new Date(s.created_at).toLocaleTimeString()}</TableCell>
                    <TableCell className="font-medium">{s.salesperson_name}</TableCell>
                    <TableCell>{s.vendor_name}</TableCell>
                    <TableCell>{s.product_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(s.unit_price)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{money(s.sale_value)}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-700">{money(s.commission)}</TableCell>
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
