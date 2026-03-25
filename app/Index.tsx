"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import {
  Search,
  ArrowRight,
  Users,
  Mail,
  ClipboardList,
  UserPlus,
  UserMinus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import Header from "@/components/layout/Header";
import BrandMark from "@/components/brand/BrandMark";
import CustomerAuthCard from "@/components/customer/CustomerAuthCard";
import FullPageSyncLoader from "@/components/system/FullPageSyncLoader";

import { usePickup } from "@/context/PickupContext";
import { pickupLocations, resolvePickupLocationIds } from "@/lib/pickupLocations";
import { useToast } from "@/hooks/use-toast";

type OrderSummaryRow = {
  id: string;
  orderNbr: string;
  deliveryDate: string | null;
  status: string;
  jobName: string | null;
  customerName: string;
  orderType: string;
  fulfillmentStatus: string;
  paymentStatus: string | null;
  warehouses: string[];
  lineSummary: {
    totalLines: number;
    openLines: number;
    closedLines: number;
  };
  isPickupReady: boolean;
  lastPickupAt: string | null;
  appointment: {
    id: string;
    status: string;
    startAt: string;
    endAt: string;
    locationId: string;
    orderNbrs: string[];
  } | null;
};

type MemberRow = {
  userId: string;
  name: string;
  email: string;
  role: "ADMIN" | "PM";
  lastActiveAt: string | null;
};

type InviteRow = {
  id: string;
  role: "ADMIN" | "PM";
  recipientEmail: string | null;
  recipientPhone: string | null;
  status: "Pending" | "Used" | "Revoked" | "Expired";
  createdAt: string;
  expiresAt: string | null;
  usedAt: string | null;
};

type RequestRow = {
  id: string;
  createdAt: string;
  baid: string | null;
  ip: string | null;
  userAgent: string | null;
  result: string;
  reason: string | null;
};

const ORDER_PREVIEW_LIMIT = 5;
const DESTRUCTIVE_BUTTON =
  "bg-red-500 text-white hover:bg-red-600 hover:-translate-y-[1px] transition-transform";

const Index: React.FC = () => {
  const router = useRouter();
  const { updateFormData, formData } = usePickup();
  const { status, data: session } = useSession();
  const { toast } = useToast();

  const user = session?.user as any;
  const userType = user?.type;
  const isCustomer = status === "authenticated" && userType === "customer";
  const accountRole = user?.accountRole ?? null;
  const isDeveloper = Boolean(user?.isDeveloper);
  const isAdmin = accountRole === "ADMIN" || isDeveloper;

  const [orderQuery, setOrderQuery] = useState("");
  const [error, setError] = useState("");
  const [orders, setOrders] = useState<OrderSummaryRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [actionError, setActionError] = useState("");
  const [reauthRequired, setReauthRequired] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelAppointment, setCancelAppointment] = useState<OrderSummaryRow["appointment"] | null>(
    null
  );
  const [cancelSelectedOrders, setCancelSelectedOrders] = useState<string[]>([]);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const [visibleOrderCount, setVisibleOrderCount] = useState(ORDER_PREVIEW_LIMIT);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);

  const [dashboardTab, setDashboardTab] = useState<
    "orders" | "members" | "invitations" | "requests"
  >("orders");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState("");
  const [memberQuery, setMemberQuery] = useState("");

  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [invitesError, setInvitesError] = useState("");
  const [inviteQuery, setInviteQuery] = useState("");

  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState("");

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "PM" as "ADMIN" | "PM",
  });
  const [inviteActionId, setInviteActionId] = useState<string | null>(null);
  const [memberActionId, setMemberActionId] = useState<string | null>(null);

  const [overrideBaid, setOverrideBaid] = useState("");
  const [activeBaid, setActiveBaid] = useState("");
  const [overrideInput, setOverrideInput] = useState("");

  useEffect(() => {
    if (!syncing) return;
    setSyncProgress(0);
    const interval = window.setInterval(() => {
      setSyncProgress((prev) => {
        if (prev >= 92) return prev;
        const bump = 3 + Math.random() * 6;
        return Math.min(92, prev + bump);
      });
    }, 600);

    return () => window.clearInterval(interval);
  }, [syncing]);

  useEffect(() => {
    if (!session?.user?.baid) return;
    if (overrideBaid) return;
    setActiveBaid(session.user.baid);
  }, [session, overrideBaid]);

  useEffect(() => {
    // If a staff member lands on the customer home, send them to staff.
    if (status === "authenticated" && userType === "staff") {
      router.replace("/staff");
    }
  }, [status, userType, router]);

  const effectiveBaid = (overrideBaid || activeBaid || "").trim().toUpperCase();

  const roleLabel = (role: "ADMIN" | "PM") => (role === "ADMIN" ? "Admin" : "Manager");

  const statusBadgeVariant = (status: InviteRow["status"]) => {
    if (status === "Pending") return "secondary";
    if (status === "Used") return "default";
    if (status === "Revoked") return "destructive";
    return "outline";
  };

  const applyOverrideBaid = () => {
    const normalized = overrideInput.trim().toUpperCase();
    if (!/^BA\\d{7}$/.test(normalized)) {
      toast({
        title: "Invalid Customer ID#",
        description: "Enter a Customer ID# in the format BA1234567.",
      });
      return;
    }
    setOverrideBaid(normalized);
    setActiveBaid(normalized);
    setDashboardTab("orders");
  };

  const clearOverrideBaid = () => {
    setOverrideBaid("");
    setOverrideInput("");
    if (session?.user?.baid) {
      setActiveBaid(session.user.baid);
    }
  };

  const loadOrders = async (user: any, cancelledRef: { current: boolean }, baid: string) => {
    if (!isCustomer || !user?.email || !baid) return;

    setOrdersLoading(true);
    setOrdersError("");
    setReauthRequired(false);

    console.log("[orders] request", {
      userId: user?.id,
      email: user?.email,
      baid: baid,
    });

    try {
      const res = await fetch("/api/customer/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, baid: baid, userId: user.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (cancelledRef.current) return;

      console.log("[orders] response", { ok: res.ok, status: res.status, data });
      if (!res.ok) {
        const message = data?.message ?? "Unable to load orders.";
        setOrdersError(message);
        if (
          typeof message === "string" &&
          message.toLowerCase().includes("no baid")
        ) {
          setReauthRequired(true);
        }
        return;
      }
      setOrders(Array.isArray(data?.orders) ? data.orders : []);
    } catch {
      if (!cancelledRef.current) setOrdersError("Unable to load orders.");
    } finally {
      if (!cancelledRef.current) setOrdersLoading(false);
    }
  };

  const reloadOrders = async () => {
    const user = session?.user as any;
    if (!user?.email || !effectiveBaid) return;
    const cancelledRef = { current: false };
    await loadOrders(user, cancelledRef, effectiveBaid);
  };

  const runCustomerSync = async (user: any, baid: string) => {
    if (!isCustomer || !user?.email || !baid) return;
    setSyncing(true);
    setSyncProgress(5);

    try {
      const res = await fetch("/api/customer/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, baid: baid, userId: user.id }),
      });
      const data = await res.json().catch(() => ({}));

      if (data?.status === "failed" || data?.status === "backoff") {
        console.warn("[orders][sync] fallback", data);
        const lastSyncAt = data?.lastSyncAt ? new Date(data.lastSyncAt) : null;
        const description = lastSyncAt
          ? `Showing last synced data from ${lastSyncAt.toLocaleString("en-US")}.`
          : "Showing cached data while we retry the sync.";
        toast({
          title: "Sync unavailable",
          description,
        });
      }
    } finally {
      setSyncProgress(100);
      window.setTimeout(() => setSyncing(false), 250);
    }
  };

  useEffect(() => {
    if (!isCustomer) return;
    const user = session?.user as any;
    if (!user?.email || !effectiveBaid) return;

    const cancelledRef = { current: false };
    const run = async () => {
      await runCustomerSync(user, effectiveBaid);
      if (!cancelledRef.current) {
        await loadOrders(user, cancelledRef, effectiveBaid);
      }
    };
    run();

    return () => {
      cancelledRef.current = true;
    };
  }, [isCustomer, session, effectiveBaid]);

  const filteredOrders = useMemo(() => {
    if (!orderQuery.trim()) return orders;
    const q = orderQuery.trim().toLowerCase();
    return orders.filter((order) => {
      const hay = [
        order.orderNbr,
        order.jobName,
        order.customerName,
        order.orderType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [orders, orderQuery]);

  useEffect(() => {
    setVisibleOrderCount(ORDER_PREVIEW_LIMIT);
  }, [orderQuery, orders.length]);

  const visibleOrders = useMemo(
    () => filteredOrders.slice(0, visibleOrderCount),
    [filteredOrders, visibleOrderCount]
  );
  const remainingOrders = Math.max(filteredOrders.length - visibleOrderCount, 0);

  const handleOrderCardClick = (
    event: React.MouseEvent<HTMLDivElement>,
    orderNbr: string,
    isScheduled: boolean,
    isPickupReady: boolean
  ) => {
    if (isScheduled || !isPickupReady) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("button,a,input,label")) return;
    toggleOrder(orderNbr);
  };

  const toggleOrder = (orderNbr: string) => {
    setSelectedOrders((prev) => {
      if (prev.includes(orderNbr)) {
        return prev.filter((id) => id !== orderNbr);
      }
      return [...prev, orderNbr];
    });
    setError("");
  };

  const selectedOrderDetails = useMemo(() => {
    return orders.filter((order) => selectedOrders.includes(order.orderNbr));
  }, [orders, selectedOrders]);

  useEffect(() => {
    setSelectedOrders((prev) =>
      prev.filter((orderNbr) => {
        const order = orders.find((o) => o.orderNbr === orderNbr);
        return !order?.appointment && order?.isPickupReady !== false;
      })
    );
  }, [orders]);

  const selectedLocationState = useMemo(() => {
    const locationMap = new Map<string, string[]>();
    let hasUnknown = false;

    for (const order of selectedOrderDetails) {
      const { locationIds, unknownWarehouses } = resolvePickupLocationIds(order.warehouses);
      if (unknownWarehouses.length || locationIds.length === 0) hasUnknown = true;
      for (const id of locationIds) {
        const existing = locationMap.get(id) ?? [];
        locationMap.set(id, [...existing, order.orderNbr]);
      }
    }

    return {
      locationIds: Array.from(locationMap.keys()),
      hasUnknown,
      groups: Array.from(locationMap.entries()).map(([locationId, orderNbrs]) => ({
        locationId,
        orderNbrs: Array.from(new Set(orderNbrs)),
      })),
    };
  }, [selectedOrderDetails]);

  useEffect(() => {
  if (selectedOrders.length === 0) return;

  // Only log when the UI would block/complain.
    if (selectedLocationState.hasUnknown) {
      console.groupCollapsed(
        `[pickup debug] selectedOrders=${selectedOrders.length} ` +
        `locationIds=${selectedLocationState.locationIds.join(",") || "(none)"} ` +
        `hasUnknown=${selectedLocationState.hasUnknown}`
      );

    for (const order of selectedOrderDetails) {
      const res = resolvePickupLocationIds(order.warehouses);
      console.log({
        orderNbr: order.orderNbr,
        warehouses: order.warehouses,
        resolvedLocationIds: res.locationIds,
        unknownWarehouses: res.unknownWarehouses,
      });
    }

    console.groupEnd();
  }
}, [selectedOrders, selectedOrderDetails, selectedLocationState]);

  const handleContinue = () => {
    if (!selectedOrders.length) {
      setError("Select at least one order to schedule a pickup");
      return;
    }

    if (selectedLocationState.hasUnknown) {
      setError(
        "No pickup location near you for one or more items. Please contact your sales person to coordinate."
      );
      return;
    }

    const filteredSelections = formData.selectedItems.filter((selection) =>
      selectedOrders.includes(selection.orderNbr)
    );

    updateFormData({
      pickupReference: selectedOrders.join(", "),
      appointmentGroups: selectedLocationState.groups.map((group) => ({
        id: `group-${group.locationId}`,
        locationId: group.locationId,
        orderNbrs: group.orderNbrs,
        requiredSlots: group.orderNbrs.length > 6 ? 2 : 1,
        selectedDate: "",
        selectedSlots: [],
      })),
      selectedItems: filteredSelections,
    });

    router.push("/items");
  };


  const formatAppointmentTime = (startAt: string, endAt: string) => {
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Scheduled";
    const date = start.toLocaleDateString();
    const time = start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const endTime = end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return `Scheduled for ${date} - ${time}-${endTime}`;
  };

  const formatLastPickup = (value: string | null) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const date = d.toLocaleDateString();
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return `Last pickup: ${date} ${time}`;
  };

  const handleCancel = async (appointmentId: string) => {
    const user = session?.user as any;
    if (!user?.id || !user?.email) return false;
    setActionError("");
    const res = await fetch(`/api/customer/pickups/${appointmentId}/cancel`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, email: user.email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActionError(data?.message ?? "Unable to cancel pickup.");
      return false;
    }
    reloadOrders();
    return true;
  };

  const openCancelDialog = (appointment: OrderSummaryRow["appointment"], focusOrder: string) => {
    if (!appointment) return;
    setCancelAppointment(appointment);
    setCancelSelectedOrders([focusOrder]);
    setCancelError("");
    setCancelDialogOpen(true);
  };

  const toggleCancelOrder = (orderNbr: string) => {
    setCancelSelectedOrders((prev) =>
      prev.includes(orderNbr) ? prev.filter((id) => id !== orderNbr) : [...prev, orderNbr]
    );
  };

  const handleConfirmCancelOrders = async () => {
    const user = session?.user as any;
    if (!user?.id || !user?.email || !cancelAppointment) return;
    setCancelSubmitting(true);
    setCancelError("");

    const allOrders = cancelAppointment.orderNbrs ?? [];
    const remaining = allOrders.filter((orderNbr) => !cancelSelectedOrders.includes(orderNbr));

    const res = await fetch(`/api/customer/pickups/${cancelAppointment.id}/orders`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        email: user.email,
        orderNbrs: remaining,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setCancelError(data?.message ?? "Unable to update pickup.");
      setCancelSubmitting(false);
      return;
    }

    setCancelDialogOpen(false);
    setCancelAppointment(null);
    setCancelSelectedOrders([]);
    setCancelSubmitting(false);
    reloadOrders();
  };

  const cancelImpactMessage = useMemo(() => {
    if (!cancelAppointment) return "";
    const total = cancelAppointment.orderNbrs.length;
    const remaining = total - cancelSelectedOrders.length;
    if (remaining <= 0) return "This will cancel the entire appointment.";
    if (total > 6 && remaining <= 6) {
      return "Appointment will shrink to a 15-minute window and free the extra time.";
    }
    return "Appointment time will remain the same.";
  }, [cancelAppointment, cancelSelectedOrders]);

  const handleReschedule = async (appointment: OrderSummaryRow["appointment"]) => {
    if (!appointment) return;
    const ok = await handleCancel(appointment.id);
    if (!ok) return;
    updateFormData({
      pickupReference: appointment.orderNbrs.join(", "),
      appointmentGroups: [
        {
          id: `group-${appointment.locationId}`,
          locationId: appointment.locationId,
          orderNbrs: appointment.orderNbrs,
          requiredSlots: appointment.orderNbrs.length > 6 ? 2 : 1,
          selectedDate: "",
          selectedSlots: [],
        },
      ],
      selectedItems: [],
    });
    router.push("/items");
  };

  const fetchMembers = async () => {
    if (!isCustomer || !user?.id || !effectiveBaid) return;
    setMembersLoading(true);
    setMembersError("");
    try {
      const res = await fetch("/api/customer/invites/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, baid: effectiveBaid }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMembersError(data?.message ?? "Unable to load members.");
        return;
      }
      setMembers(Array.isArray(data?.members) ? data.members : []);
    } catch {
      setMembersError("Unable to load members.");
    } finally {
      setMembersLoading(false);
    }
  };

  const fetchInvites = async () => {
    if (!isCustomer || !user?.id || !effectiveBaid) return;
    setInvitesLoading(true);
    setInvitesError("");
    try {
      const res = await fetch("/api/customer/invites/invitations/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, baid: effectiveBaid }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInvitesError(data?.message ?? "Unable to load invitations.");
        return;
      }
      setInvites(Array.isArray(data?.invites) ? data.invites : []);
    } catch {
      setInvitesError("Unable to load invitations.");
    } finally {
      setInvitesLoading(false);
    }
  };

  const fetchRequests = async () => {
    if (!isCustomer || !user?.id || !effectiveBaid || !isAdmin) return;
    setRequestsLoading(true);
    setRequestsError("");
    try {
      const res = await fetch("/api/customer/invites/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, baid: effectiveBaid }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRequestsError(data?.message ?? "Unable to load requests.");
        return;
      }
      setRequests(Array.isArray(data?.requests) ? data.requests : []);
    } catch {
      setRequestsError("Unable to load requests.");
    } finally {
      setRequestsLoading(false);
    }
  };

  const handleInviteSubmit = async () => {
    if (!isAdmin || !user?.id || !effectiveBaid) return;
    const payload = {
      userId: user.id,
      baid: effectiveBaid,
      name: inviteForm.name.trim(),
      email: inviteForm.email.trim(),
      phone: inviteForm.phone.trim() || undefined,
      role: inviteForm.role,
    };
    if (!payload.name || !payload.email) {
      toast({ title: "Missing details", description: "Name and email are required." });
      return;
    }
    setInviteSubmitting(true);
    try {
      const res = await fetch("/api/customer/invites/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: "Invite failed",
          description: data?.message ?? "Unable to send invite.",
        });
        return;
      }
      toast({
        title: "Invite sent",
        description: "The invite code was sent successfully.",
      });
      setInviteDialogOpen(false);
      setInviteForm({ name: "", email: "", phone: "", role: "PM" });
      await fetchInvites();
    } finally {
      setInviteSubmitting(false);
    }
  };

  const openResendInvite = (invite: InviteRow) => {
    setInviteForm({
      name: invite.recipientEmail?.split("@")[0] ?? "",
      email: invite.recipientEmail ?? "",
      phone: invite.recipientPhone ?? "",
      role: invite.role,
    });
    setInviteDialogOpen(true);
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!isAdmin || !user?.id || !effectiveBaid) return;
    setInviteActionId(inviteId);
    try {
      const res = await fetch("/api/customer/invites/invitations/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, baid: effectiveBaid, inviteId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Unable to revoke",
          description: data?.message ?? "Please try again.",
        });
        return;
      }
      await fetchInvites();
    } finally {
      setInviteActionId(null);
    }
  };

  const handleUpdateMemberRole = async (targetUserId: string, role: "ADMIN" | "PM") => {
    if (!isAdmin || !user?.id || !effectiveBaid) return;
    setMemberActionId(targetUserId);
    try {
      const res = await fetch("/api/customer/invites/members/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, baid: effectiveBaid, targetUserId, role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Role update failed",
          description: data?.message ?? "Please try again.",
        });
        return;
      }
      await fetchMembers();
    } finally {
      setMemberActionId(null);
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (!isAdmin || !user?.id || !effectiveBaid) return;
    setMemberActionId(targetUserId);
    try {
      const res = await fetch("/api/customer/invites/members/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, baid: effectiveBaid, targetUserId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Unable to remove",
          description: data?.message ?? "Please try again.",
        });
        return;
      }
      await fetchMembers();
    } finally {
      setMemberActionId(null);
    }
  };

  useEffect(() => {
    if (dashboardTab === "members") {
      fetchMembers();
    }
  }, [dashboardTab, effectiveBaid]);

  useEffect(() => {
    if (dashboardTab === "invitations") {
      fetchInvites();
    }
  }, [dashboardTab, effectiveBaid]);

  useEffect(() => {
    if (dashboardTab === "requests" && isAdmin) {
      fetchRequests();
    }
  }, [dashboardTab, effectiveBaid, isAdmin]);

  const filteredMembers = useMemo(() => {
    const needle = memberQuery.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((member) =>
      [member.name, member.email, roleLabel(member.role)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [members, memberQuery]);

  const filteredInvites = useMemo(() => {
    const needle = inviteQuery.trim().toLowerCase();
    if (!needle) return invites;
    return invites.filter((invite) => {
      const hay = [invite.recipientEmail, invite.status, roleLabel(invite.role)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [invites, inviteQuery]);

  const dashboardTabs = useMemo(() => {
    const items: { id: "orders" | "members" | "invitations" | "requests"; label: string; icon: any }[] = [
      { id: "orders", label: "Orders", icon: ClipboardList },
      { id: "members", label: "Members", icon: Users },
    ];
    if (isAdmin) {
      items.push({ id: "invitations", label: "Invitations", icon: Mail });
    }
    if (isAdmin) {
      items.push({ id: "requests", label: "Requests", icon: ClipboardList });
    }
    return items;
  }, [isAdmin]);

  return (
    <div className="min-h-screen bg-background">
      {syncing ? <FullPageSyncLoader progress={syncProgress} /> : null}
      <Header />

      <main className="container py-8 md:py-16">
        {!isCustomer ? (
          <Suspense fallback={<div className="mx-auto w-full max-w-md" />}>
            <CustomerAuthCard />
          </Suspense>
        ) : (
          <div className="max-w-6xl mx-auto">
            {/* Hero */}
            <div className="text-center mb-12 animate-fade-in">
              <div className="mx-auto mb-4">
                <BrandMark
                  size={150}
                  className="opacity-90 transition-opacity md:[&]:!opacity-90"
                />
              </div>

              <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
                Schedule Your Pickup
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Reserve your time slot and skip the wait. Select your pickup number(s) below to get started.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
              <aside className="space-y-4">
                <Card className="border-border/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Account Dashboard</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {dashboardTabs.map((tab) => (
                      <Button
                        key={tab.id}
                        variant={dashboardTab === tab.id ? "secondary" : "ghost"}
                        className="w-full justify-start gap-2"
                        onClick={() => setDashboardTab(tab.id)}
                      >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                      </Button>
                    ))}
                  </CardContent>
                </Card>

                {isDeveloper ? (
                  <Card className="border-border/60">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Developer Access</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div>
                                  <label className="text-xs text-muted-foreground">Override Customer ID#</label>
                        <Input
                          value={overrideInput}
                          onChange={(event) => setOverrideInput(event.target.value.toUpperCase())}
                          placeholder="BA1234567"
                          maxLength={9}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={applyOverrideBaid}>
                          Apply
                        </Button>
                        <Button size="sm" variant="outline" onClick={clearOverrideBaid}>
                          Clear
                        </Button>
                      </div>
                      {overrideBaid ? (
                        <p className="text-xs text-muted-foreground">
                          Viewing Customer ID# {overrideBaid}
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                ) : null}
              </aside>

              <div className="space-y-6">
                {dashboardTab === "orders" ? (
                  <Card
                    className="shadow-xl border-0 overflow-hidden animate-slide-up"
                    style={{ animationDelay: "0.1s" }}
                  >
                    <CardContent className="p-6 md:p-8">
                      <div className="mb-8">
                        <label
                          htmlFor="pickup-number"
                          className="block text-sm font-medium text-foreground mb-2"
                        >
                          Search Orders
                        </label>
                        <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                          <Input
                            id="pickup-number"
                            type="text"
                            placeholder="Search by order number or job name"
                            value={orderQuery}
                            onChange={(e) => {
                              setOrderQuery(e.target.value);
                              setError("");
                            }}
                            className="pl-12 h-14 text-lg"
                          />
                        </div>
                        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
                        {actionError ? (
                          <p className="mt-2 text-sm text-destructive">{actionError}</p>
                        ) : null}
                      </div>

                      <div className="mb-8">
                        <div className="flex items-center justify-between mb-3">
                          <h2 className="text-sm font-medium text-foreground">Your Orders</h2>
                          <span className="text-xs text-muted-foreground">
                            {ordersLoading ? "Loading..." : `${filteredOrders.length} orders`}
                          </span>
                        </div>

                        <Button
                          variant="hero"
                          size="lg"
                          className="w-full mb-4"
                          onClick={handleContinue}
                        >
                          Select Items for Pickup
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>

                        {ordersError ? (
                          <div className="space-y-2">
                            <p className="text-sm text-destructive">{ordersError}</p>
                            {reauthRequired ? (
                              <div className="rounded-lg border border-border/60 bg-secondary/30 p-3 text-sm text-muted-foreground">
                                <p className="mb-2">
                                  Your session looks out of date. Please sign out and back in to refresh your
                                  account details.
                                </p>
                                <Button variant="outline" size="sm" onClick={() => signOut()}>
                                  Sign out
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        ) : ordersLoading ? (
                          <p className="text-sm text-muted-foreground">Fetching your latest orders...</p>
                        ) : filteredOrders.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No matching orders found.</p>
                        ) : (
                          <div className="space-y-3">
                            {visibleOrders.map((order) => {
                              const checked = selectedOrders.includes(order.orderNbr);
                              const deliveryDate = order.deliveryDate
                                ? new Date(order.deliveryDate)
                                : null;
                              const dateLabel = deliveryDate
                                ? deliveryDate.toLocaleDateString()
                                : "No delivery date";
                              const isScheduled = Boolean(order.appointment);
                              const isPickupReady = order.isPickupReady !== false;
                              const lastPickupLabel = formatLastPickup(order.lastPickupAt);
                              const { locationIds, unknownWarehouses } = resolvePickupLocationIds(
                                order.warehouses
                              );
                              const locationLabel =
                                locationIds.length === 1
                                  ? pickupLocations.find((loc) => loc.id === locationIds[0])?.name ??
                                    "Unknown location"
                                  : locationIds.length > 1
                                  ? "Multiple locations"
                                  : unknownWarehouses.length
                                  ? "No pickup location"
                                  : "No pickup location";

                              return (
                                <div
                                  key={order.id}
                                  className={`flex items-start gap-4 rounded-xl border border-border/60 bg-white p-4 transition hover:border-border cursor-pointer ${
                                    isScheduled ? "bg-muted/40 opacity-70" : ""
                                  }`}
                                  onClick={(event) =>
                                    handleOrderCardClick(
                                      event,
                                      order.orderNbr,
                                      isScheduled,
                                      isPickupReady
                                    )
                                  }
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={() => toggleOrder(order.orderNbr)}
                                    className="mt-1"
                                    disabled={isScheduled || !isPickupReady}
                                  />
                                  <div className="flex-1 space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-semibold text-foreground">
                                          {order.orderNbr}
                                        </span>
                                        {!isPickupReady ? (
                                          <Badge variant="destructive">Not Ready</Badge>
                                        ) : null}
                                        {order.paymentStatus ? (
                                          <Badge variant="outline">{order.paymentStatus}</Badge>
                                        ) : null}
                                        {isScheduled && order.appointment ? (
                                          <Badge variant="outline">
                                            {order.appointment.status}
                                          </Badge>
                                        ) : null}
                                      </div>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="bg-white hover:bg-secondary/60"
                                        asChild
                                      >
                                        <Link href={`/orders/${order.orderNbr}`}>View Order</Link>
                                      </Button>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {order.jobName || order.customerName}
                                    </div>
                                    {lastPickupLabel ? (
                                      <div className="text-xs text-muted-foreground">
                                        {lastPickupLabel}
                                      </div>
                                    ) : null}
                                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                                      <span>Type: {order.orderType}</span>
                                      <span>Status: {order.status}</span>
                                      <span>Requested Date: {dateLabel}</span>
                                      <span>Pickup: {locationLabel}</span>
                                    </div>
                                    {isScheduled && order.appointment ? (
                                      <div className="flex flex-wrap items-center gap-3">
                                        <div className="text-sm font-semibold text-primary">
                                          {formatAppointmentTime(order.appointment.startAt, order.appointment.endAt)}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          <Button
                                            variant="hero"
                                            size="sm"
                                            onClick={() => handleReschedule(order.appointment)}
                                          >
                                            Reschedule
                                          </Button>
                                          <Button
                                            size="sm"
                                            className={DESTRUCTIVE_BUTTON}
                                            onClick={() => openCancelDialog(order.appointment!, order.orderNbr)}
                                          >
                                            Cancel
                                          </Button>
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                            {remainingOrders > 0 ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() =>
                                  setVisibleOrderCount((prev) => prev + ORDER_PREVIEW_LIMIT)
                                }
                              >
                                Show more orders (+{remainingOrders})
                              </Button>
                            ) : null}
                          </div>
                        )}
                      </div>

                      <div className="mb-8 rounded-xl border border-border/60 bg-secondary/20 p-4">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <h2 className="text-sm font-medium text-foreground">Pickup Location</h2>
                          <span className="text-xs text-muted-foreground">
                            {selectedOrders.length
                              ? "Based on your selected orders"
                              : "Select orders to see location"}
                          </span>
                        </div>

                        {selectedOrders.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Choose orders above to see your pickup location.
                          </p>
                        ) : selectedLocationState.hasUnknown ? (
                          <p className="text-sm text-destructive">
                            No pickup location near you for one or more items. Please contact your sales person to coordinate.
                          </p>
                        ) : selectedLocationState.locationIds.length === 1 ? (
                          (() => {
                            const loc = pickupLocations.find(
                              (location) => location.id === selectedLocationState.locationIds[0]
                            );
                            if (!loc) {
                              return (
                                <p className="text-sm text-destructive">
                                  No pickup location near you. Please contact your sales person to coordinate.
                                </p>
                              );
                            }
                            return (
                              <div className="space-y-1">
                                <p className="font-semibold text-foreground">{loc.name}</p>
                                <p className="text-sm text-muted-foreground">{loc.address}</p>
                                <p className="text-xs text-muted-foreground">{loc.instructions}</p>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                              Your selected orders require multiple pickup locations. You'll schedule separate
                              appointments for each location.
                            </p>
                            <div className="space-y-3">
                              {selectedLocationState.groups.map((group) => {
                                const loc = pickupLocations.find((location) => location.id === group.locationId);
                                if (!loc) return null;
                                return (
                                  <div
                                    key={group.locationId}
                                    className="rounded-lg border border-border/60 bg-background/70 p-3"
                                  >
                                    <p className="font-semibold text-foreground">{loc.name}</p>
                                    <p className="text-sm text-muted-foreground">{loc.address}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {group.orderNbrs.length} order{group.orderNbrs.length === 1 ? "" : "s"}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      <Button variant="hero" size="xl" className="w-full" onClick={handleContinue}>
                        Select Items for Pickup
                        <ArrowRight className="h-5 w-5" />
                      </Button>
                    </CardContent>
                  </Card>
                ) : null}

                {dashboardTab === "members" ? (
                  <Card className="border-border/60">
                    <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <CardTitle>Members</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Manage who has access to this account.
                        </p>
                      </div>
                      {isAdmin ? (
                        <Button onClick={() => setInviteDialogOpen(true)}>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Add member
                        </Button>
                      ) : null}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Input
                        placeholder="Search members"
                        value={memberQuery}
                        onChange={(event) => setMemberQuery(event.target.value)}
                      />
                      {membersError ? (
                        <p className="text-sm text-destructive">{membersError}</p>
                      ) : membersLoading ? (
                        <p className="text-sm text-muted-foreground">Loading members...</p>
                      ) : (
                        <div className="space-y-2">
                          {filteredMembers.map((member) => (
                            <div
                              key={member.userId}
                              className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/80 p-3 md:flex-row md:items-center md:justify-between"
                            >
                              <div>
                                <p className="font-medium text-foreground">{member.name}</p>
                                <p className="text-xs text-muted-foreground">{member.email}</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">{roleLabel(member.role)}</Badge>
                                {isAdmin ? (
                                  <Select
                                    value={member.role}
                                    onValueChange={(value) =>
                                      handleUpdateMemberRole(member.userId, value as "ADMIN" | "PM")
                                    }
                                  >
                                    <SelectTrigger className="w-[140px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="ADMIN">Admin</SelectItem>
                                      <SelectItem value="PM">Manager</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : null}
                                {isAdmin && member.userId !== user?.id ? (
                                  <Button
                                    size="sm"
                                    className={DESTRUCTIVE_BUTTON}
                                    onClick={() => handleRemoveMember(member.userId)}
                                    disabled={memberActionId === member.userId}
                                  >
                                    <UserMinus className="h-4 w-4 mr-1" />
                                    Remove
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : null}

                {dashboardTab === "invitations" && isAdmin ? (
                  <Card className="border-border/60">
                    <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <CardTitle>Invitations</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Track invite codes sent to new users.
                        </p>
                      </div>
                      {isAdmin ? (
                        <Button onClick={() => setInviteDialogOpen(true)}>
                          <Mail className="h-4 w-4 mr-2" />
                          New invite
                        </Button>
                      ) : null}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Input
                        placeholder="Search invites"
                        value={inviteQuery}
                        onChange={(event) => setInviteQuery(event.target.value)}
                      />
                      {invitesError ? (
                        <p className="text-sm text-destructive">{invitesError}</p>
                      ) : invitesLoading ? (
                        <p className="text-sm text-muted-foreground">Loading invites...</p>
                      ) : (
                        <div className="space-y-2">
                          {filteredInvites.map((invite) => (
                            <div
                              key={invite.id}
                              className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/80 p-3 md:flex-row md:items-center md:justify-between"
                            >
                              <div>
                                <p className="font-medium text-foreground">
                                  {invite.recipientEmail || invite.recipientPhone || "Invite"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {roleLabel(invite.role)} - {new Date(invite.createdAt).toLocaleString()}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={statusBadgeVariant(invite.status)}>{invite.status}</Badge>
                                {isAdmin && invite.status === "Pending" ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openResendInvite(invite)}
                                    disabled={inviteActionId === invite.id}
                                  >
                                    Resend
                                  </Button>
                                ) : null}
                                {isAdmin && invite.status === "Pending" ? (
                                  <Button
                                    size="sm"
                                    className={DESTRUCTIVE_BUTTON}
                                    onClick={() => handleRevokeInvite(invite.id)}
                                    disabled={inviteActionId === invite.id}
                                  >
                                    Revoke
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : null}

                {dashboardTab === "requests" && isAdmin ? (
                  <Card className="border-border/60">
                    <CardHeader>
                      <CardTitle>Requests</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Recent invite requests and verification attempts.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {requestsError ? (
                        <p className="text-sm text-destructive">{requestsError}</p>
                      ) : requestsLoading ? (
                        <p className="text-sm text-muted-foreground">Loading requests...</p>
                      ) : (
                        <div className="space-y-2">
                          {requests.map((req) => (
                            <div
                              key={req.id}
                              className="rounded-lg border border-border/60 bg-background/80 p-3 text-sm"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-foreground">
                                  {req.baid || "Unknown Customer ID#"}
                                </span>
                                <Badge variant={req.result === "success" ? "default" : "outline"}>
                                  {req.result}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {req.reason || "No reason"} - {new Date(req.createdAt).toLocaleString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </div>
          </div>
          
        )}
      </main>
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send an invite</DialogTitle>
            <DialogDescription>
              Invite a teammate to access this account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Full name</label>
              <Input
                value={inviteForm.name}
                onChange={(event) =>
                  setInviteForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input
                type="email"
                value={inviteForm.email}
                onChange={(event) =>
                  setInviteForm((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder="name@example.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Phone (optional)</label>
              <Input
                value={inviteForm.phone}
                onChange={(event) =>
                  setInviteForm((prev) => ({ ...prev, phone: event.target.value }))
                }
                placeholder="8015551212"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Role</label>
              <Select
                value={inviteForm.role}
                onValueChange={(value) =>
                  setInviteForm((prev) => ({ ...prev, role: value as "ADMIN" | "PM" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="PM">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              className={DESTRUCTIVE_BUTTON}
              onClick={() => setInviteDialogOpen(false)}
              disabled={inviteSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleInviteSubmit} disabled={inviteSubmitting}>
              {inviteSubmitting ? "Sending..." : "Send invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cancel pickup orders</DialogTitle>
            <DialogDescription>
              Select the orders to remove from this appointment.
            </DialogDescription>
          </DialogHeader>

          {cancelAppointment ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-secondary/30 p-3 text-sm">
                <p className="font-medium text-foreground">
                  {cancelSelectedOrders.length} of {cancelAppointment.orderNbrs.length} orders selected
                </p>
                <p className="text-muted-foreground">{cancelImpactMessage}</p>
              </div>

              <div className="space-y-2">
                {cancelAppointment.orderNbrs.map((orderNbr) => (
                  <label
                    key={orderNbr}
                    className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={cancelSelectedOrders.includes(orderNbr)}
                      onCheckedChange={() => toggleCancelOrder(orderNbr)}
                    />
                    <span className="font-medium text-foreground">{orderNbr}</span>
                  </label>
                ))}
              </div>

              {cancelError ? (
                <p className="text-sm text-destructive">{cancelError}</p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="mt-4">
            <Button
              variant="ghost"
              onClick={() => setCancelDialogOpen(false)}
              disabled={cancelSubmitting}
            >
              Keep Appointment
            </Button>
            <Button
              variant="hero"
              onClick={handleConfirmCancelOrders}
              disabled={cancelSubmitting || cancelSelectedOrders.length === 0}
            >
              {cancelSubmitting ? "Updating..." : "Confirm Cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
