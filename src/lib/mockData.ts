import { Appointment, Location, DayAvailability, TimeSlot } from './types';
import { addDays, format, setHours, setMinutes, startOfDay } from 'date-fns';

export const mockLocations: Location[] = [
  {
    id: 'loc-1',
    name: 'Main Warehouse',
    address: '1234 Industrial Blvd, Denver, CO 80216',
    instructions: 'Enter through Gate B. Bring photo ID and your pickup number. Our team will assist you with loading.',
  },
  {
    id: 'loc-2',
    name: 'Downtown Showroom',
    address: '567 Market St, Denver, CO 80202',
    instructions: 'Street parking available. Check in at the front desk upon arrival.',
  },
];

export const generateTimeSlots = (date: Date): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  const dayOfWeek = date.getDay();
  
  // Closed on Sundays
  if (dayOfWeek === 0) return [];
  
  // Saturday: 9am - 2pm
  const startHour = 9;
  const endHour = dayOfWeek === 6 ? 14 : 17;
  
  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const slotStart = setMinutes(setHours(date, hour), minute);
      const slotEnd = setMinutes(setHours(date, minute === 30 ? hour + 1 : hour), minute === 30 ? 0 : 30);
      
      // Random availability for demo
      const capacityRemaining = Math.floor(Math.random() * 5);
      
      slots.push({
        id: `slot-${format(slotStart, 'HHmm')}`,
        startTime: format(slotStart, 'HH:mm'),
        endTime: format(slotEnd, 'HH:mm'),
        available: capacityRemaining > 0,
        capacityRemaining,
      });
    }
  }
  
  return slots;
};

export const generateAvailability = (startDate: Date, days: number): DayAvailability[] => {
  const availability: DayAvailability[] = [];
  
  for (let i = 0; i < days; i++) {
    const date = addDays(startDate, i);
    const dateStr = format(date, 'yyyy-MM-dd');
    
    availability.push({
      date: dateStr,
      slots: generateTimeSlots(date),
      isBlackedOut: false,
    });
  }
  
  return availability;
};

export const mockAppointments: Appointment[] = [
  {
    id: 'apt-001',
    pickupReference: 'PU-2024-001',
    locationId: 'loc-1',
    startAt: format(setHours(setMinutes(new Date(), 0), 10), "yyyy-MM-dd'T'HH:mm:ss"),
    endAt: format(setHours(setMinutes(new Date(), 30), 10), "yyyy-MM-dd'T'HH:mm:ss"),
    status: 'Scheduled',
    customerFirstName: 'John',
    customerLastName: 'Smith',
    customerEmail: 'john.smith@email.com',
    customerPhone: '(303) 555-0123',
    vehicleInfo: 'Blue Ford F-150',
    customerNotes: 'Large furniture items',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'apt-002',
    pickupReference: 'PU-2024-002',
    locationId: 'loc-1',
    startAt: format(setHours(setMinutes(new Date(), 0), 11), "yyyy-MM-dd'T'HH:mm:ss"),
    endAt: format(setHours(setMinutes(new Date(), 30), 11), "yyyy-MM-dd'T'HH:mm:ss"),
    status: 'CheckedIn',
    customerFirstName: 'Sarah',
    customerLastName: 'Johnson',
    customerEmail: 'sarah.j@email.com',
    customerPhone: '(303) 555-0456',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'apt-003',
    pickupReference: 'PU-2024-003',
    locationId: 'loc-1',
    startAt: format(setHours(setMinutes(new Date(), 30), 11), "yyyy-MM-dd'T'HH:mm:ss"),
    endAt: format(setHours(setMinutes(new Date(), 0), 12), "yyyy-MM-dd'T'HH:mm:ss"),
    status: 'Confirmed',
    customerFirstName: 'Michael',
    customerLastName: 'Davis',
    customerEmail: 'mdavis@email.com',
    customerPhone: '(303) 555-0789',
    vehicleInfo: 'White Chevy Silverado',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'apt-004',
    pickupReference: 'PU-2024-004',
    locationId: 'loc-1',
    startAt: format(setHours(setMinutes(new Date(), 0), 14), "yyyy-MM-dd'T'HH:mm:ss"),
    endAt: format(setHours(setMinutes(new Date(), 30), 14), "yyyy-MM-dd'T'HH:mm:ss"),
    status: 'Scheduled',
    customerFirstName: 'Emily',
    customerLastName: 'Wilson',
    customerEmail: 'emily.w@email.com',
    customerPhone: '(303) 555-0321',
    customerNotes: 'Will need forklift assistance',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
