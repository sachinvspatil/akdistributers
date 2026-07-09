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
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const EMPTY = { name: "", brand: "", sku: "", selling_price: 0, commission_per_unit: 0, current_stock: 0 };

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [toDelete, setToDelete] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/products");
      setProducts(data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (p) => { setEditing(p); setForm({ ...p }); setOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        selling_price: Number(form.selling_price),
        commission_per_unit: Number(form.commission_per_unit),
        current_stock: Number(form.current_stock),
      };
      if (editing) await api.put(`/products/${editing.id}`, payload);
      else await api.post("/products", payload);
      toast.success(editing ? "Product updated" : "Product added");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await api.delete(`/products/${toDelete.id}`);
      toast.success("Product deleted");
      setToDelete(null);
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Products"
        subtitle={`${products.length} SKU${products.length === 1 ? "" : "s"} in catalog`}
        testid="products-page"
        actions={
          <Button data-testid="add-product-btn" onClick={openCreate} className="bg-blue-900 hover:bg-blue-800">
            <Plus className="h-4 w-4 mr-2" /> Add Product
          </Button>
        }
      />

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">Loading…</TableCell></TableRow>
                ) : products.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">No products yet</TableCell></TableRow>
                ) : (
                  products.map((p) => (
                    <TableRow key={p.id} data-testid={`product-row-${p.sku}`}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.brand}</TableCell>
                      <TableCell><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{p.sku}</code></TableCell>
                      <TableCell className="text-right tabular-nums">{money(p.selling_price)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(p.commission_per_unit)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={p.current_stock < 50 ? "text-amber-600 font-medium" : ""}>{p.current_stock}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button data-testid={`edit-product-${p.sku}`} variant="ghost" size="icon" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button data-testid={`delete-product-${p.sku}`} variant="ghost" size="icon" onClick={() => setToDelete(p)}>
                            <Trash2 className="h-4 w-4 text-rose-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Name</Label>
              <Input data-testid="product-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Brand</Label>
              <Input data-testid="product-brand-input" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>SKU</Label>
              <Input data-testid="product-sku-input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Selling Price</Label>
              <Input data-testid="product-price-input" type="number" step="0.01" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Commission / Unit</Label>
              <Input data-testid="product-commission-input" type="number" step="0.01" value={form.commission_per_unit} onChange={(e) => setForm({ ...form, commission_per_unit: e.target.value })} required />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Current Stock</Label>
              <Input data-testid="product-stock-input" type="number" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })} required />
            </div>
            <DialogFooter className="col-span-2 mt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button data-testid="product-save-btn" type="submit" className="bg-blue-900 hover:bg-blue-800">{editing ? "Update" : "Add"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {toDelete?.name}. Existing sales referencing it stay intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="confirm-delete-product" onClick={confirmDelete} className="bg-rose-600 hover:bg-rose-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
