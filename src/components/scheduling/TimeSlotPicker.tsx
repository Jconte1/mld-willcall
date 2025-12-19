import React from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimeSlot } from '@/lib/types';

interface TimeSlotPickerProps {
  slots: TimeSlot[];
  selectedSlot: TimeSlot | null;
  onSelectSlot: (slot: TimeSlot) => void;
}

const TimeSlotPicker: React.FC<TimeSlotPickerProps> = ({
  slots,
  selectedSlot,
  onSelectSlot,
}) => {
  const availableSlots = slots.filter((slot) => slot.available);
  const unavailableSlots = slots.filter((slot) => !slot.available);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (slots.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground">No time slots available for this date.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>{availableSlots.length} available time slots</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {slots.map((slot) => {
          const isSelected = selectedSlot?.id === slot.id;
          const isAvailable = slot.available;

          return (
            <button
              key={slot.id}
              onClick={() => isAvailable && onSelectSlot(slot)}
              disabled={!isAvailable}
              className={cn(
                "relative flex flex-col items-center justify-center py-3 px-4 rounded-lg border transition-all duration-200",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground shadow-md"
                  : isAvailable
                  ? "border-border bg-card hover:border-primary/50 hover:shadow-md cursor-pointer"
                  : "border-border/50 bg-muted/30 text-muted-foreground/50 cursor-not-allowed"
              )}
            >
              <span className="text-sm font-medium">{formatTime(slot.startTime)}</span>
              {isAvailable && !isSelected && (
                <span className="text-xs text-muted-foreground mt-0.5">
                  {slot.capacityRemaining} {slot.capacityRemaining === 1 ? 'spot' : 'spots'}
                </span>
              )}
              {!isAvailable && (
                <span className="text-xs mt-0.5">Full</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TimeSlotPicker;
