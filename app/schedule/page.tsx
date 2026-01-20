"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, MapPin } from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/layout/Header';
import ProgressSteps from '@/components/scheduling/ProgressSteps';
import CalendarPicker from '@/components/scheduling/CalendarPicker';
import TimeSlotPicker from '@/components/scheduling/TimeSlotPicker';
import { usePickup } from '@/context/PickupContext';
import { pickupLocations } from '@/lib/pickupLocations';
import { AppointmentGroup, DayAvailability } from '@/lib/types';

const steps = [
  { id: 1, name: 'Location' },
  { id: 2, name: 'Item Selection' },
  { id: 3, name: 'Date & Time' },
  { id: 4, name: 'Details' },
  { id: 5, name: 'Confirm' },
];

const SCHEDULE_DAYS = 30;

const SchedulePage: React.FC = () => {
  const router = useRouter();
  const { formData, updateFormData } = usePickup();

  const [groups, setGroups] = useState<AppointmentGroup[]>(() => formData.appointmentGroups);
  const [availabilityByGroup, setAvailabilityByGroup] = useState<Record<string, DayAvailability[]>>(
    {}
  );
  const [availabilityLoading, setAvailabilityLoading] = useState<Record<string, boolean>>({});
  const [availabilityError, setAvailabilityError] = useState<string>("");

  // Redirect if no pickup reference
  useEffect(() => {
    if (!formData.pickupReference || formData.appointmentGroups.length === 0) {
      router.push('/');
      return;
    }
    if (formData.selectedItems.length === 0) {
      router.push('/items');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.pickupReference, formData.appointmentGroups.length, formData.selectedItems.length]);

  useEffect(() => {
    if (!groups.length) return;
    const from = format(new Date(), 'yyyy-MM-dd');
    const to = format(addDays(new Date(), SCHEDULE_DAYS), 'yyyy-MM-dd');

    let active = true;
    const load = async () => {
      setAvailabilityError("");
      const loadingState: Record<string, boolean> = {};
      groups.forEach((group) => {
        loadingState[group.id] = true;
      });
      setAvailabilityLoading(loadingState);

      try {
        const results = await Promise.all(
          groups.map(async (group) => {
            const params = new URLSearchParams({
              locationId: group.locationId,
              from,
              to,
            });
            const res = await fetch(`/api/customer/pickups/availability?${params.toString()}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              throw new Error(data?.message ?? "Unable to load availability.");
            }
            return { groupId: group.id, availability: data.availability ?? [] };
          })
        );

        if (!active) return;
        const next: Record<string, DayAvailability[]> = {};
        results.forEach((result) => {
          next[result.groupId] = result.availability;
        });
        setAvailabilityByGroup(next);
      } catch (err) {
        if (active) {
          setAvailabilityError("Unable to load available time slots. Please try again.");
        }
      } finally {
        if (active) {
          const doneState: Record<string, boolean> = {};
          groups.forEach((group) => {
            doneState[group.id] = false;
          });
          setAvailabilityLoading(doneState);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [groups]);

  const updateGroup = (groupId: string, patch: Partial<AppointmentGroup>) => {
    setGroups((prev) =>
      prev.map((group) => (group.id === groupId ? { ...group, ...patch } : group))
    );
  };

  const handleContinue = () => {
    const ready = groups.every(
      (group) => group.selectedDate && group.selectedSlots.length === group.requiredSlots
    );
    if (!ready) return;
    updateFormData({ appointmentGroups: groups });
    router.push('/details');
  };

  const handleBack = () => {
    router.push('/items');
  };

  const missingSelections = groups.some(
    (group) => !group.selectedDate || group.selectedSlots.length !== group.requiredSlots
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="max-w-4xl mx-auto">
          <ProgressSteps steps={steps} currentStep={3} />

          {/* Pickup Info Banner */}
          <div className="mb-6 p-4 rounded-lg bg-secondary/50 border border-border">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-sm text-muted-foreground">Pickup #</span>
                <span className="ml-2 font-semibold text-foreground">{formData.pickupReference}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {groups.length} location{groups.length === 1 ? "" : "s"} to schedule
              </div>
            </div>
          </div>

          <div className="space-y-10">
            {groups.map((group, index) => {
              const location = pickupLocations.find((loc) => loc.id === group.locationId);
              const availability = availabilityByGroup[group.id] ?? [];
              const selectedDate = group.selectedDate ? parseISO(group.selectedDate) : null;
              const selectedDayAvailability =
                group.selectedDate &&
                availability.find((day) => day.date === group.selectedDate);

              return (
                <section key={group.id} className="space-y-4">
                  <Card className="border-border/60 bg-secondary/30 border-dashed">
                    <CardContent className="p-4">
                      <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span>Location</span>
                          </div>
                          <div className="font-semibold text-foreground">
                            {location?.name ?? "Pickup Location"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {group.orderNbrs.length} order{group.orderNbrs.length === 1 ? "" : "s"}
                          </div>
                        </div>
                        {location?.address && (
                          <p className="mt-2 text-sm text-muted-foreground">{location.address}</p>
                        )}
                        <div className="mt-3 text-sm text-muted-foreground">
                          {group.requiredSlots === 1
                            ? "Select one 15-minute pickup window for this location."
                            : "Select two 15-minute pickup windows for this location."}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid gap-6 lg:grid-cols-2">
                    {/* Calendar */}
                    <Card className="animate-slide-up">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <CalendarDays className="h-5 w-5 text-primary" />
                          {`Select Date ${groups.length > 1 ? `(${index + 1})` : ""}`}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {availabilityLoading[group.id] ? (
                          <div className="py-8 text-sm text-muted-foreground">
                            Loading available dates...
                          </div>
                        ) : (
                          <CalendarPicker
                            availability={availability}
                            selectedDate={selectedDate}
                            onSelectDate={(date) =>
                              updateGroup(group.id, {
                                selectedDate: format(date, 'yyyy-MM-dd'),
                                selectedSlots: [],
                              })
                            }
                            minDate={new Date()}
                            maxDate={addDays(new Date(), SCHEDULE_DAYS)}
                          />
                        )}
                      </CardContent>
                    </Card>

                    {/* Time Slots */}
                    <Card className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
                      <CardHeader>
                        <CardTitle>
                          {selectedDate
                            ? format(selectedDate, 'EEEE, MMMM d')
                            : 'Select a date to view times'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {availabilityLoading[group.id] ? (
                          <div className="py-8 text-center text-muted-foreground">
                            <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>Loading time slots...</p>
                          </div>
                        ) : selectedDate && selectedDayAvailability ? (
                          <div className="space-y-4">
                            <div className="text-sm text-muted-foreground">
                              {group.requiredSlots === 1
                                ? "Choose a single time slot."
                                : `Choose ${group.requiredSlots} time slots.`}
                            </div>
                            <TimeSlotPicker
                              slots={selectedDayAvailability.slots}
                              selectedSlots={group.selectedSlots}
                              maxSelections={group.requiredSlots}
                              onSelectSlots={(slots) => updateGroup(group.id, { selectedSlots: slots })}
                            />
                          </div>
                        ) : (
                          <div className="py-8 text-center text-muted-foreground">
                            <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>
                              {availabilityError
                                ? availabilityError
                                : "Choose a date from the calendar to see available time slots."}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </section>
              );
            })}
          </div>

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <Button variant="ghost" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              variant="hero"
              size="lg"
              onClick={handleContinue}
              disabled={missingSelections}
            >
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SchedulePage;
