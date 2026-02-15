import React from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimeSlot } from '@/lib/types';

interface TimeSlotPickerProps {
  slots: TimeSlot[];
  selectedSlots: TimeSlot[];
  maxSelections?: number;
  onSelectSlots: (slots: TimeSlot[]) => void;
}

const TimeSlotPicker: React.FC<TimeSlotPickerProps> = ({
  slots,
  selectedSlots,
  maxSelections = 1,
  onSelectSlots,
}) => {
  const maxAllowed = Math.max(1, maxSelections);

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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {slots.map((slot) => {
          const isSelected = selectedSlots.some((selected) => selected.id === slot.id);
          const isAvailable = slot.available;

          const handleSelect = () => {
            if (!isAvailable) return;
            if (isSelected) {
              onSelectSlots(selectedSlots.filter((selected) => selected.id !== slot.id));
              return;
            }
            if (maxAllowed === 1) {
              onSelectSlots([slot]);
              return;
            }
            if (selectedSlots.length >= maxAllowed) {
              return;
            }
            const next = [...selectedSlots, slot].sort((a, b) =>
              a.startTime.localeCompare(b.startTime)
            );
            onSelectSlots(next);
          };

          return (
            <button
              key={slot.id}
              onClick={handleSelect}
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
              {!isAvailable && (
                <span className="text-xs mt-0.5">Unavailable</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TimeSlotPicker;
