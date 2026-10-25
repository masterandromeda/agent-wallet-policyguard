import { Sidebar } from "@/components/layout/Sidebar";
import { ToastContainer } from "@/components/ui/Toast";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-base)" }}>
      {/* Fixed sidebar — 240px on lg+, hidden on smaller */}
      <Sidebar />

      {/* Main content area — offset by sidebar on desktop only */}
      <div
        className="flex flex-col min-h-screen flex-1 overflow-x-hidden w-full"
        style={{ marginLeft: "var(--sidebar-width)" }}
      >
        <main className="flex-1 w-full min-w-0">
          {children}
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}
