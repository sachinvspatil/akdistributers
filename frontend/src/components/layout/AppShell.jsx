import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard, Package, Users, Store, Warehouse, PackageCheck,
  ShoppingCart, IndianRupee, FileBarChart2, LogOut, Menu, User, ClipboardList,
} from "lucide-react";

const ADMIN_NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true, testid: "nav-dashboard" },
  { to: "/admin/products", label: "Products", icon: Package, testid: "nav-products" },
  { to: "/admin/salespersons", label: "Salespersons", icon: Users, testid: "nav-salespersons" },
  { to: "/admin/vendors", label: "Vendors", icon: Store, testid: "nav-vendors" },
  { to: "/admin/inventory", label: "Godown Inventory", icon: Warehouse, testid: "nav-inventory" },
  { to: "/admin/allocations", label: "Stock Allocations", icon: PackageCheck, testid: "nav-allocations" },
  { to: "/admin/sales", label: "Sales", icon: ShoppingCart, testid: "nav-sales" },
  { to: "/admin/collections", label: "Collections", icon: IndianRupee, testid: "nav-collections" },
  { to: "/admin/reports", label: "Reports", icon: FileBarChart2, testid: "nav-reports" },
];

const SALES_NAV = [
  { to: "/sales", label: "My Dashboard", icon: LayoutDashboard, end: true, testid: "nav-sp-dashboard" },
  { to: "/sales/record", label: "Record Sale", icon: ShoppingCart, testid: "nav-sp-record-sale" },
  { to: "/sales/collections", label: "Collections", icon: IndianRupee, testid: "nav-sp-collections" },
  { to: "/sales/eod", label: "End of Day", icon: ClipboardList, testid: "nav-sp-eod" },
];

function NavItems({ items, onClick }) {
  return (
    <nav className="flex flex-col gap-1 px-3">
      {items.map(({ to, label, icon: Icon, end, testid }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onClick}
          data-testid={testid}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-blue-900 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`
          }
        >
          <Icon className="h-4 w-4" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default function AppShell({ role }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = role === "admin" ? ADMIN_NAV : SALES_NAV;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const SidebarContent = (
    <div className="flex h-full flex-col bg-slate-900">
      <div className="px-6 py-6 border-b border-slate-800">
        <h1 className="font-heading text-xl font-extrabold text-white tracking-tight">
          DMS<span className="text-blue-400">.</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">Distribution Management</p>
      </div>
      <div className="flex-1 py-4 overflow-y-auto">
        <NavItems items={items} onClick={() => setMobileOpen(false)} />
      </div>
      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center gap-3 px-2 pb-3">
          <div className="h-9 w-9 rounded-full bg-blue-900 flex items-center justify-center text-white text-sm font-semibold">
            <User className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>
        <Button
          data-testid="logout-btn"
          variant="secondary"
          size="sm"
          className="w-full justify-start bg-slate-800 hover:bg-slate-700 text-slate-200 border-0"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" /> Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[260px] flex-shrink-0 border-r border-slate-800">
        {SidebarContent}
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button data-testid="open-mobile-menu" variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[280px] bg-slate-900 border-slate-800">
              {SidebarContent}
            </SheetContent>
          </Sheet>
          <div className="font-heading font-extrabold text-slate-900">DMS<span className="text-blue-700">.</span></div>
          <div className="w-9" />
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
