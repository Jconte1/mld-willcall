"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Calendar, Clock, MapPin, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { pickupLocations } from "@/lib/pickupLocations";
import { useToast } from "@/hooks/use-toast";

type AppointmentStatus =
  | "Scheduled"
  | "Confirmed"
  | "InProgress"
  | "Ready"
  | "Completed"
  | "Cancelled"
  | "NoShow";

type StaffPickup = {
  id: string;
  pickupReference: string;
  locationId: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  customerFirstName: string;
  customerLastName: string | null;
  customerEmail: string;
  customerPhone: string | null;
  orders: { orderNbr: string }[];
};

export default function StaffPickupDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const [appointment, setAppointment] = useState<StaffPickup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [status, setStatus] = useState<AppointmentStatus>("Scheduled");
  const [startAt, setStartAt] = useState<string>("");
  const [endAt, setEndAt] = useState<string>("");
  const [orderNbrs, setOrderNbrs] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/staff/pickups/${params.id}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setError(data?.message ?? "Pickup not found");
          return;
        }
        const pickup = data.pickup ?? data;
        setAppointment(pickup);
        setStatus(pickup.status);
        setStartAt(pickup.startAt);
        setEndAt(pickup.endAt);
        setOrderNbrs((pickup.orders ?? []).map((o: { orderNbr: string }) => o.orderNbr).join(", "));
      })
      .catch(() => setError("Pickup not found"))
      .finally(() => setLoading(false));
  }, [params.id]);

  const location = useMemo(
    () => pickupLocations.find((l) => l.id === appointment?.locationId),
    [appointment?.locationId]
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading pickup...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (!appointment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{error || "Pickup not found"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => router.push("/staff/pickups")}>
            Go back
          </Button>
        </CardContent>
      </Card>
    );
  }

  const handleSave = async () => {
    const res = await fetch(`/api/staff/pickups/${appointment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        startAt,
        endAt,
        orderNbrs: orderNbrs
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    });

    if (!res.ok) {
      toast({ title: "Update failed", description: "Unable to update pickup." });
      return;
    }

    toast({ title: "Updated", description: "Pickup updated successfully." });
  };

  const startDateLabel = appointment.startAt ? format(parseISO(appointment.startAt), "EEEE, MMMM d, yyyy") : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" onClick={() => router.push("/staff/pickups")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to pickups
        </Button>

        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Save changes
        </Button>
      </div>

      <Card className="shadow-xl">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center justify-between gap-4">
            <span>Pickup #{appointment.id.slice(-8).toUpperCase()}</span>
            <span className="text-sm font-normal text-muted-foreground">{startDateLabel}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium">{startDateLabel}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Time</p>
                <p className="font-medium">
                  {appointment.startAt ? format(parseISO(appointment.startAt), "h:mm a") : ""} -{" "}
                  {appointment.endAt ? format(parseISO(appointment.endAt), "h:mm a") : ""}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="font-medium">{location?.name ?? appointment.locationId}</p>
              </div>
            </div>
          </div>

          <div className="border-t pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as AppointmentStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                  <SelectItem value="Confirmed">Confirmed</SelectItem>
                  <SelectItem value="InProgress">In Progress</SelectItem>
                  <SelectItem value="Ready">Ready</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="NoShow">No Show</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Pickup Reference</Label>
              <Input value={appointment.pickupReference} disabled />
            </div>

            <div className="space-y-2">
              <Label>Start (ISO)</Label>
              <Input value={startAt} onChange={(e) => setStartAt(e.target.value)} placeholder="YYYY-MM-DDTHH:mm:ssZ" />
            </div>

            <div className="space-y-2">
              <Label>End (ISO)</Label>
              <Input value={endAt} onChange={(e) => setEndAt(e.target.value)} placeholder="YYYY-MM-DDTHH:mm:ssZ" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Order Numbers</Label>
              <Input
                value={orderNbrs}
                onChange={(e) => setOrderNbrs(e.target.value)}
                placeholder="C12345, C67890"
              />
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="font-semibold mb-2">Customer</h3>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>
                {appointment.customerFirstName} {appointment.customerLastName}
              </div>
              <div>{appointment.customerEmail}</div>
              <div>{appointment.customerPhone}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
