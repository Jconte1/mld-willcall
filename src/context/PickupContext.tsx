import React, { createContext, useContext, useState, ReactNode } from 'react';
import { PickupFormData, Appointment } from '@/lib/types';

interface PickupContextType {
  formData: PickupFormData;
  updateFormData: (data: Partial<PickupFormData>) => void;
  resetFormData: () => void;
  appointments: Appointment[];
  addAppointment: (appointment: Appointment) => void;
  updateAppointmentStatus: (id: string, status: Appointment['status']) => void;
  updateAppointment: (id: string, patch: Partial<Appointment>) => void;
}

const initialFormData: PickupFormData = {
  pickupReference: '',
  appointmentGroups: [],
  selectedItems: [],
  orderReadyToken: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  smsOptIn: false,
  emailOptIn: false,
  vehicleInfo: '',
  notes: '',
};

const PickupContext = createContext<PickupContextType | undefined>(undefined);

export const PickupProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [formData, setFormData] = useState<PickupFormData>(initialFormData);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const updateFormData = (data: Partial<PickupFormData>) => {
    setFormData(prev => ({ ...prev, ...data }));
  };

  const resetFormData = () => {
    setFormData(initialFormData);
  };

  const addAppointment = (appointment: Appointment) => {
    setAppointments(prev => [...prev, appointment]);
  };

  const updateAppointmentStatus = (id: string, status: Appointment['status']) => {
    setAppointments(prev =>
      prev.map(apt =>
        apt.id === id ? { ...apt, status, updatedAt: new Date().toISOString() } : apt
      )
    );
  };

  const updateAppointment = (id: string, patch: Partial<Appointment>) => {
    setAppointments(prev =>
      prev.map(apt =>
        apt.id === id ? { ...apt, ...patch, updatedAt: new Date().toISOString() } : apt
      )
    );
  };

  return (
    <PickupContext.Provider
      value={{
        formData,
        updateFormData,
        resetFormData,
        appointments,
        addAppointment,
        updateAppointmentStatus,
        updateAppointment,
      }}
    >
      {children}
    </PickupContext.Provider>
  );
};

export const usePickup = () => {
  const context = useContext(PickupContext);
  if (context === undefined) {
    throw new Error('usePickup must be used within a PickupProvider');
  }
  return context;
};
