import React, { useState, useMemo } from 'react';
import { useRouter } from "next/navigation";
import { Package, Search, ArrowRight, Truck, Clock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import LocationSelector from '@/components/scheduling/LocationSelector';
import { usePickup } from '@/context/PickupContext';
import { mockLocations } from '@/lib/mockData';
import Header from '@/components/layout/Header';

const Index: React.FC = () => {
  const router = useRouter();const { updateFormData, formData } = usePickup();
  const [pickupNumber, setPickupNumber] = useState(formData.pickupReference);
  const [selectedLocation, setSelectedLocation] = useState(formData.locationId || mockLocations[0].id);
  const [error, setError] = useState('');

  const handleContinue = () => {
    if (!pickupNumber.trim()) {
      setError('Please enter your pickup number');
      return;
    }
    
    updateFormData({
      pickupReference: pickupNumber.trim(),
      locationId: selectedLocation,
    });
    
    router.push('/schedule');
  };

  const features = [
    {
      icon: Clock,
      title: 'Save Time',
      description: 'Skip the wait with a pre-scheduled pickup slot',
    },
    {
      icon: Truck,
      title: 'Convenient',
      description: 'Choose a time that works for your schedule',
    },
    {
      icon: CheckCircle,
      title: 'Peace of Mind',
      description: 'Get confirmation and reminders for your pickup',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8 md:py-16">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12 animate-fade-in">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl gradient-hero shadow-glow mb-6">
              <Package className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
              Schedule Your Pickup
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Reserve your time slot and skip the wait. Enter your pickup number below to get started.
            </p>
          </div>

          {/* Main Card */}
          <Card className="shadow-xl border-0 overflow-hidden animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <CardContent className="p-6 md:p-8">
              {/* Pickup Number Input */}
              <div className="mb-8">
                <label htmlFor="pickup-number" className="block text-sm font-medium text-foreground mb-2">
                  Pickup Number
                </label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="pickup-number"
                    type="text"
                    placeholder="Enter your pickup or order number"
                    value={pickupNumber}
                    onChange={(e) => {
                      setPickupNumber(e.target.value);
                      setError('');
                    }}
                    className="pl-12 h-14 text-lg"
                  />
                </div>
                {error && (
                  <p className="mt-2 text-sm text-destructive">{error}</p>
                )}
              </div>

              {/* Location Selection */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-foreground mb-3">
                  Select Pickup Location
                </label>
                <LocationSelector
                  locations={mockLocations}
                  selectedLocationId={selectedLocation}
                  onSelectLocation={setSelectedLocation}
                />
              </div>

              {/* Continue Button */}
              <Button
                variant="hero"
                size="xl"
                className="w-full"
                onClick={handleContinue}
              >
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
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
