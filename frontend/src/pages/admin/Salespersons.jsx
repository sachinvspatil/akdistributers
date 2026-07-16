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
import { Plus, Pencil, PowerOff } from "lucide-react";
import { toast } from "sonner";

const EMPTY = { name: "", mobile: "", area: "", status: "active", email: "", password: "", salesman_id: "" };

export default function SalespersonsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/salespersons");
      setRows(data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (r) => {
    setEditing(r);
    setForm({ name: r.name, mobile: r.mobile, area: r.area, status: r.status, email: r.email || "", password: "", salesman_id: r.salesman_id || "" });
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      if (!payload.email) delete payload.email;
      if (editing) await api.put(`/salespersons/${editing.id}`, payload);
      else await api.post("/salespersons", payload);
      toast.success(editing ? "Salesperson updated" : "Salesperson added");
      setOpen(false); load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const toggleStatus = async (r) => {
    try {
      await api.put(`/salespersons/${r.id}`, { status: r.status === "active" ? "inactive" : "active" });
      toast.success(`Marked ${r.status === "active" ? "inactive" : "active"}`);
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Salespersons"
        subtitle={`${rows.length} team members`}
        testid="salespersons-page"
        actions={
          <Button data-testid="add-salesperson-btn" onClick={openCreate} className="bg-blue-900 hover:bg-blue-800">
            <Plus className="h-4 w-4 mr-2" /> Add Salesperson
          </Button>
        }
      />

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SE ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Route / Area</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">Loading…</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{r.salesman_id || "—"}</code></TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.mobile}</TableCell>
                    <TableCell>{r.area}</TableCell>
                    <TableCell className="text-slate-600 text-sm">{r.email || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={r.status === "active" ? "text-emerald-700 border-emerald-200 bg-emerald-50" : "text-slate-600 border-slate-200 bg-slate-50"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)} data-testid={`edit-sp-${r.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => toggleStatus(r)} data-testid={`toggle-sp-${r.id}`}>
                          <PowerOff className="h-4 w-4" />
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Salesperson" : "Add Salesperson"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Salesman ID</Label>
              <Input data-testid="sp-salesman-id-input" value={form.salesman_id} onChange={(e) => setForm({ ...form, salesman_id: e.target.value })} placeholder="BLRAKDLT01" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger data-testid="sp-status-trigger"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Name</Label>
              <Input data-testid="sp-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Mobile</Label>
              <Input data-testid="sp-mobile-input" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Route / Area</Label>
              <Input data-testid="sp-area-input" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Email (for login)</Label>
              <Input data-testid="sp-email-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{editing ? "New Password (leave blank to keep)" : "Password"}</Label>
              <Input data-testid="sp-password-input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <DialogFooter className="col-span-2 mt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button data-testid="sp-save-btn" type="submit" className="bg-blue-900 hover:bg-blue-800">{editing ? "Update" : "Add"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
