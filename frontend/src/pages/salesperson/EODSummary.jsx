import { useEffect, useState } from "react";
import api, { money, todayStr } from "@/lib/api";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";

export default function EODSummary() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get("/eod-summary", { params: { date } }).then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [date]);

  const rows = (data?.rows || []).filter((r) => isAdmin ? true : r.salesperson_id === user?.salesperson_id);

  return (
    <PageContainer>
      <PageHeader
        title="End of Day Summary"
        subtitle={`Daily performance snapshot for ${date}`}
        testid="eod-page"
      />
      <div className="mb-4 flex gap-3 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs">Date</Label>
          <Input data-testid="eod-date-filter" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </div>
      </div>
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Salesperson</TableHead>
                  <TableHead className="text-right">Opening</TableHead>
                  <TableHead className="text-right">Sold</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Collection</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">Loading…</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">No data for {date}</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.salesperson_id}>
                    <TableCell className="font-medium">{r.salesperson_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.opening_stock}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-700">{r.sold_qty}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.remaining_stock}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{money(r.sales_value)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(r.collection_amount)}</TableCell>
                    <TableCell className="text-right tabular-nums text-blue-900 font-semibold">{money(r.commission_earned)}</TableCell>
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
