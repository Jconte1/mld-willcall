import React, { useState, useEffect } from 'react';
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, User, Phone, Mail, Car, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import Header from '@/components/layout/Header';
import ProgressSteps from '@/components/scheduling/ProgressSteps';
import { usePickup } from '@/context/PickupContext';
import { mockLocations } from '@/lib/mockData';

const steps = [
  { id: 1, name: 'Location' },
  { id: 2, name: 'Date & Time' },
  { id: 3, name: 'Details' },
  { id: 4, name: 'Confirm' },
];

const DetailsPage: React.FC = () => {
  const router = useRouter();const { formData, updateFormData } = usePickup();

  const [firstName, setFirstName] = useState(formData.firstName);
  const [lastName, setLastName] = useState(formData.lastName);
  const [email, setEmail] = useState(formData.email);
  const [phone, setPhone] = useState(formData.phone);
  const [vehicleInfo, setVehicleInfo] = useState(formData.vehicleInfo);
  const [notes, setNotes] = useState(formData.notes);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Redirect if no date/slot selected
  useEffect(() => {
    if (!formData.selectedDate || !formData.selectedSlot) {
      router.push('/schedule');
    }
  }, [formData.selectedDate, formData.selectedSlot, navigate]);

  const location = mockLocations.find((loc) => loc.id === formData.locationId);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (validate()) {
      updateFormData({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        vehicleInfo: vehicleInfo.trim(),
        notes: notes.trim(),
      });
      router.push('/confirmation');
    }
  };

  const handleBack = () => {
    router.push('/schedule');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="max-w-2xl mx-auto">
          <ProgressSteps steps={steps} currentStep={3} />

          {/* Appointment Summary */}
          <Card className="mb-6 bg-secondary/30 border-dashed animate-fade-in">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 justify-between text-sm">
                <div>
                  <span className="text-muted-foreground">Pickup #</span>
                  <span className="ml-2 font-semibold">{formData.pickupReference}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Date:</span>
                  <span className="ml-2 font-medium">
                    {formData.selectedDate && format(parseISO(formData.selectedDate), 'MMM d, yyyy')}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Time:</span>
                  <span className="ml-2 font-medium">
                    {formData.selectedSlot && formatTime(formData.selectedSlot.startTime)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Location:</span>
                  <span className="ml-2 font-medium">{location?.name}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Form */}
          <Card className="animate-slide-up">
            <CardHeader>
              <CardTitle>Your Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Name Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-foreground mb-2">
                    First Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                      className="pl-10"
                    />
                  </div>
                  {errors.firstName && (
                    <p className="mt-1 text-sm text-destructive">{errors.firstName}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-foreground mb-2">
                    Last Name *
                  </label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Smith"
                  />
                  {errors.lastName && (
                    <p className="mt-1 text-sm text-destructive">{errors.lastName}</p>
                  )}
                </div>
              </div>

              {/* Contact Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                    Email *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="john@example.com"
                      className="pl-10"
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-sm text-destructive">{errors.email}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-2">
                    Phone *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(303) 555-0123"
                      className="pl-10"
                    />
                  </div>
                  {errors.phone && (
                    <p className="mt-1 text-sm text-destructive">{errors.phone}</p>
                  )}
                </div>
              </div>

              {/* Vehicle Info */}
              <div>
                <label htmlFor="vehicle" className="block text-sm font-medium text-foreground mb-2">
                  Vehicle Description (optional)
                </label>
                <div className="relative">
                  <Car className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="vehicle"
                    value={vehicleInfo}
                    onChange={(e) => setVehicleInfo(e.target.value)}
                    placeholder="e.g., Blue Ford F-150"
                    className="pl-10"
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Helps our team identify you upon arrival
                </p>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-foreground mb-2">
                  Special Instructions (optional)
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any special requirements or notes for your pickup..."
                    className="pl-10 min-h-[100px]"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <Button variant="ghost" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button variant="hero" size="lg" onClick={handleContinue}>
              Review & Confirm
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DetailsPage;
