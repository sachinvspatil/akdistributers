import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@/App.css";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";

import LoginPage from "@/pages/Login";
import AppShell from "@/components/layout/AppShell";

import AdminDashboard from "@/pages/admin/Dashboard";
import Products from "@/pages/admin/Products";
import Salespersons from "@/pages/admin/Salespersons";
import Vendors from "@/pages/admin/Vendors";
import Inventory from "@/pages/admin/Inventory";
import Allocations from "@/pages/admin/Allocations";
import AdminSales from "@/pages/admin/Sales";
import AdminCollections from "@/pages/admin/Collections";
import Reports from "@/pages/admin/Reports";

import SPDashboard from "@/pages/salesperson/Dashboard";
import SPRecordSale from "@/pages/salesperson/RecordSale";
import SPCollections from "@/pages/salesperson/Collections";
import EODSummary from "@/pages/salesperson/EODSummary";

function RequireRole({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500 text-sm">Loading…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/sales"} replace />;
  }
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500 text-sm">Loading…</div>
      </div>
    );
  }
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireRole role="admin"><AppShell role="admin" /></RequireRole>}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/products" element={<Products />} />
        <Route path="/admin/salespersons" element={<Salespersons />} />
        <Route path="/admin/vendors" element={<Vendors />} />
        <Route path="/admin/inventory" element={<Inventory />} />
        <Route path="/admin/allocations" element={<Allocations />} />
        <Route path="/admin/sales" element={<AdminSales />} />
        <Route path="/admin/collections" element={<AdminCollections />} />
        <Route path="/admin/reports" element={<Reports />} />
      </Route>

      <Route element={<RequireRole role="salesperson"><AppShell role="salesperson" /></RequireRole>}>
        <Route path="/sales" element={<SPDashboard />} />
        <Route path="/sales/record" element={<SPRecordSale />} />
        <Route path="/sales/collections" element={<SPCollections />} />
        <Route path="/sales/eod" element={<EODSummary />} />
      </Route>

      <Route path="/" element={<Navigate to={user ? (user.role === "admin" ? "/admin" : "/sales") : "/login"} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
      </AuthProvider>
    </div>
  );
}

export default App;
