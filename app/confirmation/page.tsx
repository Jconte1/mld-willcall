"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CheckCircle, Calendar, CalendarDays, CalendarPlus, Clock, MapPin, User, Phone, Mail, Car, FileText, Copy, Edit, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import Header from '@/components/layout/Header';
import ProgressSteps from '@/components/scheduling/ProgressSteps';
import { usePickup } from '@/context/PickupContext';
import { pickupLocations } from '@/lib/pickupLocations';
import { useToast } from '@/hooks/use-toast';

const steps = [
  { id: 1, name: 'Location' },
  { id: 2, name: 'Item Selection' },
  { id: 3, name: 'Date & Time' },
  { id: 4, name: 'Details' },
  { id: 5, name: 'Confirm' },
];

const ConfirmationPage: React.FC = () => {
  const router = useRouter();
  const { formData, resetFormData, updateFormData } = usePickup();
  const { data: session } = useSession();
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [appointmentIds, setAppointmentIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [expandedItemOrders, setExpandedItemOrders] = useState<Set<string>>(new Set());

  const ITEM_PREVIEW_LIMIT = 5;

  // Redirect if no form data
  useEffect(() => {
    if (formData.selectedItems.length === 0) {
      router.push('/items');
      return;
    }
    const ready =
      formData.firstName &&
      formData.email &&
      formData.appointmentGroups.length > 0 &&
      formData.appointmentGroups.every(
        (group) => group.selectedDate && group.selectedSlots.length === group.requiredSlots
      );
    if (!ready) router.push('/details');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.firstName,
    formData.email,
    formData.appointmentGroups.length,
    formData.selectedItems.length,
  ]);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const handleConfirm = async () => {
    const user = session?.user as any;
    const isOrderReady = Boolean(formData.orderReadyToken);
    if (!isOrderReady && (!user?.id || !user?.email)) {
      toast({ title: "Unable to schedule", description: "Missing account information." });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/customer/pickups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: isOrderReady ? undefined : user?.id,
          orderReadyToken: formData.orderReadyToken || undefined,
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          smsOptIn: formData.smsOptIn,
          vehicleInfo: formData.vehicleInfo,
          notes: formData.notes,
          groups: formData.appointmentGroups,
          selectedItems: formData.selectedItems,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message ?? "Unable to schedule pickup.");
      }

      const newIds = Array.isArray(data?.appointments)
        ? data.appointments.map((apt: { id: string }) => apt.id)
        : [];
      setAppointmentIds(newIds);
      setIsSubmitted(true);
      updateFormData({ orderReadyToken: "" });

      toast({
        title: 'Pickup Scheduled!',
        description: 'Your pickup appointment(s) are confirmed.',
      });
    } catch (err: any) {
      toast({
        title: "Scheduling failed",
        description: err?.message ?? "Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewSchedule = () => {
    resetFormData();
    router.push('/');
  };

  const handleCopyConfirmation = () => {
    const details = formData.appointmentGroups
      .map((group) => {
        const location = pickupLocations.find((loc) => loc.id === group.locationId);
        const dateLabel = group.selectedDate
          ? format(parseISO(group.selectedDate), 'MMMM d, yyyy')
          : '';
        const times = group.selectedSlots.map((slot) => formatTime(slot.startTime)).join(', ');
        return `Location: ${location?.name}\nDate: ${dateLabel}\nTime: ${times}\nOrders: ${group.orderNbrs.join(
          ", "
        )}`;
      })
      .join("\n\n");

    const text = `Pickup Confirmation #${appointmentIds.slice(-1)[0]?.slice(-8).toUpperCase() ?? ""}
${details}
Reference: ${formData.pickupReference}`;
    
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: 'Confirmation details copied to clipboard.',
    });
  };

  const formatIcsDateTime = (date: string, time: string) => {
    const [hh, mm] = time.split(":");
    return `${date.replace(/-/g, "")}T${hh}${mm}00`;
  };

  const formatIcsStamp = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  };

  const handleAddToCalendar = () => {
    const events = formData.appointmentGroups.map((group) => {
      const slots = [...group.selectedSlots].sort((a, b) =>
        a.startTime.localeCompare(b.startTime)
      );
      const startTime = slots[0]?.startTime;
      const endTime = slots[slots.length - 1]?.endTime;
      const location = pickupLocations.find((loc) => loc.id === group.locationId);
      const summary = `Pickup Appointment - ${location?.name ?? "Will Call"}`;
      const description = `Orders: ${group.orderNbrs.join(", ")}${
        location?.address ? `\\nLocation: ${location.address}` : ""
      }`;

      return {
        summary,
        description,
        location: location?.address ?? "",
        dtStart: formatIcsDateTime(group.selectedDate, startTime),
        dtEnd: formatIcsDateTime(group.selectedDate, endTime),
      };
    });

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//MLD WillCall//EN",
      "CALSCALE:GREGORIAN",
    ];

    const dtstamp = formatIcsStamp(new Date());
    events.forEach((event, index) => {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${appointmentIds[0] ?? "pickup"}-${index}@mld-willcall`);
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`SUMMARY:${event.summary}`);
      lines.push(`DESCRIPTION:${event.description}`);
      if (event.location) lines.push(`LOCATION:${event.location}`);
      lines.push(`DTSTART;TZID=America/Denver:${event.dtStart}`);
      lines.push(`DTEND;TZID=America/Denver:${event.dtEnd}`);
      lines.push("END:VEVENT");
    });

    lines.push("END:VCALENDAR");

    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pickup-appointments.ics";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCancelFromConfirmation = async () => {
    const user = session?.user as any;
    if (!user?.id || !user?.email) {
      toast({ title: "Unable to cancel", description: "Missing account information." });
      return;
    }

    if (appointmentIds.length === 0) {
      toast({ title: "No appointments to cancel", description: "Please contact support." });
      return;
    }

    setIsCancelling(true);
    try {
      const results = await Promise.all(
        appointmentIds.map(async (appointmentId) => {
          const res = await fetch(`/api/customer/pickups/${appointmentId}/cancel`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user.id,
              email: user.email,
              suppressNotifications: true,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data?.message ?? "Unable to cancel pickup.");
          }
          return data;
        })
      );

      if (results.length) {
        toast({
          title: "Pickup cancelled",
          description: "Your appointment has been cancelled.",
        });
      }
      resetFormData();
      router.push("/");
    } catch (err: any) {
      toast({
        title: "Cancellation failed",
        description: err?.message ?? "Please try again.",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="container py-8 md:py-16">
          <div className="max-w-2xl mx-auto text-center">
            {/* Success Animation */}
            <div className="mb-8 animate-scale-in">
              <div className="inline-flex items-center justify-center h-24 w-24 rounded-full bg-success/10 mb-6">
                <CheckCircle className="h-12 w-12 text-success" />
              </div>
              <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">
                Pickup Scheduled!
              </h1>
              <p className="text-muted-foreground">
                {appointmentIds.length} appointment{appointmentIds.length === 1 ? "" : "s"} confirmed
              </p>
            </div>

            {/* Confirmation Card */}
            <Card
              className="text-left shadow-xl animate-slide-up bg-secondary/30 border-dashed"
              style={{ animationDelay: '0.2s' }}
            >
              <CardHeader className="border-b">
                <CardTitle className="text-lg">Appointment Details</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {formData.appointmentGroups.map((group) => {
                  const location = pickupLocations.find((loc) => loc.id === group.locationId);
                  return (
                    <div
                      key={group.id}
                      className="rounded-lg border border-border/60 bg-background/70 p-4 space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-start gap-3">
                          <Calendar className="h-5 w-5 text-primary mt-0.5" />
                          <div>
                            <p className="text-sm text-muted-foreground">Date</p>
                            <p className="font-medium">
                              {group.selectedDate &&
                                format(parseISO(group.selectedDate), 'EEEE, MMMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Clock className="h-5 w-5 text-primary mt-0.5" />
                          <div>
                            <p className="text-sm text-muted-foreground">Time</p>
                            <p className="font-medium">
                              {group.selectedSlots.map((slot) => formatTime(slot.startTime)).join(', ')}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 pt-2 border-t">
                        <MapPin className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <p className="text-sm text-muted-foreground">Location</p>
                          <p className="font-medium">{location?.name}</p>
                          <p className="text-sm text-muted-foreground">{location?.address}</p>
                        </div>
                      </div>
                      {location?.instructions && (
                        <div className="p-4 rounded-lg bg-white border border-black/20">
                          <p className="text-sm font-medium text-accent-foreground mb-1">
                            Pickup Instructions
                          </p>
                          <p className="text-sm text-muted-foreground">{location.instructions}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 mt-8 justify-center animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <Button
                variant="outline"
                className="border-transparent bg-[#d9b45b] text-black hover:bg-[#caa44a]"
                onClick={handleAddToCalendar}
              >
                <CalendarPlus className="h-5 w-5 mr-2" />
                Add to Calendar
              </Button>
              <Button variant="outline" onClick={handleCopyConfirmation}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Details
              </Button>
              <Button variant="hero">
                <Edit className="h-4 w-4 mr-2" />
                Reschedule
              </Button>
              <Button
                className="bg-red-500 text-white hover:bg-red-600 hover:-translate-y-[1px] transition-transform"
                onClick={handleCancelFromConfirmation}
                disabled={isCancelling}
              >
                <X className="h-4 w-4 mr-2" />
                {isCancelling ? "Cancelling..." : "Cancel Pickup"}
              </Button>
            </div>

            <div className="mt-12 animate-slide-up" style={{ animationDelay: '0.4s' }}>
              <Button variant="hero" onClick={handleNewSchedule}>
                Schedule Another Pickup
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="max-w-2xl mx-auto">
          <ProgressSteps steps={steps} currentStep={5} />

          <Card className="shadow-xl animate-slide-up">
            <CardHeader className="border-b">
              <CardTitle>Review Your Appointment</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Contact Info */}
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground">Contact Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{formData.firstName} {formData.lastName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{formData.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{formData.phone}</span>
                  </div>
                  {formData.vehicleInfo && (
                    <div className="flex items-center gap-2 text-sm">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      <span>{formData.vehicleInfo}</span>
                    </div>
                  )}
                </div>
                {formData.notes && (
                  <div className="flex items-start gap-2 text-sm mt-2">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span className="text-muted-foreground">{formData.notes}</span>
                  </div>
                )}
                <div className="rounded-lg border border-border bg-white p-3 text-sm space-y-3">
                    <label className="flex items-start gap-3">
                      <Checkbox
                        checked={formData.smsOptIn}
                        onCheckedChange={(checked) =>
                          updateFormData({ smsOptIn: Boolean(checked) }) //
                        }
                        className="mt-0.5"
                      />
                      <span className="text-muted-foreground">
                        Text appointment updates (optional)
                      </span>
                    </label>
                    <p className="text-xs font-semibold text-foreground">
                      We strongly recommend opting in so you don't miss anything.
                    </p>
                </div>
              </div>

              <hr />

              {/* Appointment Details */}
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground">Appointment Details</h3>
                <div className="rounded-lg border border-border/60 bg-secondary/30 border-dashed p-4 space-y-3">
                  {formData.appointmentGroups.map((group) => {
                    const location = pickupLocations.find((loc) => loc.id === group.locationId);
                    const selectedDate = group.selectedDate ? parseISO(group.selectedDate) : null;
                    return (
                      <div
                        key={group.id}
                        className="rounded-lg border border-border/60 bg-background/70 p-4"
                      >
                        <div className="flex flex-wrap gap-4 items-start text-sm">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="font-semibold text-foreground">{location?.name}</p>
                              <p className="text-xs text-muted-foreground">{location?.address}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <CalendarDays className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="text-muted-foreground">Date</p>
                              <p className="font-medium">
                                {selectedDate ? format(selectedDate, 'MMM d, yyyy') : '--'}
                              </p>
                            </div>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Time</p>
                            <p className="font-medium">
                              {group.selectedSlots.map((slot) => formatTime(slot.startTime)).join(', ')}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Orders</p>
                            <p className="font-medium">
                              {group.orderNbrs.length} order{group.orderNbrs.length === 1 ? "" : "s"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <hr />

              {/* Pickup Reference */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <span className="text-sm text-muted-foreground">Pickup Reference</span>
                <span className="font-mono font-semibold">{formData.pickupReference}</span>
              </div>

              {formData.selectedItems.length ? (
                <div className="rounded-lg border border-border/60 bg-white p-4 space-y-4">
                  <div className="text-sm font-semibold text-foreground">Items to Pick Up</div>
                  {formData.selectedItems.map((selection) => (
                    <div key={selection.orderNbr} className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <span>Order {selection.orderNbr}</span>
                        {selection.items.length > ITEM_PREVIEW_LIMIT ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto px-2 py-1 text-xs"
                            onClick={() =>
                              setExpandedItemOrders((prev) => {
                                const next = new Set(prev);
                                if (next.has(selection.orderNbr)) {
                                  next.delete(selection.orderNbr);
                                } else {
                                  next.add(selection.orderNbr);
                                }
                                return next;
                              })
                            }
                          >
                            {expandedItemOrders.has(selection.orderNbr)
                              ? "Show fewer"
                              : `Show all items (+${selection.items.length - ITEM_PREVIEW_LIMIT})`}
                          </Button>
                        ) : null}
                      </div>
                      <div className="space-y-1 text-sm">
                        {(expandedItemOrders.has(selection.orderNbr)
                          ? selection.items
                          : selection.items.slice(0, ITEM_PREVIEW_LIMIT)
                        ).map((item) => (
                          <div
                            key={item.lineId}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2"
                          >
                            <div>
                              <div className="font-medium text-foreground">
                                {item.inventoryId ?? "Item"}
                              </div>
                              {item.description ? (
                                <div className="text-xs text-muted-foreground">
                                  {item.description}
                                </div>
                              ) : null}
                            </div>
                            <div className="text-sm font-medium text-foreground">
                              Qty {item.qty}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-8">
            <Button
              variant="outline"
              className="border-transparent bg-[#d9b45b] text-black hover:bg-[#caa44a]"
              onClick={() => router.push('/details')}
            >
              Edit Details
            </Button>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="hero" size="lg" onClick={handleConfirm} disabled={isSubmitting}>
                <CheckCircle className="h-5 w-5 mr-2" />
                {isSubmitting ? "Confirming..." : "Confirm Pickup"}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ConfirmationPage;
