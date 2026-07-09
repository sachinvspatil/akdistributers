import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, PackagePlus } from "lucide-react";
import { toast } from "sonner";

export default function InventoryPage() {
  const [txns, setTxns] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ product_id: "", quantity: 0, type: "stock_added", note: "" });

  const load = async () => {
    setLoading(true);
    try {
      const [t, p] = await Promise.all([api.get("/inventory/transactions"), api.get("/products")]);
      setTxns(t.data); setProducts(p.data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/inventory/transactions", { ...form, quantity: Number(form.quantity) });
      toast.success("Stock updated");
      setOpen(false); setForm({ product_id: "", quantity: 0, type: "stock_added", note: "" });
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const typeMeta = (t) => ({
    stock_added: { label: "Added", cls: "text-emerald-700 border-emerald-200 bg-emerald-50" },
    stock_allocated: { label: "Allocated", cls: "text-blue-700 border-blue-200 bg-blue-50" },
    stock_returned: { label: "Returned", cls: "text-amber-700 border-amber-200 bg-amber-50" },
  }[t] || { label: t, cls: "" });

  const totalStock = products.reduce((s, p) => s + (p.current_stock || 0), 0);

  return (
    <PageContainer>
      <PageHeader
        title="Godown Inventory"
        subtitle={`${totalStock.toLocaleString("en-IN")} units in stock across ${products.length} products`}
        testid="inventory-page"
        actions={
          <Button data-testid="add-stock-btn" onClick={() => setOpen(true)} className="bg-blue-900 hover:bg-blue-800">
            <PackagePlus className="h-4 w-4 mr-2" /> Add / Adjust Stock
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-1 border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs uppercase font-medium text-slate-500 mb-3">Current Stock</p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {products.map((p) => (
                <div key={p.id} className="flex justify-between text-sm">
                  <span className="text-slate-700 truncate">{p.name}</span>
                  <span className={`font-semibold tabular-nums ${p.current_stock < 50 ? "text-amber-600" : "text-slate-900"}`}>{p.current_stock}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="p-5 pb-3"><p className="text-sm font-heading font-bold text-slate-900">Transaction History</p></div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Salesperson</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">Loading…</TableCell></TableRow>
                  ) : txns.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">No transactions yet</TableCell></TableRow>
                  ) : txns.map((t) => {
                    const m = typeMeta(t.type);
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="text-slate-600 text-xs">{new Date(t.created_at).toLocaleString()}</TableCell>
                        <TableCell className="font-medium">{t.product_name}</TableCell>
                        <TableCell><Badge variant="outline" className={m.cls}>{m.label}</Badge></TableCell>
                        <TableCell className="tabular-nums">{t.quantity}</TableCell>
                        <TableCell className="text-slate-600 text-sm">{t.salesperson_name || "—"}</TableCell>
                        <TableCell className="text-slate-500 text-xs">{t.note || ""}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add / Adjust Stock</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Product</Label>
              <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                <SelectTrigger data-testid="inv-product-trigger"><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger data-testid="inv-type-trigger"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock_added">Stock Added</SelectItem>
                  <SelectItem value="stock_returned">Stock Returned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input data-testid="inv-qty-input" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Input data-testid="inv-note-input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button data-testid="inv-submit-btn" type="submit" disabled={!form.product_id} className="bg-blue-900 hover:bg-blue-800">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
