import { useEffect, useState } from "react";
import api, { API, money, todayStr } from "@/lib/api";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FileSpreadsheet, FileText } from "lucide-react";

const REPORTS = [
  { key: "daily_sales", label: "Daily Sales", useDate: true },
  { key: "salesperson_performance", label: "Salesperson Performance", useDate: false },
  { key: "product_sales", label: "Product-wise Sales", useDate: false },
  { key: "vendor_outstanding", label: "Vendor Outstanding", useDate: false },
  { key: "collections", label: "Collections", useDate: true },
];

function ReportTable({ report }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayStr());

  useEffect(() => {
    setLoading(true);
    const params = report.useDate ? { date } : {};
    api.get(`/reports/${report.key}`, { params }).then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [report.key, date, report.useDate]);

  const exportUrl = (fmt) => {
    const token = localStorage.getItem("dms_token") || "";
    const q = new URLSearchParams({ format: fmt });
    if (report.useDate) q.append("date", date);
    if (token) q.append("access_token", token);
    return `${API}/reports/${report.key}/export?${q.toString()}`;
  };

  const doExport = async (fmt) => {
    const params = { format: fmt };
    if (report.useDate) params.date = date;
    const res = await api.get(`/reports/${report.key}/export`, { params, responseType: "blob" });
    const url = window.URL.createObjectURL(res.data);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${report.key}.${fmt}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const isMoneyCol = (label) => /price|value|sales|amount|outstanding|collected|commission/i.test(label);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
        {report.useDate ? (
          <div className="space-y-1.5">
            <Label className="text-xs">Date</Label>
            <Input data-testid={`report-${report.key}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </div>
        ) : <div />}
        <div className="flex gap-2">
          <Button data-testid={`export-xlsx-${report.key}`} variant="outline" onClick={() => doExport("xlsx")}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
          </Button>
          <Button data-testid={`export-pdf-${report.key}`} variant="outline" onClick={() => doExport("pdf")}>
            <FileText className="h-4 w-4 mr-2" /> PDF
          </Button>
        </div>
      </div>
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {(data?.columns || []).map((c) => (
                    <TableHead key={c} className={isMoneyCol(c) ? "text-right" : ""}>{c}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={(data?.columns || []).length || 1} className="text-center py-8 text-slate-500">Loading…</TableCell></TableRow>
                ) : (data?.rows || []).length === 0 ? (
                  <TableRow><TableCell colSpan={(data?.columns || []).length || 1} className="text-center py-8 text-slate-500">No data</TableCell></TableRow>
                ) : (data.rows.map((row, i) => (
                  <TableRow key={i}>
                    {row.map((cell, j) => (
                      <TableCell key={j} className={isMoneyCol(data.columns[j]) ? "text-right tabular-nums" : ""}>
                        {isMoneyCol(data.columns[j]) && typeof cell === "number" ? money(cell) : String(cell)}
                      </TableCell>
                    ))}
                  </TableRow>
                )))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState(REPORTS[0].key);
  return (
    <PageContainer>
      <PageHeader title="Reports" subtitle="Business intelligence & exports" testid="reports-page" />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 flex-wrap h-auto">
          {REPORTS.map((r) => (
            <TabsTrigger key={r.key} value={r.key} data-testid={`report-tab-${r.key}`}>{r.label}</TabsTrigger>
          ))}
        </TabsList>
        {REPORTS.map((r) => (
          <TabsContent key={r.key} value={r.key}>
            <ReportTable report={r} />
          </TabsContent>
        ))}
      </Tabs>
    </PageContainer>
  );
}
