import StaffShell from "@/components/staff/StaffShell";

export default function StaffAppLayout({ children }: { children: React.ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}
