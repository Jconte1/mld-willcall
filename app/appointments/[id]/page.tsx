"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { format, addDays, parseISO } from "date-fns";
import {
  CalendarDays,
  Clock,
  MapPin,
  Mail,
  Phone,
  ClipboardList,
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
};

function AppointmentContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const appointmentId = String(params.id || "");
  const token = searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [appointment, setAppointment] = useState<AppointmentResponse["appointment"] | null>(null);
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

  const isCancelled = appointment.status === "Cancelled";
  const isCompleted = appointment.status === "Completed";

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle>Pickup Appointment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  <span>{startLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{timeLabel}</span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5" />
                <div>
                  <div className="text-foreground">{location?.name ?? appointment.locationId}</div>
                  {location?.address && <div>{location.address}</div>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>{appointment.customerEmail}</span>
                </div>
                {appointment.customerPhone ? (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <span>{appointment.customerPhone}</span>
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg border border-border/60 bg-background/80 p-3">
                <div className="flex items-center gap-2 text-foreground">
                  <ClipboardList className="h-4 w-4" />
                  <span>Orders</span>
                </div>
                <div className="mt-2 text-muted-foreground">{orderNbrs.join(", ")}</div>
              </div>

              {!isCancelled && !isCompleted ? (
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setRescheduleOpen((prev) => !prev)}
                  >
                    {rescheduleOpen ? "Close Reschedule" : "Reschedule"}
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={handleCancel}
                  >
                    Cancel Appointment
                  </Button>
                </div>
              ) : null}

              {isCancelled ? (
                <div className="text-sm font-semibold text-destructive">
                  This appointment is cancelled. Please create a new appointment to reschedule.
                </div>
              ) : null}

              {isCompleted ? (
                <div className="text-sm font-medium text-muted-foreground">
                  This appointment is completed.
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
