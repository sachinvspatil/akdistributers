import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import App from "@/App";

// Suppress benign ResizeObserver loop errors triggered by recharts + Radix Dialog
// (only affects dev-mode CRA error overlay; not a real bug)
const _ROErrorRe = /ResizeObserver loop/i;
window.addEventListener("error", (e) => {
  if (e && e.message && _ROErrorRe.test(e.message)) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = e?.reason?.message || String(e?.reason || "");
  if (_ROErrorRe.test(msg)) e.preventDefault();
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
