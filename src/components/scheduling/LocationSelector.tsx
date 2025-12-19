import React from 'react';
import { MapPin, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Location } from '@/lib/types';
import { cn } from '@/lib/utils';

interface LocationSelectorProps {
  locations: Location[];
  selectedLocationId: string;
  onSelectLocation: (locationId: string) => void;
}

const LocationSelector: React.FC<LocationSelectorProps> = ({
  locations,
  selectedLocationId,
  onSelectLocation,
}) => {
  return (
    <div className="space-y-3">
      {locations.map((location) => {
        const isSelected = selectedLocationId === location.id;

        return (
          <Card
            key={location.id}
            className={cn(
              "cursor-pointer transition-all duration-200 hover:shadow-lg",
              isSelected
                ? "ring-2 ring-primary shadow-lg"
                : "hover:ring-1 hover:ring-primary/30"
            )}
            onClick={() => onSelectLocation(location.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors",
                    isSelected ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                  )}
                >
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground">{location.name}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{location.address}</p>
                </div>
                <div
                  className={cn(
                    "h-5 w-5 rounded-full border-2 transition-all",
                    isSelected
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/30"
                  )}
                >
                  {isSelected && (
                    <div className="h-full w-full flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                    </div>
                  )}
                </div>
              </div>
              {isSelected && location.instructions && (
                <div className="mt-4 p-3 rounded-lg bg-secondary/50 flex items-start gap-2">
                  <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">{location.instructions}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default LocationSelector;
