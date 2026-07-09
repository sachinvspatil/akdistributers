import { useEffect, useState } from "react";
import api, { formatApiError, money } from "@/lib/api";
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
import { Plus, Pencil, History, Search } from "lucide-react";
import { toast } from "sonner";

const EMPTY = { shop_name: "", owner_name: "", mobile: "", area: "", address: "" };

export default function VendorsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [history, setHistory] = useState(null);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/vendors");
      setRows(data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      r.shop_name.toLowerCase().includes(s) ||
      (r.owner_name || "").toLowerCase().includes(s) ||
      (r.area || "").toLowerCase().includes(s)
    );
  });

  const openCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (r) => { setEditing(r); setForm({ shop_name: r.shop_name, owner_name: r.owner_name, mobile: r.mobile, area: r.area, address: r.address }); setOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/vendors/${editing.id}`, form);
      else await api.post("/vendors", form);
      toast.success(editing ? "Vendor updated" : "Vendor added");
      setOpen(false); load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const openHistory = async (r) => {
    try {
      const { data } = await api.get(`/vendors/${r.id}/history`);
      setHistory(data);
    } catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Vendors"
        subtitle={`${rows.length} shops`}
        testid="vendors-page"
        actions={
          <Button data-testid="add-vendor-btn" onClick={openCreate} className="bg-blue-900 hover:bg-blue-800">
            <Plus className="h-4 w-4 mr-2" /> Add Vendor
          </Button>
        }
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input data-testid="vendor-search" placeholder="Search shops, owner, area…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shop</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">Loading…</TableCell></TableRow>
                ) : filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.shop_name}</TableCell>
                    <TableCell>{r.owner_name}</TableCell>
                    <TableCell>{r.mobile}</TableCell>
                    <TableCell>{r.area}</TableCell>
                    <TableCell className="text-slate-600 text-sm max-w-xs truncate">{r.address}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => openHistory(r)} data-testid={`vendor-history-${r.id}`}>
                          <History className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)} data-testid={`edit-vendor-${r.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Vendor" : "Add Vendor"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5"><Label>Shop Name</Label><Input data-testid="vendor-shop-input" value={form.shop_name} onChange={(e) => setForm({ ...form, shop_name: e.target.value })} required /></div>
            <div className="space-y-1.5"><Label>Owner Name</Label><Input data-testid="vendor-owner-input" value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} required /></div>
            <div className="space-y-1.5"><Label>Mobile</Label><Input data-testid="vendor-mobile-input" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} required /></div>
            <div className="space-y-1.5"><Label>Area</Label><Input data-testid="vendor-area-input" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} required /></div>
            <div className="col-span-2 space-y-1.5"><Label>Address</Label><Input data-testid="vendor-address-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required /></div>
            <DialogFooter className="col-span-2 mt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button data-testid="vendor-save-btn" type="submit" className="bg-blue-900 hover:bg-blue-800">{editing ? "Update" : "Add"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={!!history} onOpenChange={(v) => !v && setHistory(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{history?.vendor?.shop_name} — History</DialogTitle>
          </DialogHeader>
          {history && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 rounded-lg"><p className="text-xs text-slate-500">Total Sales</p><p className="font-heading text-lg font-bold">{money(history.total_sales)}</p></div>
                <div className="bg-emerald-50 p-3 rounded-lg"><p className="text-xs text-slate-500">Paid</p><p className="font-heading text-lg font-bold text-emerald-700">{money(history.total_paid)}</p></div>
                <div className="bg-rose-50 p-3 rounded-lg"><p className="text-xs text-slate-500">Outstanding</p><p className="font-heading text-lg font-bold text-rose-700">{money(history.outstanding)}</p></div>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">Recent Sales ({history.sales.length})</p>
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Product</TableHead><TableHead>Qty</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {history.sales.slice(0, 20).map((s) => (
                      <TableRow key={s.id}><TableCell>{s.date}</TableCell><TableCell>{s.product_name}</TableCell><TableCell>{s.quantity}</TableCell><TableCell className="text-right">{money(s.sale_value)}</TableCell></TableRow>
                    ))}
                    {history.sales.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-slate-500 py-4">No sales</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">Recent Collections ({history.collections.length})</p>
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Mode</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {history.collections.slice(0, 20).map((c) => (
                      <TableRow key={c.id}><TableCell>{c.date}</TableCell><TableCell className="uppercase text-xs">{c.payment_mode}</TableCell><TableCell className="text-right">{money(c.amount)}</TableCell></TableRow>
                    ))}
                    {history.collections.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-slate-500 py-4">No collections</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
