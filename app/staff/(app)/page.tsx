"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { format, addDays, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AppointmentStatus =
  | "Scheduled"
  | "Confirmed"
  | "InProgress"
  | "Ready"
  | "Completed"
  | "Cancelled"
  | "NoShow";

type StaffPickup = {
  id: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  customerFirstName: string;
  customerLastName: string | null;
  locationId: string;
  orders: { orderNbr: string }[];
  shipments?: { orderNbr: string; shipmentNbr: string }[];
};

type AppointmentLine = {
  orderNbr: string;
  inventoryId: string;
  qtySelected: number;
};

const SHIPMENT_FORMAT = /^SMT\d{7}$/;
const STATUS_STYLES: Record<AppointmentStatus, string> = {
  Scheduled: "bg-amber-100 text-amber-900 border-amber-200",
  Confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  InProgress: "bg-sky-100 text-sky-800 border-sky-200",
  Ready: "bg-lime-100 text-lime-800 border-lime-200",
  Completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Cancelled: "bg-rose-100 text-rose-800 border-rose-200",
  NoShow: "bg-orange-100 text-orange-800 border-orange-200",
};

export default function StaffHomePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const isViewer = session?.user?.role === "VIEWER" || session?.user?.role === "SALESPERSON";
  const [pickups, setPickups] = useState<StaffPickup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shipmentDrafts, setShipmentDrafts] = useState<Record<string, Record<string, string[]>>>(
    {}
  );
  const [shipmentOriginals, setShipmentOriginals] = useState<Record<string, Record<string, string[]>>>(
    {}
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState("");
  const [itemsOrderNbr, setItemsOrderNbr] = useState<string | null>(null);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, AppointmentLine[]>>({});

  useEffect(() => {
    if (session?.user?.role === "VIEWER" || session?.user?.role === "SALESPERSON") {
      router.replace("/staff/pickups");
    }
  }, [router, session?.user?.role]);

  useEffect(() => {
    const fetchBoard = async () => {
      setLoading(true);
      setError("");
      const from = format(new Date(), "yyyy-MM-dd");
      const to = format(addDays(new Date(), 30), "yyyy-MM-dd");
      const res = await fetch(`/api/staff/pickups?from=${from}&to=${to}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? "Unable to load appointments.");
        setLoading(false);
        return;
      }
      const rows: StaffPickup[] = Array.isArray(data?.pickups) ? data.pickups : [];
      setPickups(rows);
      const shipmentMap: Record<string, Record<string, string[]>> = {};
      rows.forEach((apt) => {
        const perOrder: Record<string, string[]> = {};
        (apt.shipments ?? []).forEach((shipment) => {
          if (!perOrder[shipment.orderNbr]) perOrder[shipment.orderNbr] = [];
          perOrder[shipment.orderNbr].push(shipment.shipmentNbr);
        });
        shipmentMap[apt.id] = perOrder;
      });
      setShipmentDrafts(shipmentMap);
      setShipmentOriginals(shipmentMap);
      setLoading(false);
    };
    if (session?.user?.role !== "VIEWER" && session?.user?.role !== "SALESPERSON") {
      fetchBoard();
    }
  }, [session?.user?.role]);

  const ordersMissingShipments = useMemo(() => {
    return pickups
      .filter((apt) => {
        if (apt.status === "Completed") return false;
        const perOrder = shipmentOriginals[apt.id] ?? {};
        return apt.orders.some((order) => (perOrder[order.orderNbr] ?? []).length === 0);
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [pickups, shipmentOriginals]);

  const readyForPulling = useMemo(() => {
    return pickups
      .filter((apt) => {
        const perOrder = shipmentOriginals[apt.id] ?? {};
        const allShipped = apt.orders.every((order) => (perOrder[order.orderNbr] ?? []).length > 0);
        return allShipped && apt.status !== "Ready" && apt.status !== "Completed";
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [pickups, shipmentOriginals]);

  const readyForPickup = useMemo(() => {
    return pickups
      .filter((apt) => {
        if (apt.status !== "Ready") return false;
        const perOrder = shipmentOriginals[apt.id] ?? {};
        const allShipped = apt.orders.every((order) => (perOrder[order.orderNbr] ?? []).length > 0);
        return allShipped;
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [pickups, shipmentOriginals]);

  const completedPickups = useMemo(() => {
    const today = new Date();
    return pickups
      .filter((apt) => apt.status === "Completed" && isSameDay(new Date(apt.startAt), today))
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [pickups]);

  const updateShipmentValue = (appointmentId: string, orderNbr: string, idx: number, value: string) => {
    setShipmentDrafts((prev) => {
      const next = { ...(prev[appointmentId] ?? {}) };
      const list = [...(next[orderNbr] ?? [])];
      list[idx] = value.toUpperCase();
      next[orderNbr] = list;
      return { ...prev, [appointmentId]: next };
    });
  };

  const addShipment = (appointmentId: string, orderNbr: string) => {
    setShipmentDrafts((prev) => {
      const next = { ...(prev[appointmentId] ?? {}) };
      next[orderNbr] = [...(next[orderNbr] ?? []), ""];
      return { ...prev, [appointmentId]: next };
    });
  };

  const removeShipment = (appointmentId: string, orderNbr: string, idx: number) => {
    setShipmentDrafts((prev) => {
      const next = { ...(prev[appointmentId] ?? {}) };
      const list = [...(next[orderNbr] ?? [])];
      list.splice(idx, 1);
      next[orderNbr] = list;
      return { ...prev, [appointmentId]: next };
    });
  };

  const saveShipments = async (appointment: StaffPickup) => {
    setSavingId(appointment.id);
    const perOrder = shipmentDrafts[appointment.id] ?? {};
    const payload = {
      shipments: appointment.orders.map((order) => ({
        orderNbr: order.orderNbr,
        shipmentNbrs: (perOrder[order.orderNbr] ?? [])
          .map((value) => value.trim().toUpperCase())
          .filter(Boolean),
      })),
    };
    const res = await fetch(`/api/staff/pickups/${appointment.id}/shipments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setError("Unable to save shipments.");
      setSavingId(null);
      return;
    }
    const data = await res.json().catch(() => ({}));
    const updated: StaffPickup | null = data?.pickup ?? null;
    if (updated) {
      setPickups((prev) => prev.map((apt) => (apt.id === updated.id ? updated : apt)));
      const perOrder: Record<string, string[]> = {};
      (updated.shipments ?? []).forEach((shipment) => {
        if (!perOrder[shipment.orderNbr]) perOrder[shipment.orderNbr] = [];
        perOrder[shipment.orderNbr].push(shipment.shipmentNbr);
      });
      setShipmentOriginals((prev) => ({ ...prev, [updated.id]: perOrder }));
      setShipmentDrafts((prev) => ({ ...prev, [updated.id]: perOrder }));
    }
    setSavingId(null);
  };

  const markReady = async (appointment: StaffPickup) => {
    if (isViewer) return;
    const res = await fetch(`/api/staff/pickups/${appointment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Ready", notifyCustomer: true }),
    });
    if (!res.ok) {
      setError("Unable to mark ready.");
      return;
    }
    const data = await res.json().catch(() => ({}));
    const updated: StaffPickup | null = data?.pickup ?? null;
    if (updated) {
      setPickups((prev) => prev.map((apt) => (apt.id === updated.id ? updated : apt)));
    }
  };

  const markComplete = async (appointment: StaffPickup) => {
    if (isViewer) return;
    const res = await fetch(`/api/staff/pickups/${appointment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Completed", notifyCustomer: true }),
    });
    if (!res.ok) {
      setError("Unable to mark complete.");
      return;
    }
    const data = await res.json().catch(() => ({}));
    const updated: StaffPickup | null = data?.pickup ?? null;
    if (updated) {
      setPickups((prev) => prev.map((apt) => (apt.id === updated.id ? updated : apt)));
    }
  };

  const openItemsModal = async (appointment: StaffPickup, orderNbr: string) => {
    setItemsOpen(true);
    setItemsLoading(true);
    setItemsError("");
    setItemsOrderNbr(orderNbr);
    setItemsByOrder({});
    const res = await fetch(`/api/staff/pickups/${appointment.id}/items`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setItemsError(data?.message ?? "Unable to load items.");
      setItemsLoading(false);
      return;
    }
    const lines: AppointmentLine[] = Array.isArray(data?.lines) ? data.lines : [];
    const grouped = lines.reduce((map, line) => {
      const list = map.get(line.orderNbr) ?? [];
      list.push(line);
      map.set(line.orderNbr, list);
      return map;
    }, new Map<string, AppointmentLine[]>());
    setItemsByOrder(Object.fromEntries(grouped));
    setItemsLoading(false);
  };

  if (isViewer) {
    return (
      <div className="max-w-[1680px] mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">Redirecting to calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1680px] mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">Signed in as {session?.user?.email}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/staff/pickups" className="block">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle>Pickups</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                View and manage pickups for your location(s).
              </CardContent>
            </Card>
          </Link>

          {session?.user?.role === "ADMIN" && (
            <Link href="/staff/users" className="block">
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle>Users</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Create, edit, or disable staff users.
                </CardContent>
              </Card>
            </Link>
          )}
        </div>

        <div className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Shipments workflow</h2>
              <p className="text-sm text-muted-foreground">
                Track appointments that need shipments and mark them ready when pulled.
              </p>
            </div>
            <Link href="/staff/pickups" className="text-sm text-primary underline">
              Open calendar
            </Link>
          </div>

          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
          {loading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading appointments...</p>
          ) : (
            <div className="mt-6 grid gap-6 xl:grid-cols-4">
              {[
                { title: "Orders need shipments", data: ordersMissingShipments },
                { title: "Shipments ready for pulling", data: readyForPulling },
                { title: "Shipments ready for pickup", data: readyForPickup },
                { title: "Completed pickups", data: completedPickups },
              ].map((column, idx) => (
                <div key={column.title} className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{column.title}</h3>
                    <span className="text-xs text-muted-foreground">{column.data.length}</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {column.data.length === 0 ? (
                      <div className="text-xs text-muted-foreground">No appointments in this stage.</div>
                    ) : (
                      column.data.map((apt) => {
                        const perOrder = shipmentDrafts[apt.id] ?? {};
                        const allShipped = apt.orders.every(
                          (order) => (perOrder[order.orderNbr] ?? []).length > 0
                        );
                        const isCancelled = apt.status === "Cancelled";
                        const isCompleted = apt.status === "Completed";
                        const isLocked = isViewer || isCancelled || isCompleted;
                        return (
                          <div
                            key={apt.id}
                            className={cn(
                              "rounded-lg border border-border/60 bg-white p-2.5",
                              isCancelled && "opacity-60 grayscale"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold">
                                  {apt.customerFirstName} {apt.customerLastName ?? ""}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(apt.startAt), "MMM d, h:mm a")} · {apt.locationId}
                                </div>
                              </div>
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
                                  STATUS_STYLES[apt.status]
                                )}
                              >
                                {apt.status}
                              </span>
                              {idx === 1 ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="bg-white hover:bg-muted/60"
                                  onClick={() => markReady(apt)}
                                  disabled={!allShipped || isLocked}
                                >
                                  Mark ready
                                </Button>
                              ) : null}
                              {idx === 2 ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="bg-white hover:bg-muted/60"
                                  onClick={() => markComplete(apt)}
                                  disabled={!allShipped || isLocked}
                                >
                                  Mark complete
                                </Button>
                              ) : null}
                            </div>

                            <div className="mt-3 space-y-2">
                              {apt.orders.map((order) => {
                                const shipments = perOrder[order.orderNbr] ?? [];
                                return (
                                  <div key={`${apt.id}-${order.orderNbr}`} className="space-y-1.5">
                                    <div className="text-xs font-semibold text-muted-foreground">
                                      <div className="flex items-center gap-2">
                                        <span>Order {order.orderNbr}</span>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-6 px-2 text-xs bg-white hover:bg-white"
                                          onClick={() => openItemsModal(apt, order.orderNbr)}
                                        >
                                          View items
                                        </Button>
                                      </div>
                                    </div>
                                    {shipments.length ? (
                                      shipments.map((value, idx2) => {
                                        const isValid =
                                          value.trim().length === 0 ||
                                          SHIPMENT_FORMAT.test(value.trim());
                                        return (
                                          <div key={`${order.orderNbr}-${idx2}`} className="flex gap-2">
                                            <Input
                                              value={value}
                                              onChange={(event) =>
                                                updateShipmentValue(apt.id, order.orderNbr, idx2, event.target.value)
                                              }
                                              className={cn(!isValid && "border-destructive")}
                                              placeholder="SMT0123456"
                                              disabled={isLocked}
                                            />
                                            <Button
                                              size="sm"
                                              className="bg-red-500 text-white hover:bg-red-600 hover:-translate-y-[1px] transition-transform"
                                              onClick={() => removeShipment(apt.id, order.orderNbr, idx2)}
                                              disabled={isLocked}
                                            >
                                              Remove
                                            </Button>
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <div className="text-xs text-muted-foreground">No shipments yet.</div>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="bg-white hover:bg-white"
                                      onClick={() => addShipment(apt.id, order.orderNbr)}
                                      disabled={isLocked}
                                    >
                                      + Add shipment
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="mt-3 flex items-center justify-between">
                              <Button
                                size="sm"
                                className="bg-[#717463] text-white hover:bg-black"
                                onClick={() => saveShipments(apt)}
                                disabled={isLocked || savingId === apt.id}
                              >
                                {savingId === apt.id ? "Saving..." : "Save"}
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <Dialog open={itemsOpen} onOpenChange={setItemsOpen}>
          <DialogContent className="sm:max-w-lg bg-white">
            <DialogHeader>
              <DialogTitle>Items for {itemsOrderNbr ?? "order"}</DialogTitle>
            </DialogHeader>
            {itemsLoading ? (
              <p className="text-sm text-muted-foreground">Loading items...</p>
            ) : itemsError ? (
              <p className="text-sm text-destructive">{itemsError}</p>
            ) : (
              <div className="space-y-4">
                {itemsOrderNbr && itemsByOrder[itemsOrderNbr]?.length ? (
                  <div className="space-y-2">
                    {itemsByOrder[itemsOrderNbr].map((line) => (
                      <div
                        key={`${line.orderNbr}-${line.inventoryId}-${line.qtySelected}`}
                        className="rounded-md border border-border/60 p-2"
                      >
                        <div className="text-sm font-medium text-foreground">
                          {line.inventoryId}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Qty: {line.qtySelected}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No items found.</p>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
    </div>
  );
}
