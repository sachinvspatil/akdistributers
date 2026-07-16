import { useEffect, useState } from "react";
import api, { formatApiError, money, todayStr } from "@/lib/api";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Send } from "lucide-react";

const MODES = [
  { v: "cash", label: "Cash" },
  { v: "upi", label: "UPI" },
  { v: "card", label: "Card" },
  { v: "cheque", label: "Cheque" },
  { v: "bank_transfer", label: "Bank Transfer" },
];

export default function SPCollections() {
  const [vendors, setVendors] = useState([]);
  const [collections, setCollections] = useState([]);
  const [form, setForm] = useState({ vendor_id: "", amount: "", payment_mode: "cash", note: "" });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const [v, c] = await Promise.all([
      api.get("/my-vendors"),
      api.get("/collections", { params: { date: todayStr() } }),
    ]);
    setVendors(v.data); setCollections(c.data);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/collections", { ...form, amount: Number(form.amount) });
      toast.success("Collection recorded");
      setForm({ vendor_id: "", amount: "", payment_mode: "cash", note: "" });
      load();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setSubmitting(false); }
  };

  const total = collections.reduce((s, x) => s + x.amount, 0);

  return (
    <PageContainer>
      <PageHeader title="Collections" subtitle={`Today: ${collections.length} entries · ${money(total)}`} testid="sp-collections-page" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <p className="font-heading font-bold text-slate-900 mb-4">Record Collection</p>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Vendor</Label>
                <Select value={form.vendor_id} onValueChange={(v) => setForm({ ...form, vendor_id: v })}>
                  <SelectTrigger data-testid="coll-vendor-trigger"><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.shop_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input data-testid="coll-amount-input" type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Mode</Label>
                <Select value={form.payment_mode} onValueChange={(v) => setForm({ ...form, payment_mode: v })}>
                  <SelectTrigger data-testid="coll-mode-trigger"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODES.map((m) => <SelectItem key={m.v} value={m.v}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Note</Label>
                <Textarea data-testid="coll-note-input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} />
              </div>
              <Button data-testid="record-coll-btn" type="submit" disabled={submitting || !form.vendor_id} className="w-full bg-blue-900 hover:bg-blue-800">
                <Send className="h-4 w-4 mr-2" /> Record Collection
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="p-5 pb-3"><p className="text-sm font-heading font-bold text-slate-900">Today's Collections</p></div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collections.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-500">No collections yet today</TableCell></TableRow>
                  ) : collections.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs text-slate-500">{new Date(c.created_at).toLocaleTimeString()}</TableCell>
                      <TableCell className="font-medium">{c.vendor_name}</TableCell>
                      <TableCell><Badge variant="outline" className="uppercase text-xs">{c.payment_mode}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{money(c.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
