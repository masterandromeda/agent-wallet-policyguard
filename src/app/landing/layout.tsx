export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      {children}
    </div>
  );
}
