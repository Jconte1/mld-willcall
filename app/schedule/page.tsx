"use client";
import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays } from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/layout/Header';
import ProgressSteps from '@/components/scheduling/ProgressSteps';
import CalendarPicker from '@/components/scheduling/CalendarPicker';
import TimeSlotPicker from '@/components/scheduling/TimeSlotPicker';
import { usePickup } from '@/context/PickupContext';
import { generateAvailability, mockLocations } from '@/lib/mockData';
import { TimeSlot } from '@/lib/types';

const steps = [
  { id: 1, name: 'Location' },
  { id: 2, name: 'Date & Time' },
  { id: 3, name: 'Details' },
  { id: 4, name: 'Confirm' },
];

const SchedulePage: React.FC = () => {
  const router = useRouter();const { formData, updateFormData } = usePickup();
  
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    formData.selectedDate ? parseISO(formData.selectedDate) : null
  );
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(formData.selectedSlot);

  // Redirect if no pickup reference
  useEffect(() => {
  if (!formData.pickupReference) router.push('/');
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [formData.pickupReference]);

  const availability = useMemo(() => {
    return generateAvailability(new Date(), 60);
  }, []);

  const selectedDateAvailability = useMemo(() => {
    if (!selectedDate) return null;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return availability.find((day) => day.date === dateStr);
  }, [selectedDate, availability]);

  const location = mockLocations.find((loc) => loc.id === formData.locationId);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlot(slot);
  };

  const handleContinue = () => {
    if (selectedDate && selectedSlot) {
      updateFormData({
        selectedDate: format(selectedDate, 'yyyy-MM-dd'),
        selectedSlot,
      });
      router.push('/details');
    }
  };

  const handleBack = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="max-w-3xl mx-auto">
          <ProgressSteps steps={steps} currentStep={2} />

          {/* Pickup Info Banner */}
          <div className="mb-6 p-4 rounded-lg bg-secondary/50 border border-border">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-sm text-muted-foreground">Pickup #</span>
                <span className="ml-2 font-semibold text-foreground">{formData.pickupReference}</span>
              </div>
              {location && (
                <div>
                  <span className="text-sm text-muted-foreground">Location:</span>
                  <span className="ml-2 font-medium text-foreground">{location.name}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Calendar */}
            <Card className="animate-slide-up">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  Select Date
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CalendarPicker
                  availability={availability}
                  selectedDate={selectedDate}
                  onSelectDate={handleDateSelect}
                  minDate={new Date()}
                  maxDate={addDays(new Date(), 30)}
                />
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
                {selectedDate && selectedDateAvailability ? (
                  <TimeSlotPicker
                    slots={selectedDateAvailability.slots}
                    selectedSlot={selectedSlot}
                    onSelectSlot={handleSlotSelect}
                  />
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Choose a date from the calendar to see available time slots.</p>
                  </div>
                )}
              </CardContent>
            </Card>
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
              disabled={!selectedDate || !selectedSlot}
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
