export type AppointmentStatus = 
  | 'Scheduled'
  | 'Confirmed'
  | 'CheckedIn'
  | 'Ready'
  | 'Completed'
  | 'NoShow'
  | 'Canceled';

export interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  available: boolean;
  capacityRemaining: number;
}

export interface DayAvailability {
  date: string;
  slots: TimeSlot[];
  isBlackedOut: boolean;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  instructions: string;
}

export interface Appointment {
  id: string;
  pickupReference: string;
  locationId: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhone: string;
  vehicleInfo?: string;
  customerNotes?: string;
  staffNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PickupFormData {
  pickupReference: string;
  locationId: string;
  selectedDate: string;
  selectedSlot: TimeSlot | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  vehicleInfo: string;
  notes: string;
}
