import React, { useState, useMemo } from 'react';
import { format, parseISO, isToday, isBefore, addMinutes } from 'date-fns';
import { Search, Clock, User, Phone, Mail, Car, FileText, ChevronRight, Calendar, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/layout/Header';
import { usePickup } from '@/context/PickupContext';
import { Appointment, AppointmentStatus } from '@/lib/types';
import { mockLocations } from '@/lib/mockData';
import { cn } from '@/lib/utils';

const statusConfig: Record<AppointmentStatus, { variant: any; label: string; icon: React.ReactNode }> = {
  Scheduled: { variant: 'scheduled', label: 'Scheduled', icon: <Clock className="h-3 w-3" /> },
  Confirmed: { variant: 'confirmed', label: 'Confirmed', icon: <CheckCircle className="h-3 w-3" /> },
  CheckedIn: { variant: 'checkedIn', label: 'Checked In', icon: <User className="h-3 w-3" /> },
  Ready: { variant: 'ready', label: 'Ready', icon: <AlertCircle className="h-3 w-3" /> },
  Completed: { variant: 'completed', label: 'Completed', icon: <CheckCircle className="h-3 w-3" /> },
  NoShow: { variant: 'noShow', label: 'No Show', icon: <XCircle className="h-3 w-3" /> },
  Canceled: { variant: 'canceled', label: 'Canceled', icon: <XCircle className="h-3 w-3" /> },
};

const StaffDashboard: React.FC = () => {
  const { appointments, updateAppointmentStatus } = usePickup();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'all'>('all');

  const todaysAppointments = useMemo(() => {
    return appointments
      .filter((apt) => {
        const aptDate = parseISO(apt.startAt);
        return isToday(aptDate);
      })
      .filter((apt) => {
        if (statusFilter !== 'all' && apt.status !== statusFilter) return false;
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
          apt.pickupReference.toLowerCase().includes(query) ||
          apt.customerFirstName.toLowerCase().includes(query) ||
          apt.customerLastName.toLowerCase().includes(query) ||
          apt.customerPhone.includes(query) ||
          apt.customerEmail.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => parseISO(a.startAt).getTime() - parseISO(b.startAt).getTime());
  }, [appointments, searchQuery, statusFilter]);

  const formatTime = (dateStr: string) => {
    const date = parseISO(dateStr);
    return format(date, 'h:mm a');
  };

  const getTimeStatus = (startAt: string) => {
    const now = new Date();
    const appointmentTime = parseISO(startAt);
    
    if (isBefore(appointmentTime, now)) {
      return 'past';
    }
    
    if (isBefore(appointmentTime, addMinutes(now, 30))) {
      return 'upcoming';
    }
    
    return 'future';
  };

  const location = mockLocations[0];

  const handleStatusChange = (appointmentId: string, newStatus: AppointmentStatus) => {
    updateAppointmentStatus(appointmentId, newStatus);
    if (selectedAppointment?.id === appointmentId) {
      setSelectedAppointment((prev) => prev ? { ...prev, status: newStatus } : null);
    }
  };

  const statusActions: Record<AppointmentStatus, AppointmentStatus[]> = {
    Scheduled: ['Confirmed', 'CheckedIn', 'Canceled'],
    Confirmed: ['CheckedIn', 'Canceled'],
    CheckedIn: ['Ready', 'Completed', 'NoShow'],
    Ready: ['Completed', 'NoShow'],
    Completed: [],
    NoShow: [],
    Canceled: [],
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Queue List */}
          <div className="flex-1">
            <div className="mb-6">
              <h1 className="font-display text-2xl font-bold text-foreground mb-1">Today's Queue</h1>
              <p className="text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {format(new Date(), 'EEEE, MMMM d, yyyy')}
                <span className="mx-2">•</span>
                <span className="font-medium">{location.name}</span>
              </p>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, phone, email, or pickup #"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as AppointmentStatus | 'all')}
                className="h-11 px-3 rounded-lg border border-input bg-card text-sm"
              >
                <option value="all">All Statuses</option>
                {Object.keys(statusConfig).map((status) => (
                  <option key={status} value={status}>
                    {statusConfig[status as AppointmentStatus].label}
                  </option>
                ))}
              </select>
            </div>

            {/* Appointments List */}
            <div className="space-y-2">
              {todaysAppointments.length === 0 ? (
                <Card className="p-8 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No appointments found</p>
                </Card>
              ) : (
                todaysAppointments.map((apt) => {
                  const timeStatus = getTimeStatus(apt.startAt);
                  const config = statusConfig[apt.status];
                  
                  return (
                    <Card
                      key={apt.id}
                      className={cn(
                        "cursor-pointer transition-all hover:shadow-lg",
                        selectedAppointment?.id === apt.id && "ring-2 ring-primary",
                        timeStatus === 'upcoming' && apt.status !== 'CheckedIn' && apt.status !== 'Completed' && "border-l-4 border-l-accent"
                      )}
                      onClick={() => setSelectedAppointment(apt)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "text-center min-w-[60px]",
                              timeStatus === 'past' && "text-muted-foreground"
                            )}>
                              <p className="text-lg font-semibold">{formatTime(apt.startAt)}</p>
                            </div>
                            <div>
                              <p className="font-medium text-foreground">
                                {apt.customerFirstName} {apt.customerLastName}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {apt.pickupReference}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant={config.variant} className="flex items-center gap-1">
                              {config.icon}
                              {config.label}
                            </Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>

          {/* Detail Panel */}
          {selectedAppointment && (
            <Card className="lg:w-96 lg:sticky lg:top-24 h-fit animate-slide-up">
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Appointment Details</CardTitle>
                  <Badge variant={statusConfig[selectedAppointment.status].variant}>
                    {statusConfig[selectedAppointment.status].label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Time & Reference */}
                <div className="p-3 rounded-lg bg-primary/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{formatTime(selectedAppointment.startAt)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Pickup #{selectedAppointment.pickupReference}
                  </p>
                </div>

                {/* Customer Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedAppointment.customerFirstName} {selectedAppointment.customerLastName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedAppointment.customerPhone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedAppointment.customerEmail}</span>
                  </div>
                  {selectedAppointment.vehicleInfo && (
                    <div className="flex items-center gap-2 text-sm">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedAppointment.vehicleInfo}</span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {selectedAppointment.customerNotes && (
                  <div className="p-3 rounded-lg bg-secondary/50">
                    <div className="flex items-start gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span className="text-muted-foreground">{selectedAppointment.customerNotes}</span>
                    </div>
                  </div>
                )}

                {/* Status Actions */}
                {statusActions[selectedAppointment.status].length > 0 && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium text-foreground mb-3">Update Status</p>
                    <div className="flex flex-wrap gap-2">
                      {statusActions[selectedAppointment.status].map((status) => {
                        const config = statusConfig[status];
                        const isDestructive = status === 'Canceled' || status === 'NoShow';
                        
                        return (
                          <Button
                            key={status}
                            variant={isDestructive ? 'outline' : 'secondary'}
                            size="sm"
                            className={cn(
                              isDestructive && "text-destructive border-destructive/50 hover:bg-destructive/10"
                            )}
                            onClick={() => handleStatusChange(selectedAppointment.id, status)}
                          >
                            {config.icon}
                            <span className="ml-1">{config.label}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default StaffDashboard;
