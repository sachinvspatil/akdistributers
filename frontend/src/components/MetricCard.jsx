import { Card, CardContent } from "@/components/ui/card";

export default function MetricCard({ icon: Icon, label, value, hint, tone = "blue", testid }) {
  const toneMap = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    slate: "bg-slate-100 text-slate-700",
    violet: "bg-violet-50 text-violet-700",
  };
  return (
    <Card data-testid={testid} className="metric-card border-slate-200 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-2xl sm:text-3xl font-heading font-extrabold text-slate-900 truncate">
              {value}
            </p>
            {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
          </div>
          {Icon && (
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${toneMap[tone]}`}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
