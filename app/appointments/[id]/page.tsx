"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { format, addDays, parseISO } from "date-fns";
import {
  CalendarDays,
  Clock,
  MapPin,
  Mail,
  Phone,
  ClipboardList,
  User,
  ArrowLeft,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { pickupLocations } from "@/lib/pickupLocations";
import CalendarPicker from "@/components/scheduling/CalendarPicker";
import TimeSlotPicker from "@/components/scheduling/TimeSlotPicker";
import { DayAvailability, TimeSlot } from "@/lib/types";

type AppointmentOrder = { orderNbr: string };
type AppointmentOrderItem = {
  inventoryId: string | null;
  lineDescription: string | null;
  qty: number | null;
};
type AppointmentOrderLines = {
  orderNbr: string;
  items: AppointmentOrderItem[];
};
type AppointmentResponse = {
  appointment: {
    id: string;
    startAt: string;
    endAt: string;
    locationId: string;
    status: string;
    customerFirstName: string;
    customerLastName: string | null;
    customerEmail: string;
    customerPhone: string | null;
    orders: AppointmentOrder[];
  };
  orderLines?: AppointmentOrderLines[];
};

function AppointmentContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const appointmentId = String(params.id || "");
  const token = searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [appointment, setAppointment] = useState<AppointmentResponse["appointment"] | null>(null);
  const [orderLines, setOrderLines] = useState<AppointmentOrderLines[]>([]);
  const [nextLink, setNextLink] = useState<string | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);

  const orderNbrs = useMemo(
    () => appointment?.orders?.map((o) => o.orderNbr) ?? [],
    [appointment]
  );
  const requiredSlots = orderNbrs.length > 6 ? 2 : 1;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    fetch(`/api/public/appointments/${appointmentId}?token=${encodeURIComponent(token)}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!active) return;
        if (!ok) {
          setError(data?.message ?? "Unable to load appointment.");
          return;
        }
        setAppointment(data?.appointment ?? null);
        setOrderLines(data?.orderLines ?? []);
      })
      .catch(() => {
        if (active) setError("Unable to load appointment.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [appointmentId, token]);

  useEffect(() => {
    if (!rescheduleOpen || !appointment) return;
    const from = format(new Date(), "yyyy-MM-dd");
    const to = format(addDays(new Date(), 30), "yyyy-MM-dd");

    setAvailabilityLoading(true);
    fetch(
      `/api/customer/pickups/availability?locationId=${encodeURIComponent(
        appointment.locationId
      )}&from=${from}&to=${to}`
    )
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          throw new Error(data?.message ?? "Unable to load availability.");
        }
        setAvailability(data?.availability ?? []);
      })
      .catch(() => {
        setAvailability([]);
        toast({
          title: "Unable to load availability",
          description: "Please try again later.",
        });
      })
      .finally(() => setAvailabilityLoading(false));
  }, [rescheduleOpen, appointment, toast]);

  const handleCancel = async () => {
    const res = await fetch(`/api/public/appointments/${appointmentId}?token=${encodeURIComponent(token)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: "Unable to cancel", description: data?.message ?? "Try again." });
      return;
    }
    setAppointment(data.appointment ?? null);
    toast({ title: "Appointment cancelled" });
  };

  const handleReschedule = async () => {
    if (!selectedDate || selectedSlots.length !== requiredSlots) {
      toast({ title: "Select a new time", description: "Choose valid time slots to continue." });
      return;
    }
    const res = await fetch(`/api/public/appointments/${appointmentId}?token=${encodeURIComponent(token)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reschedule",
        selectedDate,
        selectedSlots: selectedSlots.map((slot) => ({
          startTime: slot.startTime,
          endTime: slot.endTime,
        })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: "Reschedule failed", description: data?.message ?? "Try again." });
      return;
    }
    setAppointment(data.appointment ?? null);
    setRescheduleOpen(false);
    if (data.link) setNextLink(data.link);
    toast({ title: "Appointment rescheduled" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-10 text-center text-muted-foreground">Loading...</main>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-10 text-center text-destructive">
          {error || "Appointment not found."}
        </main>
      </div>
    );
  }

  const location = pickupLocations.find((loc) => loc.id === appointment.locationId);
  const startLabel = format(parseISO(appointment.startAt), "EEEE, MMMM d, yyyy");
  const timeLabel = `${format(parseISO(appointment.startAt), "h:mm a")} - ${format(
    parseISO(appointment.endAt),
    "h:mm a"
  )}`;
  const formatQty = (qty: number | null) => {
    if (qty == null) return "--";
    return Number.isInteger(qty) ? `${qty}` : qty.toFixed(2);
  };

  const isCancelled = appointment.status === "Cancelled";
  const isCompleted = appointment.status === "Completed";

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => router.push("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to scheduling
            </Button>
          </div>
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle>Pickup Appointment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              {isCompleted ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
                  Thank you! Your Appointment is complete!
                </div>
              ) : null}
              <div className="rounded-lg border border-border/60 bg-secondary/30 border-dashed p-4 space-y-3">
                <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                  <div className="flex flex-wrap gap-4 items-start text-sm">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-semibold text-foreground">
                          {location?.name ?? appointment.locationId}
                        </p>
                        <p className="text-xs text-muted-foreground">{location?.address ?? ""}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-muted-foreground">Date</p>
                        <p className="font-medium">{startLabel}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Time</p>
                      <p className="font-medium">{timeLabel}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Orders</p>
                      <p className="font-medium">
                        {orderNbrs.length} order{orderNbrs.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border/60 bg-white p-4 space-y-2">
                <div className="flex items-center gap-2 text-foreground">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">Contact Information</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {appointment.customerFirstName}
                      {appointment.customerLastName ? ` ${appointment.customerLastName}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{appointment.customerEmail}</span>
                  </div>
                  {appointment.customerPhone ? (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{appointment.customerPhone}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border border-border/60 bg-white p-4 space-y-4">
                <div className="flex items-center gap-2 text-foreground">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">Items to Pick Up</span>
                </div>
                {orderLines.length ? (
                  <div className="space-y-4">
                    {orderLines.map((order) => (
                      <div key={order.orderNbr} className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Order {order.orderNbr}
                        </div>
                        <div className="space-y-2">
                          {order.items.length ? (
                            order.items.map((item, index) => (
                              <div
                                key={`${order.orderNbr}-${item.inventoryId ?? "item"}-${index}`}
                                className="flex items-center justify-between rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm"
                              >
                                <div>
                                  <div className="font-semibold text-foreground">
                                    {item.inventoryId ?? "Item"}
                                  </div>
                                  {item.lineDescription ? (
                                    <div className="text-xs text-muted-foreground">
                                      {item.lineDescription}
                                    </div>
                                  ) : null}
                                </div>
                                  <div className="text-xs text-muted-foreground">
                                    Qty: <span className="font-semibold text-foreground">{formatQty(item.qty)}</span>
                                  </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-muted-foreground">No items listed.</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No items available.</div>
                )}
              </div>

              {!isCompleted ? (
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button
                    variant="hero"
                    onClick={() => setRescheduleOpen((prev) => !prev)}
                  >
                    {rescheduleOpen ? "Close Reschedule" : "Reschedule"}
                  </Button>
                  {!isCancelled ? (
                    <Button
                      className="bg-red-500 text-white hover:bg-red-600 hover:-translate-y-[1px] transition-transform"
                      onClick={handleCancel}
                    >
                      Cancel Appointment
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {isCancelled ? (
                <div className="text-sm font-semibold text-destructive">
                  This appointment is cancelled. Please reschedule below.
                </div>
              ) : null}

              {nextLink ? (
                <div className="text-xs text-muted-foreground">
                  Manage link: {nextLink}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {rescheduleOpen ? (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Reschedule Appointment</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-2">
                <div>
                  {availabilityLoading ? (
                    <div className="py-6 text-sm text-muted-foreground">Loading availability...</div>
                  ) : (
                    <CalendarPicker
                      availability={availability}
                      selectedDate={selectedDate ? parseISO(selectedDate) : null}
                      onSelectDate={(date) => {
                        setSelectedDate(format(date, "yyyy-MM-dd"));
                        setSelectedSlots([]);
                      }}
                      minDate={new Date()}
                      maxDate={addDays(new Date(), 30)}
                    />
                  )}
                </div>
                <div>
                  {selectedDate ? (
                    <TimeSlotPicker
                      slots={availability.find((day) => day.date === selectedDate)?.slots ?? []}
                      selectedSlots={selectedSlots}
                      maxSelections={requiredSlots}
                      onSelectSlots={setSelectedSlots}
                    />
                  ) : (
                    <div className="py-6 text-sm text-muted-foreground">
                      Select a date to view available times.
                    </div>
                  )}
                  <div className="mt-4 text-sm text-muted-foreground">
                    {requiredSlots === 1
                      ? "Select one 15-minute pickup window."
                      : "Select two consecutive 15-minute pickup windows."}
                  </div>
                  <div className="mt-6">
                    <Button variant="hero" onClick={handleReschedule}>
                      Confirm Reschedule
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </main>
    </div>
  );
}

export default function AppointmentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AppointmentContent />
    </Suspense>
  );
}
