import { useEffect, useState } from "react";
import api, { money, todayStr } from "@/lib/api";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default function AdminCollectionsPage() {
  const [rows, setRows] = useState([]);
  const [date, setDate] = useState(todayStr());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get("/collections", { params: { date } }).then((r) => setRows(r.data)).finally(() => setLoading(false));
  }, [date]);

  const total = rows.reduce((s, x) => s + x.amount, 0);

  return (
    <PageContainer>
      <PageHeader title="Collections" subtitle={`${rows.length} entries · ${money(total)} collected`} testid="admin-collections-page" />
      <div className="mb-4 flex gap-3 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs">Date</Label>
          <Input data-testid="collections-date-filter" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
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
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">Loading…</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">No collections for {date}</TableCell></TableRow>
                ) : rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-slate-500 text-xs">{new Date(c.created_at).toLocaleTimeString()}</TableCell>
                    <TableCell className="font-medium">{c.salesperson_name}</TableCell>
                    <TableCell>{c.vendor_name}</TableCell>
                    <TableCell><Badge variant="outline" className="uppercase text-xs">{c.payment_mode}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{money(c.amount)}</TableCell>
                    <TableCell className="text-slate-500 text-sm">{c.note || ""}</TableCell>
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
