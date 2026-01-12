"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { Search, ArrowRight, Truck, Clock, CheckCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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

import { usePickup } from "@/context/PickupContext";
import { pickupLocations, resolvePickupLocationIds } from "@/lib/pickupLocations";

type Feature = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
};

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
  appointment: {
    id: string;
    status: string;
    startAt: string;
    endAt: string;
    locationId: string;
    orderNbrs: string[];
  } | null;
};

const Index: React.FC = () => {
  const router = useRouter();
  const { updateFormData, formData } = usePickup();
  const { status, data: session } = useSession();

  const userType = (session?.user as any)?.type;
  const isCustomer = status === "authenticated" && userType === "customer";

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

  useEffect(() => {
    // If a staff member lands on the customer home, send them to staff.
    if (status === "authenticated" && userType === "staff") {
      router.replace("/staff");
    }
  }, [status, userType, router]);

  const loadOrders = () => {
    if (!isCustomer) return;
    const user = session?.user as any;
    if (!user?.baid || !user?.email) return;

    let cancelled = false;
    setOrdersLoading(true);
    setOrdersError("");
    setReauthRequired(false);

    console.log("[orders] request", {
      userId: user?.id,
      email: user?.email,
      baid: user?.baid,
    });

    fetch("/api/customer/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, baid: user.baid, userId: user.id }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        console.log("[orders] response", { ok, status: ok ? 200 : 400, data });
        if (!ok) {
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
      })
      .catch(() => {
        if (!cancelled) setOrdersError("Unable to load orders.");
      })
      .finally(() => {
        if (!cancelled) setOrdersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    const cleanup = loadOrders();
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, [isCustomer, session]);

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
        return !order?.appointment;
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
    });

    router.push("/schedule");
  };

  const formatAppointmentTime = (startAt: string, endAt: string) => {
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Scheduled";
    const date = start.toLocaleDateString();
    const time = start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const endTime = end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return `Scheduled for ${date} • ${time}–${endTime}`;
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
    loadOrders();
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
    loadOrders();
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
    });
    router.push("/schedule");
  };

  const features: Feature[] = useMemo(
    () => [
      {
        icon: Clock,
        title: "Save Time",
        description: "Skip the wait with a pre-scheduled pickup slot",
      },
      {
        icon: Truck,
        title: "Convenient",
        description: "Choose a time that works for your schedule",
      },
      {
        icon: CheckCircle,
        title: "Peace of Mind",
        description: "Get confirmation and reminders for your pickup",
      },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8 md:py-16">
        {!isCustomer ? (
          <CustomerAuthCard />
        ) : (
          <div className="max-w-4xl mx-auto">
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

            {/* Main Card */}
            <Card
              className="shadow-xl border-0 overflow-hidden animate-slide-up"
              style={{ animationDelay: "0.1s" }}
            >
              <CardContent className="p-6 md:p-8">
                {/* Pickup Number Input */}
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
                  {actionError ? <p className="mt-2 text-sm text-destructive">{actionError}</p> : null}
                </div>

                <div className="mb-8">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-medium text-foreground">Your Orders</h2>
                    <span className="text-xs text-muted-foreground">
                      {ordersLoading ? "Loading..." : `${filteredOrders.length} orders`}
                    </span>
                  </div>

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
                      {filteredOrders.map((order) => {
                        const checked = selectedOrders.includes(order.orderNbr);
                        const deliveryDate = order.deliveryDate
                          ? new Date(order.deliveryDate)
                          : null;
                        const dateLabel = deliveryDate
                          ? deliveryDate.toLocaleDateString()
                          : "No delivery date";
                        const isScheduled = Boolean(order.appointment);
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

                        const statusVariant =
                          order.fulfillmentStatus === "Complete"
                            ? "success"
                          : order.fulfillmentStatus === "Partially Complete"
                          ? "warning"
                            : order.fulfillmentStatus === "Cancelled"
                            ? "destructive"
                            : "secondary";

                        return (
                          <div
                            key={order.id}
                            className="flex items-start gap-4 rounded-xl border border-border/60 bg-background p-4 transition hover:border-border"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleOrder(order.orderNbr)}
                              className="mt-1"
                              disabled={isScheduled}
                            />
                            <div className="flex-1 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-foreground">
                                  {order.orderNbr}
                                </span>
                                <Badge variant={statusVariant as any}>
                                  {order.fulfillmentStatus}
                                </Badge>
                                {order.paymentStatus ? (
                                  <Badge variant="outline">{order.paymentStatus}</Badge>
                                ) : null}
                                {isScheduled && order.appointment ? (
                                  <Badge variant="outline">
                                    {order.appointment.status}
                                  </Badge>
                                ) : null}
                                <Button variant="hero" size="sm" asChild>
                                  <Link href={`/orders/${order.orderNbr}`}>View Order</Link>
                                </Button>
                                {isScheduled && order.appointment ? (
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleReschedule(order.appointment)}
                                    >
                                      Reschedule
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-[#d24f39] font-semibold hover:text-[#d24f39] hover:bg-transparent"
                                      onClick={() => openCancelDialog(order.appointment!, order.orderNbr)}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : null}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {order.jobName || order.customerName}
                              </div>
                              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                                <span>Type: {order.orderType}</span>
                                <span>Status: {order.status}</span>
                                <span>Lines: {order.lineSummary.closedLines}/{order.lineSummary.totalLines}</span>
                                <span>Delivery: {dateLabel}</span>
                                <span>Pickup: {locationLabel}</span>
                              </div>
                              {isScheduled && order.appointment ? (
                                <div className="text-xs font-semibold text-primary">
                                  {formatAppointmentTime(order.appointment.startAt, order.appointment.endAt)}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Pickup Location */}
                <div className="mb-8 rounded-xl border border-border/60 bg-secondary/20 p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h2 className="text-sm font-medium text-foreground">Pickup Location</h2>
                    <span className="text-xs text-muted-foreground">
                      {selectedOrders.length ? "Based on your selected orders" : "Select orders to see location"}
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

                {/* Continue Button */}
                <Button variant="hero" size="xl" className="w-full" onClick={handleContinue}>
                  Find Available Times
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </CardContent>
            </Card>

            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
              {features.map((feature, index) => (
                <div
                  key={feature.title}
                  className="text-center animate-slide-up"
                  style={{ animationDelay: `${0.2 + index * 0.1}s` }}
                >
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-secondary text-primary mb-4">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-display font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

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
