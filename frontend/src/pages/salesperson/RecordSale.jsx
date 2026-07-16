import { useEffect, useMemo, useState } from "react";
import api, { formatApiError, money, todayStr } from "@/lib/api";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Send } from "lucide-react";
import { toast } from "sonner";

export default function SPRecordSale() {
  const [inventory, setInventory] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [sales, setSales] = useState([]);
  const [form, setForm] = useState({ vendor_id: "", product_id: "", quantity: 1 });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const [inv, v, s] = await Promise.all([
      api.get("/my-inventory"),
      api.get("/my-vendors"),
      api.get("/sales", { params: { date: todayStr() } }),
    ]);
    setInventory(inv.data); setVendors(v.data); setSales(s.data);
  };
  useEffect(() => { load(); }, []);

  const selectedProduct = useMemo(
    () => inventory.find((i) => i.product_id === form.product_id),
    [inventory, form.product_id],
  );
  const preview = selectedProduct ? (selectedProduct.selling_price * Number(form.quantity || 0)) : 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    if (Number(form.quantity) > selectedProduct.remaining) {
      toast.error(`Only ${selectedProduct.remaining} unit(s) remaining`);
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/sales", { vendor_id: form.vendor_id, product_id: form.product_id, quantity: Number(form.quantity) });
      toast.success("Sale recorded");
      setForm({ vendor_id: "", product_id: "", quantity: 1 });
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally { setSubmitting(false); }
  };

  const totalToday = sales.reduce((s, x) => s + x.sale_value, 0);

  return (
    <PageContainer>
      <PageHeader title="Record Sale" subtitle={`Today: ${sales.length} entries · ${money(totalToday)}`} testid="sp-record-sale-page" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <p className="font-heading font-bold text-slate-900 mb-4">New Sale Entry</p>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Vendor</Label>
                <Select value={form.vendor_id} onValueChange={(v) => setForm({ ...form, vendor_id: v })}>
                  <SelectTrigger data-testid="sale-vendor-trigger"><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.shop_name} · {v.area}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Product</Label>
                <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                  <SelectTrigger data-testid="sale-product-trigger"><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {inventory.filter(i => i.remaining > 0).map((i) => (
                      <SelectItem key={i.product_id} value={i.product_id}>{i.product_name} — {i.remaining} left</SelectItem>
                    ))}
                    {inventory.filter(i => i.remaining > 0).length === 0 && <div className="p-2 text-sm text-slate-500">No stock available today</div>}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input data-testid="sale-qty-input" type="number" min="1" max={selectedProduct?.remaining || undefined} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
                {selectedProduct && (
                  <p className="text-xs text-slate-500">
                    Max: <span className="font-medium">{selectedProduct.remaining}</span> · Unit price: {money(selectedProduct.selling_price)}
                  </p>
                )}
              </div>
              <div className="bg-blue-50 rounded-lg px-4 py-3 flex justify-between">
                <span className="text-sm text-slate-700">Sale Value</span>
                <span className="font-heading text-lg font-bold text-blue-900" data-testid="sale-preview-value">{money(preview)}</span>
              </div>
              <Button
                data-testid="record-sale-btn"
                type="submit"
                className="w-full bg-blue-900 hover:bg-blue-800"
                disabled={submitting || !form.vendor_id || !form.product_id}
              >
                <Send className="h-4 w-4 mr-2" /> Record Sale
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="p-5 pb-3"><p className="text-sm font-heading font-bold text-slate-900">Today's Sales ({sales.length})</p></div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">No sales yet today</TableCell></TableRow>
                  ) : sales.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs text-slate-500">{new Date(s.created_at).toLocaleTimeString()}</TableCell>
                      <TableCell className="font-medium">{s.vendor_name}</TableCell>
                      <TableCell>{s.product_name}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{money(s.sale_value)}</TableCell>
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
