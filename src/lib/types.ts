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

export interface AppointmentGroup {
  id: string;
  locationId: string;
  orderNbrs: string[];
  requiredSlots: number;
  selectedDate: string;
  selectedSlots: TimeSlot[];
}

export interface SelectedItem {
  lineId: string;
  inventoryId: string | null;
  description: string | null;
  warehouse: string | null;
  maxQty: number;
  qty: number;
}

export interface OrderItemSelection {
  orderNbr: string;
  items: SelectedItem[];
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
  appointmentGroups: AppointmentGroup[];
  selectedItems: OrderItemSelection[];
  orderReadyToken: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  smsOptIn: boolean;
  emailOptIn: boolean;
  vehicleInfo: string;
  notes: string;
}
