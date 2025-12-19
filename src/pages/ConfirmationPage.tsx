import React, { useEffect, useState } from 'react';
import { useRouter } from "next/navigation";
import { CheckCircle, Calendar, Clock, MapPin, User, Phone, Mail, Car, FileText, Copy, Edit, X } from 'lucide-react';
import { format, parseISO, setHours, setMinutes } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/layout/Header';
import ProgressSteps from '@/components/scheduling/ProgressSteps';
import { usePickup } from '@/context/PickupContext';
import { mockLocations } from '@/lib/mockData';
import { useToast } from '@/hooks/use-toast';
import { Appointment } from '@/lib/types';

const steps = [
  { id: 1, name: 'Location' },
  { id: 2, name: 'Date & Time' },
  { id: 3, name: 'Details' },
  { id: 4, name: 'Confirm' },
];

const ConfirmationPage: React.FC = () => {
  const router = useRouter();const { formData, addAppointment, resetFormData } = usePickup();
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [appointmentId, setAppointmentId] = useState<string>('');

  // Redirect if no form data
  useEffect(() => {
  if (!formData.firstName || !formData.email) router.push('/details');
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [formData.firstName, formData.email]);

  const location = mockLocations.find((loc) => loc.id === formData.locationId);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const handleConfirm = () => {
    const newId = `apt-${Date.now()}`;
    
    const appointment: Appointment = {
      id: newId,
      pickupReference: formData.pickupReference,
      locationId: formData.locationId,
      startAt: `${formData.selectedDate}T${formData.selectedSlot?.startTime}:00`,
      endAt: `${formData.selectedDate}T${formData.selectedSlot?.endTime}:00`,
      status: 'Scheduled',
      customerFirstName: formData.firstName,
      customerLastName: formData.lastName,
      customerEmail: formData.email,
      customerPhone: formData.phone,
      vehicleInfo: formData.vehicleInfo || undefined,
      customerNotes: formData.notes || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addAppointment(appointment);
    setAppointmentId(newId);
    setIsSubmitted(true);

    toast({
      title: 'Pickup Scheduled!',
      description: 'You will receive a confirmation email shortly.',
    });
  };

  const handleNewSchedule = () => {
    resetFormData();
    router.push('/');
  };

  const handleCopyConfirmation = () => {
    const text = `Pickup Confirmation #${appointmentId.slice(-8).toUpperCase()}
Date: ${formData.selectedDate && format(parseISO(formData.selectedDate), 'MMMM d, yyyy')}
Time: ${formData.selectedSlot && formatTime(formData.selectedSlot.startTime)}
Location: ${location?.name}
Reference: ${formData.pickupReference}`;
    
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: 'Confirmation details copied to clipboard.',
    });
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
                Confirmation #{appointmentId.slice(-8).toUpperCase()}
              </p>
            </div>

            {/* Confirmation Card */}
            <Card className="text-left shadow-xl animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b">
                <CardTitle className="text-lg">Appointment Details</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Date</p>
                      <p className="font-medium">
                        {formData.selectedDate && format(parseISO(formData.selectedDate), 'EEEE, MMMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Time</p>
                      <p className="font-medium">
                        {formData.selectedSlot && formatTime(formData.selectedSlot.startTime)}
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
                  <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                    <p className="text-sm font-medium text-accent-foreground mb-1">Pickup Instructions</p>
                    <p className="text-sm text-muted-foreground">{location.instructions}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 mt-8 justify-center animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <Button variant="outline" onClick={handleCopyConfirmation}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Details
              </Button>
              <Button variant="secondary">
                <Edit className="h-4 w-4 mr-2" />
                Reschedule
              </Button>
              <Button variant="ghost" className="text-destructive hover:text-destructive">
                <X className="h-4 w-4 mr-2" />
                Cancel Pickup
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
          <ProgressSteps steps={steps} currentStep={4} />

          <Card className="shadow-xl animate-slide-up">
            <CardHeader className="border-b">
              <CardTitle>Review Your Appointment</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Date & Time */}
              <div className="flex items-start gap-4 p-4 rounded-lg bg-primary/5">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Calendar className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-lg">
                    {formData.selectedDate && format(parseISO(formData.selectedDate), 'EEEE, MMMM d, yyyy')}
                  </p>
                  <p className="text-muted-foreground">
                    {formData.selectedSlot && formatTime(formData.selectedSlot.startTime)}
                  </p>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">{location?.name}</p>
                  <p className="text-sm text-muted-foreground">{location?.address}</p>
                </div>
              </div>

              <hr />

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
              </div>

              <hr />

              {/* Pickup Reference */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <span className="text-sm text-muted-foreground">Pickup Reference</span>
                <span className="font-mono font-semibold">{formData.pickupReference}</span>
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <Button variant="ghost" onClick={() => router.push('/details')}>
              Edit Details
            </Button>
            <Button variant="hero" size="lg" onClick={handleConfirm}>
              <CheckCircle className="h-5 w-5 mr-2" />
              Confirm Pickup
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ConfirmationPage;
