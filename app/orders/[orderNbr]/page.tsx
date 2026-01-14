"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Package, Truck, Wallet, CalendarDays } from "lucide-react";

import Header from "@/components/layout/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { usePickup } from "@/context/PickupContext";

type OrderLine = {
  id: string;
  lineDescription: string | null;
  inventoryId: string | null;
  lineType: string | null;
  openQty: number | null;
  unitPrice: number | null;
  usrETA: string | null;
  here: string | null;
  warehouse: string | null;
};

type OrderDetail = {
  summary: {
    id: string;
    orderNbr: string;
    status: string;
    deliveryDate: string | null;
    locationId: string | null;
    jobName: string | null;
    shipVia: string | null;
    customerName: string;
    buyerGroup: string | null;
    noteId: string | null;
    orderType: string;
    fulfillmentStatus: string;
    paymentStatus: string | null;
    lineSummary: {
      totalLines: number;
      openLines: number;
      closedLines: number;
    };
    warehouses: string[];
    appointment: {
      id: string;
      status: string;
      startAt: string;
      endAt: string;
      locationId: string;
      orderNbrs: string[];
    } | null;
  };
  address: {
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
  } | null;
  contact: {
    deliveryEmail: string | null;
    siteNumber: string | null;
    osContact: string | null;
    confirmedVia: string | null;
    confirmedWith: string | null;
    sixWeekFailed: boolean | null;
    tenDaySent: boolean | null;
    threeDaySent: boolean | null;
  } | null;
  payment: {
    orderTotal: number | null;
    unpaidBalance: number | null;
    terms: string | null;
    status: string | null;
  } | null;
  lines: OrderLine[];
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatDate(value: string | null) {
  if (!value) return "Not set";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Not set";
  return d.toLocaleDateString();
}

function formatText(value: string | null) {
  if (!value) return "—";
  const trimmed = value.trim();
  if (!trimmed) return "—";
  if (/[A-Z][A-Z]/.test(trimmed) && !/[a-z]/.test(trimmed)) {
    return trimmed
      .toLowerCase()
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }
  return trimmed;
}

function formatEmail(value: string | null) {
  if (!value) return "—";
  return value.trim().toLowerCase();
}

function formatPhone(value: string | null) {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return value;
}

function formatQty(value: number | null) {
  if (value == null) return "—";
  return value.toLocaleString();
}

function formatMoney(value: number | null) {
  if (value == null) return "—";
  return money.format(value);
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { status, data: session } = useSession();
  const { updateFormData } = usePickup();

  const orderNbr = String(params.orderNbr || "");
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelSelectedOrders, setCancelSelectedOrders] = useState<string[]>([]);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState("");

  useEffect(() => {
    if (status !== "authenticated") return;
    const user = session?.user as any;
    if (!user?.baid || !user?.email) return;

    setLoading(true);
    setError("");

    fetch("/api/customer/orders/detail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderNbr,
        email: user.email,
        baid: user.baid,
        userId: user.id,
      }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setError(data?.message ?? "Unable to load order.");
          return;
        }
        setDetail(data as OrderDetail);
      })
      .catch(() => {
        setError("Unable to load order.");
      })
      .finally(() => setLoading(false));
  }, [orderNbr, session, status]);

  const itemsHere = useMemo(
    () => detail?.lines.filter((line) => (line.openQty ?? 0) <= 0) ?? [],
    [detail]
  );
  const backordered = useMemo(
    () => detail?.lines.filter((line) => (line.openQty ?? 0) > 0) ?? [],
    [detail]
  );

  const formatAppointmentTime = (startAt: string, endAt: string) => {
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Scheduled";
    const date = start.toLocaleDateString();
    const time = start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const endTime = end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return `Scheduled for ${date} • ${time}–${endTime}`;
  };

  const handleCancel = async () => {
    const appointment = detail?.summary.appointment;
    if (!appointment) return;
    const user = session?.user as any;
    if (!user?.id || !user?.email) return;
    setActionLoading(true);
    setActionError("");
    const res = await fetch(`/api/customer/pickups/${appointment.id}/cancel`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, email: user.email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActionError(data?.message ?? "Unable to cancel pickup.");
      setActionLoading(false);
      return false;
    }
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            summary: {
              ...prev.summary,
              appointment: null,
            },
          }
        : prev
    );
    setActionLoading(false);
    return true;
  };

  const openCancelDialog = () => {
    const appointment = detail?.summary.appointment;
    if (!appointment) return;
    setCancelSelectedOrders([detail?.summary.orderNbr].filter(Boolean) as string[]);
    setCancelError("");
    setCancelDialogOpen(true);
  };

  const toggleCancelOrder = (orderNbr: string) => {
    setCancelSelectedOrders((prev) =>
      prev.includes(orderNbr) ? prev.filter((id) => id !== orderNbr) : [...prev, orderNbr]
    );
  };

  const handleConfirmCancelOrders = async () => {
    const appointment = detail?.summary.appointment;
    if (!appointment) return;
    const user = session?.user as any;
    if (!user?.id || !user?.email) return;
    setCancelSubmitting(true);
    setCancelError("");

    const allOrders = appointment.orderNbrs ?? [];
    const remaining = allOrders.filter((orderNbr) => !cancelSelectedOrders.includes(orderNbr));

    const res = await fetch(`/api/customer/pickups/${appointment.id}/orders`, {
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
    setCancelSubmitting(false);
    setCancelSelectedOrders([]);
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            summary: {
              ...prev.summary,
              appointment: remaining.length
                ? {
                    ...prev.summary.appointment!,
                    orderNbrs: remaining,
                    endAt: data?.appointment?.endAt ?? prev.summary.appointment!.endAt,
                    status: data?.appointment?.status ?? prev.summary.appointment!.status,
                  }
                : null,
            },
          }
        : prev
    );
  };

  const cancelImpactMessage = useMemo(() => {
    const appointment = detail?.summary.appointment;
    if (!appointment) return "";
    const total = appointment.orderNbrs.length;
    const remaining = total - cancelSelectedOrders.length;
    if (remaining <= 0) return "This will cancel the entire appointment.";
    if (total > 6 && remaining <= 6) {
      return "Appointment will shrink to a 15-minute window and free the extra time.";
    }
    return "Appointment time will remain the same.";
  }, [detail?.summary.appointment, cancelSelectedOrders]);

  const handleReschedule = async () => {
    const appointment = detail?.summary.appointment;
    if (!appointment) return;
    const ok = await handleCancel();
    if (!ok) return;
    if (!appointment.orderNbrs.length) return;
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
    });
    router.push("/schedule");
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="container py-8 md:py-12">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => router.push("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to scheduling
            </Button>
          </div>

          {loading ? (
            <Card className="shadow-xl">
              <CardContent className="p-8 text-center text-muted-foreground">
                Loading order details...
              </CardContent>
            </Card>
          ) : error ? (
            <Card className="shadow-xl border-destructive/40">
              <CardContent className="p-8 text-center text-destructive">
                {error}
              </CardContent>
            </Card>
          ) : detail ? (
            <>
              <Card className="shadow-xl border-0">
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-3">
                    <span className="text-2xl font-bold">Order {detail.summary.orderNbr}</span>
                    {detail.summary.paymentStatus ? (
                      <Badge variant="outline">{detail.summary.paymentStatus}</Badge>
                    ) : null}
                    {detail.summary.appointment ? (
                      <Badge variant="outline">{detail.summary.appointment.status}</Badge>
                    ) : null}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Package className="h-4 w-4" />
                      Summary
                    </div>
                    <div className="space-y-1 text-sm">
                      <div>
                        Type: <span className="font-semibold">{formatText(detail.summary.orderType)}</span>
                      </div>
                      <div>
                        Status: <span className="font-semibold">{formatText(detail.summary.status)}</span>
                      </div>
                      <div>
                        Delivery: <span className="font-medium">{formatDate(detail.summary.deliveryDate)}</span>
                      </div>
                      <div>
                        Ship Via: <span className="font-medium">{formatText(detail.summary.shipVia)}</span>
                      </div>
                      <div>
                        Buyer Group: <span className="font-medium">{formatText(detail.summary.buyerGroup)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Truck className="h-4 w-4" />
                      Job
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="font-semibold">
                        {formatText(detail.summary.jobName) || formatText(detail.summary.customerName)}
                      </div>
                      <div>
                        Customer: <span className="font-medium">{formatText(detail.summary.customerName)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Wallet className="h-4 w-4" />
                      Payment
                    </div>
                    <div className="space-y-1 text-sm">
                      <div>
                        Total: <span className="font-semibold">{formatMoney(detail.payment?.orderTotal ?? null)}</span>
                      </div>
                      <div>
                        Balance: <span className="font-semibold">{formatMoney(detail.payment?.unpaidBalance ?? null)}</span>
                      </div>
                      <div>
                        Terms: <span className="italic">{formatText(detail.payment?.terms ?? null)}</span>
                      </div>
                      <div>
                        Status: <span className="font-medium">{formatText(detail.payment?.status ?? null)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {detail.summary.appointment ? (
                <Card className="shadow-lg border-border/60">
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                      <CalendarDays className="h-4 w-4" />
                      <span className="font-semibold">
                        {formatAppointmentTime(
                          detail.summary.appointment.startAt,
                          detail.summary.appointment.endAt
                        )}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={handleReschedule}
                        disabled={actionLoading}
                      >
                        Reschedule
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-[#d24f39] font-semibold hover:text-[#d24f39] hover:bg-transparent"
                        onClick={openCancelDialog}
                        disabled={actionLoading}
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {actionError ? (
                <p className="text-sm text-destructive">{actionError}</p>
              ) : null}

              <div className="grid gap-6 md:grid-cols-2">
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle>Job Address</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-muted-foreground">
                    {detail.address ? (
                      <>
                        <div className="font-medium text-foreground">
                          {formatText(detail.address.addressLine1)}
                        </div>
                        {detail.address.addressLine2 ? (
                          <div>{formatText(detail.address.addressLine2)}</div>
                        ) : null}
                        <div>
                          {[detail.address.city, detail.address.state, detail.address.postalCode]
                            .filter(Boolean)
                            .map((val) => formatText(val))
                            .join(", ")}
                        </div>
                      </>
                    ) : (
                      <div>No address on file.</div>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle>Contact</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-muted-foreground">
                    <div>
                      Email: <span className="font-medium text-foreground">{formatEmail(detail.contact?.deliveryEmail ?? null)}</span>
                    </div>
                    <div>
                      Job Site #: <span className="font-medium text-foreground">{formatText(detail.contact?.siteNumber ?? null)}</span>
                    </div>
                    <div>
                      Job Contact: <span className="font-medium text-foreground">{formatText(detail.contact?.osContact ?? null)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="shadow-xl">
                <CardHeader>
                  <CardTitle>Items Ready for Pickup</CardTitle>
                </CardHeader>
                <CardContent>
                  {itemsHere.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No items ready yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Warehouse</TableHead>
                          <TableHead>Here</TableHead>
                          <TableHead>Unit Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itemsHere.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell>{formatText(line.inventoryId)}</TableCell>
                            <TableCell>{formatText(line.lineDescription)}</TableCell>
                            <TableCell>{formatText(line.warehouse)}</TableCell>
                            <TableCell>{formatText(line.here) || "Yes"}</TableCell>
                            <TableCell>{formatMoney(line.unitPrice)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-xl">
                <CardHeader>
                  <CardTitle>Backordered Items</CardTitle>
                </CardHeader>
                <CardContent>
                  {backordered.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No backordered items.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Open Qty</TableHead>
                          <TableHead>ETA</TableHead>
                          <TableHead>Warehouse</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {backordered.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell>{formatText(line.inventoryId)}</TableCell>
                            <TableCell>{formatText(line.lineDescription)}</TableCell>
                            <TableCell>{formatQty(line.openQty)}</TableCell>
                            <TableCell>{formatDate(line.usrETA)}</TableCell>
                            <TableCell>{formatText(line.warehouse)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-start">
                <Button variant="ghost" onClick={() => router.push("/")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to scheduling
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </main>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cancel pickup orders</DialogTitle>
            <DialogDescription>
              Select the orders to remove from this appointment.
            </DialogDescription>
          </DialogHeader>

          {detail?.summary.appointment ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-secondary/30 p-3 text-sm">
                <p className="font-medium text-foreground">
                  {cancelSelectedOrders.length} of {detail.summary.appointment.orderNbrs.length} orders
                  selected
                </p>
                <p className="text-muted-foreground">{cancelImpactMessage}</p>
              </div>

              <div className="space-y-2">
                {detail.summary.appointment.orderNbrs.map((order) => (
                  <label
                    key={order}
                    className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={cancelSelectedOrders.includes(order)}
                      onCheckedChange={() => toggleCancelOrder(order)}
                    />
                    <span className="font-medium text-foreground">{order}</span>
                  </label>
                ))}
              </div>

              {cancelError ? <p className="text-sm text-destructive">{cancelError}</p> : null}
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
}
