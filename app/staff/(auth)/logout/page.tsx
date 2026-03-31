"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

export default function StaffLogoutPage() {
  useEffect(() => {
    signOut({ callbackUrl: "/willcall/staff/login" });
  }, []);

  return null;
}
