"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  CalendarDays,
  MapPin,
  Mail,
  Phone,
  ClipboardList,
  User,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import FullPageSyncLoader from "@/components/system/FullPageSyncLoader";
import { usePickup } from "@/context/PickupContext";
import { pickupLocations } from "@/lib/pickupLocations";
import { useToast } from "@/hooks/use-toast";

type OrderReadyResponse = {
  orderReady: {
    orderNbr: string;
    status: string | null;
    orderType: string | null;
    shipVia: string | null;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    locationId: string | null;
    smsOptIn: boolean;
  };
  appointment?: {
    id: string;
    status: string;
    startAt: string;
    endAt: string;
    locationId: string;
    orders: { orderNbr: string }[];
  } | null;
  orderLines?: {
    inventoryId: string | null;
    lineDescription: string | null;
    openQty: number | null;
    orderQty: number | null;
  }[];
};

function ReadyContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { updateFormData } = usePickup();

  const orderNbr = String(params.orderNbr || "");
  const token = searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<OrderReadyResponse | null>(null);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [visibleItemCount, setVisibleItemCount] = useState(10);

  useEffect(() => {
    if (!loading) return;
    setSyncProgress(0);
    const interval = window.setInterval(() => {
      setSyncProgress((prev) => {
        if (prev >= 92) return prev;
        const bump = 3 + Math.random() * 6;
        return Math.min(92, prev + bump);
      });
    }, 600);

    return () => window.clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    fetch(`/api/public/order-ready/${orderNbr}?token=${encodeURIComponent(token)}`)
      .then((res) => res.json().then((payload) => ({ ok: res.ok, payload })))
      .then(({ ok, payload }) => {
        if (!active) return;
        if (!ok) {
          setError(payload?.message ?? "Unable to load order.");
          return;
        }
        setData(payload as OrderReadyResponse);
        setSmsOptIn(Boolean(payload?.orderReady?.smsOptIn));
      })
      .catch(() => {
        if (active) setError("Unable to load order.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [orderNbr, token]);

  const location = useMemo(() => {
    const locationId = data?.appointment?.locationId || data?.orderReady?.locationId;
    return pickupLocations.find((loc) => loc.id === locationId);
  }, [data]);

  const appointment = data?.appointment ?? null;
  const orderLines = data?.orderLines ?? [];
  const visibleOrderLines = useMemo(
    () => orderLines.slice(0, visibleItemCount),
    [orderLines, visibleItemCount]
  );
  const remainingOrderLines = Math.max(orderLines.length - visibleItemCount, 0);

  const scheduleDisabled = Boolean(appointment);

  const scheduleNow = () => {
    if (!data?.orderReady) return;
    const contactName = data.orderReady.contactName || "";
    const [firstName, ...rest] = contactName.split(" ").filter(Boolean);
    const lastName = rest.join(" ");

    updateFormData({
      pickupReference: data.orderReady.orderNbr,
      appointmentGroups: [
        {
          id: `group-${data.orderReady.orderNbr}`,
          locationId: data.orderReady.locationId || "slc-hq",
          orderNbrs: [data.orderReady.orderNbr],
          requiredSlots: 1,
          selectedDate: "",
          selectedSlots: [],
        },
      ],
      selectedItems: [],
      orderReadyToken: token,
      firstName,
      lastName,
      email: data.orderReady.contactEmail || "",
      phone: data.orderReady.contactPhone || "",
      smsOptIn,
    });

    router.push("/items");
  };

  if (loading) {
    return (
      <FullPageSyncLoader
        progress={syncProgress}
        title="Loading order details"
        helperText="Please keep this window open while we load your order."
      />
    );
  }

  if (error || !data?.orderReady) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-10 text-center text-destructive">
          {error || "Order not found."}
        </main>
      </div>
    );
  }

  const appointmentLabel = appointment
    ? format(parseISO(appointment.startAt), "EEEE, MMMM d, yyyy")
    : "Ready for pickup";
  const timeLabel = appointment
    ? `${format(parseISO(appointment.startAt), "h:mm a")} - ${format(
        parseISO(appointment.endAt),
        "h:mm a"
      )}`
    : "Schedule a pickup time";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle>Order Ready for Pickup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="rounded-lg border border-border/60 bg-secondary/30 border-dashed p-4 space-y-3">
                <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                  <div className="flex flex-wrap gap-4 items-start text-sm">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-semibold text-foreground">
                          {location?.name ?? data.orderReady.locationId ?? "Pickup location"}
                        </p>
                        <p className="text-xs text-muted-foreground">{location?.address ?? ""}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-muted-foreground">Date</p>
                        <p className="font-medium">{appointmentLabel}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Time</p>
                      <p className="font-medium">{timeLabel}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Order</p>
                      <p className="font-medium">{data.orderReady.orderNbr}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border/60 bg-white p-4 space-y-2">
                <div className="flex items-center gap-2 text-foreground">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">Contact Information</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{data.orderReady.contactName || "Customer"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{data.orderReady.contactEmail || "Email not available"}</span>
                  </div>
                  {data.orderReady.contactPhone ? (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{data.orderReady.contactPhone}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {!scheduleDisabled ? (
                <div className="rounded-lg border border-border bg-white p-3 text-sm space-y-3">
                  <label className="flex items-start gap-3">
                    <Checkbox
                      checked={smsOptIn}
                      onCheckedChange={(checked) => setSmsOptIn(Boolean(checked))}
                      className="mt-0.5"
                    />
                    <span className="text-muted-foreground">
                      Text appointment updates (optional)
                    </span>
                  </label>
                </div>
              ) : null}

              <div className="rounded-lg border border-border/60 bg-white p-4 space-y-4">
                <div className="flex items-center gap-2 text-foreground">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">Items on Order</span>
                </div>
                <div className="flex flex-wrap justify-start">
                  <Button
                    variant="hero"
                    disabled={scheduleDisabled}
                    onClick={() => {
                      if (scheduleDisabled) {
                        toast({ title: "Already scheduled" });
                        return;
                      }
                      scheduleNow();
                    }}
                  >
                    Schedule now
                  </Button>
                </div>
                {orderLines.length ? (
                  <div className="space-y-2">
                    {visibleOrderLines.map((item, index) => (
                      <div
                        key={`${item.inventoryId ?? "item"}-${index}`}
                        className="flex items-center justify-between rounded-lg border border-border/60 bg-white px-3 py-2 text-sm"
                      >
                        <div>
                          <div className="font-semibold text-foreground">
                            {item.inventoryId ?? "Item"}
                          </div>
                          {item.lineDescription ? (
                            <div className="text-xs text-muted-foreground">
                              {item.lineDescription}
                            </div>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Qty:{" "}
                          <span className="font-semibold text-foreground">
                            {item.openQty ?? item.orderQty ?? "--"}
                          </span>
                        </div>
                      </div>
                    ))}
                    {remainingOrderLines > 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full bg-white hover:bg-white"
                        onClick={() => setVisibleItemCount((prev) => prev + 10)}
                      >
                        Show more items (+{remainingOrderLines})
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No items available.</div>
                )}
              </div>

              {appointment ? (
                <div className="text-sm font-medium text-muted-foreground">
                  This order already has a pickup appointment scheduled.
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  variant="hero"
                  disabled={scheduleDisabled}
                  onClick={() => {
                    if (scheduleDisabled) {
                      toast({ title: "Already scheduled" });
                      return;
                    }
                    scheduleNow();
                  }}
                >
                  Schedule now
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default function OrderReadyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ReadyContent />
    </Suspense>
  );
}
