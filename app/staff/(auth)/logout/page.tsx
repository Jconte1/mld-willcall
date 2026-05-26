"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { appPath } from "@/lib/paths";

export default function StaffLogoutPage() {
  useEffect(() => {
    signOut({ callbackUrl: appPath("/staff/login") });
  }, []);

  return null;
}
