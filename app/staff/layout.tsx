export default function StaffRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // We intentionally keep the /staff root layout minimal.
  // Protected staff pages use the (app) route group's layout.
  return <>{children}</>;
}
