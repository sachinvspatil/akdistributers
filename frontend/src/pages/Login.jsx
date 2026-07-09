import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { formatApiError } from "@/lib/api";
import { LogIn, Warehouse } from "lucide-react";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (user) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/sales"} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = await login(email.trim().toLowerCase(), password);
      toast.success(`Welcome, ${data.name}`);
      navigate(data.role === "admin" ? "/admin" : "/sales");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const quickFill = (e, u, p) => {
    e.preventDefault();
    setEmail(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen flex items-stretch bg-slate-50">
      {/* Left branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-slate-900 text-white p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 opacity-95" />
        <div className="relative">
          <div className="flex items-center gap-2 text-2xl font-heading font-extrabold">
            <div className="h-10 w-10 rounded-lg bg-blue-800 flex items-center justify-center">
              <Warehouse className="h-5 w-5" />
            </div>
            DMS<span className="text-blue-400">.</span>
          </div>
        </div>
        <div className="relative">
          <h2 className="font-heading text-4xl xl:text-5xl font-extrabold tracking-tight leading-tight">
            Run your distribution.<br />
            <span className="text-blue-400">One dashboard.</span>
          </h2>
          <p className="mt-6 text-slate-300 text-base max-w-md leading-relaxed">
            Manage inventory, allocate daily stock, record sales & collections, and track outstanding — all in a mobile-friendly business console.
          </p>
        </div>
        <div className="relative flex gap-8 text-sm">
          <div><div className="text-3xl font-heading font-extrabold text-white">50+</div><div className="text-slate-400">Vendors</div></div>
          <div><div className="text-3xl font-heading font-extrabold text-white">14</div><div className="text-slate-400">Salespersons</div></div>
          <div><div className="text-3xl font-heading font-extrabold text-white">10</div><div className="text-slate-400">Products</div></div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-slate-200 shadow-sm">
          <CardContent className="p-8">
            <div className="mb-8">
              <h1 className="font-heading text-3xl font-extrabold tracking-tight text-slate-900">Sign in</h1>
              <p className="text-sm text-slate-500 mt-1.5">
                Use your admin or salesperson credentials.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  data-testid="login-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@dms.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  data-testid="login-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                />
              </div>
              <Button
                data-testid="login-submit-btn"
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-900 hover:bg-blue-800 text-white h-11"
              >
                <LogIn className="h-4 w-4 mr-2" />
                {submitting ? "Signing in..." : "Sign in"}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-200">
              <p className="text-xs font-medium text-slate-500 mb-3">DEMO ACCOUNTS</p>
              <div className="grid gap-2 text-sm">
                <button
                  data-testid="quick-fill-admin"
                  onClick={(e) => quickFill(e, "admin@dms.com", "admin123")}
                  className="text-left px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
                >
                  <span className="font-medium text-slate-900">Admin</span>
                  <span className="text-slate-500"> · admin@dms.com / admin123</span>
                </button>
                <button
                  data-testid="quick-fill-sales"
                  onClick={(e) => quickFill(e, "sales1@dms.com", "sales123")}
                  className="text-left px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
                >
                  <span className="font-medium text-slate-900">Salesperson</span>
                  <span className="text-slate-500"> · sales1@dms.com / sales123</span>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
