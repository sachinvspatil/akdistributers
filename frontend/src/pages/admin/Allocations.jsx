import { useCallback, useEffect, useState } from "react";
import api, { formatApiError, todayStr } from "@/lib/api";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export default function AllocationsPage() {
  const [allocations, setAllocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayStr());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ salesperson_id: "", product_id: "", quantity: 0, date: todayStr() });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, p, s] = await Promise.all([
        api.get("/allocations", { params: { date } }),
        api.get("/products"),
        api.get("/salespersons"),
      ]);
      setAllocations(a.data); setProducts(p.data); setSalespersons(s.data.filter((sp) => sp.status === "active"));
    } finally { setLoading(false); }
  }, [date]);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/allocations", { ...form, quantity: Number(form.quantity) });
      toast.success("Stock allocated");
      setOpen(false);
      setForm({ salesperson_id: "", product_id: "", quantity: 0, date });
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Stock Allocations"
        subtitle="Allocate morning stock to salespersons"
        testid="allocations-page"
        actions={
          <Button data-testid="new-alloc-btn" onClick={() => { setForm({ salesperson_id: "", product_id: "", quantity: 0, date }); setOpen(true); }} className="bg-blue-900 hover:bg-blue-800">
            <Plus className="h-4 w-4 mr-2" /> Allocate Stock
          </Button>
        }
      />

      <div className="mb-4 flex gap-3 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs">Filter by date</Label>
          <Input data-testid="alloc-date-filter" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Salesperson</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-500">Loading…</TableCell></TableRow>
                ) : allocations.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-500">No allocations for {date}</TableCell></TableRow>
                ) : allocations.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.date}</TableCell>
                    <TableCell className="font-medium">{a.salesperson_name}</TableCell>
                    <TableCell>{a.product_name}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{a.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Allocate Stock</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input data-testid="alloc-date-input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Salesperson</Label>
              <Select value={form.salesperson_id} onValueChange={(v) => setForm({ ...form, salesperson_id: v })}>
                <SelectTrigger data-testid="alloc-sp-trigger"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {salespersons.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · {s.area}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Product</Label>
              <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                <SelectTrigger data-testid="alloc-product-trigger"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — {p.current_stock} in godown</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input data-testid="alloc-qty-input" type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button data-testid="alloc-submit-btn" type="submit" disabled={!form.salesperson_id || !form.product_id} className="bg-blue-900 hover:bg-blue-800">Allocate</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
