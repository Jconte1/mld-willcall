import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, isBefore, startOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DayAvailability } from '@/lib/types';

interface CalendarPickerProps {
  availability: DayAvailability[];
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
}

const CalendarPicker: React.FC<CalendarPickerProps> = ({
  availability,
  selectedDate,
  onSelectDate,
  minDate = new Date(),
  maxDate,
}) => {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const startDayOfWeek = days[0].getDay();

  const availabilityMap = useMemo(() => {
    const map: Record<string, DayAvailability> = {};
    availability.forEach((day) => {
      map[day.date] = day;
    });
    return map;
  }, [availability]);

  const isDateAvailable = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayAvailability = availabilityMap[dateStr];
    if (!dayAvailability) return false;
    if (dayAvailability.isBlackedOut) return false;
    return dayAvailability.slots.some((slot) => slot.available);
  };

  const isDateDisabled = (date: Date) => {
    if (isBefore(date, startOfDay(minDate))) return true;
    if (maxDate && isBefore(maxDate, date)) return true;
    return !isDateAvailable(date);
  };

  const goToPreviousMonth = () => {
    setCurrentMonth((prev) => addMonths(prev, -1));
  };

  const goToNextMonth = () => {
    setCurrentMonth((prev) => addMonths(prev, 1));
  };

  const canGoPrevious = !isBefore(startOfMonth(currentMonth), startOfMonth(minDate));

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPreviousMonth}
          disabled={!canGoPrevious}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="font-display text-lg font-semibold text-foreground">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextMonth}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="h-10 flex items-center justify-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="h-10" />
        ))}
        {days.map((day) => {
          const disabled = isDateDisabled(day);
          const selected = selectedDate && isSameDay(day, selectedDate);
          const today = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => !disabled && onSelectDate(day)}
              disabled={disabled}
              className={cn(
                "h-10 w-full rounded-lg text-sm font-medium transition-all duration-200",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                disabled
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : "hover:bg-secondary cursor-pointer",
                selected
                  ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                  : today
                  ? "ring-1 ring-primary/50"
                  : "",
                !disabled && !selected && "text-foreground"
              )}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarPicker;
