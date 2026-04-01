"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { addDays, endOfWeek, format, isSameDay, parse, parseISO, startOfWeek } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { pickupLocations } from "@/lib/pickupLocations";
import { cn } from "@/lib/utils";

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
  vehicleInfo: string | null;
  customerNotes: string | null;
  orders: { orderNbr: string }[];
  shipments?: { orderNbr: string; shipmentNbr: string }[];
};

type StaffOrderLine = {
  id: string;
  orderNbr: string;
  inventoryId: string | null;
  lineDescription: string | null;
  openQty: number | null;
  orderQty: number | null;
  warehouse: string | null;
  allocatedQty?: number | null;
  isAllocated?: boolean;
  lineAmount?: number | null;
  taxRate?: number | null;
};

type StaffOrderPayment = {
  orderTotal: number;
  unpaidBalance: number;
  terms: string | null;
  status: string | null;
};

type StaffCreateOrder = {
  orderNbr: string;
  baid: string;
  status: string;
  shipVia: string | null;
  payment: StaffOrderPayment;
  salesPerson: {
    number: string | null;
    name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
};

type StaffAppointmentLine = {
  id: string;
  orderNbr: string;
  inventoryId: string;
  lineId: string | null;
  qtySelected: number;
  lineDescription: string | null;
};

type StaffShipment = {
  id?: string;
  orderNbr: string;
  shipmentNbr: string;
};

type StaffSelectedItem = {
  lineId?: string;
  inventoryId: string;
  description?: string | null;
  maxQty?: number;
  qty: number;
};

type StaffOrderSelection = {
  orderNbr: string;
  items: StaffSelectedItem[];
};

type LayoutItem = StaffPickup & {
  column: number;
  columnCount: number;
  top: number;
  height: number;
};

const START_HOUR = 7;
const END_HOUR = 17;
const SLOT_MINUTES = 15;
const SLOT_HEIGHT_WEEK = 64;
const SLOT_HEIGHT_DAY = 72;
const SHIPMENT_FORMAT = /^SMT\d{7}$/;
const PREPAY_TERMS = new Set(["PP", "PPP", "PPT", "TRADE", "CONTRACT"]);
const DESTRUCTIVE_BUTTON = "bg-red-500 text-white hover:bg-red-600 hover:-translate-y-[1px] transition-transform";
const ACTIVE_BLOCKING_STATUSES: AppointmentStatus[] = ["Scheduled", "Confirmed", "InProgress", "Ready"];

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  Scheduled: "bg-primary/10 text-primary",
  Confirmed: "bg-emerald-100 text-emerald-800",
  InProgress: "bg-amber-100 text-amber-700",
  Ready: "bg-indigo-100 text-indigo-700",
  Completed: "bg-success/10 text-success",
  Cancelled: "bg-destructive/10 text-destructive",
  NoShow: "bg-muted text-muted-foreground",
};
const STATUS_OPTIONS: AppointmentStatus[] = [
  "Scheduled",
  "Confirmed",
  "InProgress",
  "Ready",
  "Completed",
  "NoShow",
  "Cancelled",
];

function toMinutes(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function minutesToLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const display = hours % 12 || 12;
  return `${display}:${String(mins).padStart(2, "0")} ${suffix}`;
}

function toIsoLocal(date: Date) {
  return date.toISOString();
}

function toIsoLocalFromDateAndTime(dateStr: string, timeStr: string) {
  const parsed = parse(`${dateStr} ${timeStr}`, "MM/dd/yyyy h:mm a", new Date());
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
}

function addMinutesToTimeLabel(timeStr: string, minutes: number) {
  const parsed = parse(timeStr, "h:mm a", new Date());
  if (Number.isNaN(parsed.getTime())) return "";
  return format(new Date(parsed.getTime() + minutes * 60_000), "h:mm a");
}

function layoutAppointments(dayAppointments: StaffPickup[], slotHeight: number) {
  const sorted = [...dayAppointments].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const groups: StaffPickup[][] = [];
  let current: StaffPickup[] = [];
  let groupEnd = -Infinity;

  for (const apt of sorted) {
    const start = new Date(apt.startAt).getTime();
    const end = new Date(apt.endAt).getTime();
    if (!current.length || start < groupEnd) {
      current.push(apt);
      groupEnd = Math.max(groupEnd, end);
    } else {
      groups.push(current);
      current = [apt];
      groupEnd = end;
    }
  }
  if (current.length) groups.push(current);

  const positioned: LayoutItem[] = [];

  for (const group of groups) {
    const columns: number[] = [];
    const assignments = new Map<string, number>();

    for (const apt of group) {
      const start = new Date(apt.startAt).getTime();
      let assigned = -1;
      for (let i = 0; i < columns.length; i += 1) {
        if (start >= columns[i]) {
          assigned = i;
          break;
        }
      }
      if (assigned === -1) {
        assigned = columns.length;
        columns.push(0);
      }
      assignments.set(apt.id, assigned);
      columns[assigned] = new Date(apt.endAt).getTime();
    }

    const columnCount = columns.length;
    for (const apt of group) {
      const start = new Date(apt.startAt);
      const end = new Date(apt.endAt);
      const startMinutes = Math.max(toMinutes(start), START_HOUR * 60);
      const endMinutes = Math.min(toMinutes(end), END_HOUR * 60);
      const duration = Math.max(endMinutes - startMinutes, SLOT_MINUTES);
      positioned.push({
        ...apt,
        column: assignments.get(apt.id) ?? 0,
        columnCount,
        top: ((startMinutes - START_HOUR * 60) / SLOT_MINUTES) * slotHeight,
        height: (duration / SLOT_MINUTES) * slotHeight,
      });
    }
  }

  return positioned;
}

export default function StaffPickupsPage() {
  const { data: session } = useSession();
  const [shouldOpenNew, setShouldOpenNew] = useState(false);
  const isSalesperson = session?.user?.role === "SALESPERSON";
  const isViewer = session?.user?.role === "VIEWER";
  const isAdmin = session?.user?.role === "ADMIN";
  const canEditAppointments = session?.user?.role === "ADMIN" || session?.user?.role === "STAFF";
  const canUsePrepayOverride = canEditAppointments;
  const canCreate =
    session?.user?.role === "ADMIN" ||
    session?.user?.role === "STAFF" ||
    session?.user?.role === "SALESPERSON";
  const [view, setView] = useState<"day" | "week">("week");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState<StaffPickup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<AppointmentStatus[]>(() =>
    STATUS_OPTIONS.filter((status) => status !== "Cancelled")
  );
  const [activeAppointment, setActiveAppointment] = useState<StaffPickup | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [notifyCustomer, setNotifyCustomer] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState("");
  const [orderLinesByOrder, setOrderLinesByOrder] = useState<Record<string, StaffOrderLine[]>>({});
  const [selectedItems, setSelectedItems] = useState<StaffOrderSelection[]>([]);
  const [shipmentDrafts, setShipmentDrafts] = useState<Record<string, string[]>>({});
  const [shipmentOriginals, setShipmentOriginals] = useState<Record<string, string[]>>({});
  const [shipmentEditing, setShipmentEditing] = useState(false);
  const [shipmentSaving, setShipmentSaving] = useState(false);
  const [shipmentError, setShipmentError] = useState("");
  const [itemsNotifyOpen, setItemsNotifyOpen] = useState(false);
  const [notifyItemsCustomer, setNotifyItemsCustomer] = useState(true);
  const [pendingItemsSave, setPendingItemsSave] = useState<StaffOrderSelection[] | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<{
    id: string;
    body: Record<string, any>;
    orderNbrs: string[];
    status: AppointmentStatus;
  } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createOrderInput, setCreateOrderInput] = useState("");
  const [createOrderLoading, setCreateOrderLoading] = useState(false);
  const [createOrderError, setCreateOrderError] = useState("");
  const [createModalError, setCreateModalError] = useState("");
  const [createOrders, setCreateOrders] = useState<StaffCreateOrder[]>([]);
  const [createDayAppointments, setCreateDayAppointments] = useState<StaffPickup[]>([]);
  const [createOrderSearch, setCreateOrderSearch] = useState<Record<string, string>>({});
  const [prepayOverride, setPrepayOverride] = useState(false);
  const [returnAckOpen, setReturnAckOpen] = useState(false);
  const [returnAckChecked, setReturnAckChecked] = useState(false);
  const [pendingCreatePayload, setPendingCreatePayload] = useState<Record<string, unknown> | null>(null);
  const [formData, setFormData] = useState({
    locationId: "",
    customerEmail: "",
    customerFirstName: "",
    customerLastName: "",
    customerPhone: "",
    date: "",
    startTime: "",
    endTime: "",
    status: "Scheduled" as AppointmentStatus,
    orderNbrs: "",
  });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setView("day");
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const rangeStart = useMemo(() => {
    return view === "week" ? startOfWeek(selectedDate, { weekStartsOn: 1 }) : selectedDate;
  }, [selectedDate, view]);

  const rangeEnd = useMemo(() => {
    return view === "week" ? endOfWeek(selectedDate, { weekStartsOn: 1 }) : selectedDate;
  }, [selectedDate, view]);

  const slotHeight = view === "day" ? SLOT_HEIGHT_DAY : SLOT_HEIGHT_WEEK;

  const calendarHeight = useMemo(() => {
    return ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES * slotHeight;
  }, [slotHeight]);

  const timeLabelOffset = 0;

  const visibleDays = useMemo(() => {
    if (view === "day") return [selectedDate];
    return Array.from({ length: 7 }, (_, idx) => addDays(rangeStart, idx));
  }, [rangeStart, selectedDate, view]);

  const accessibleLocations = useMemo(() => {
    if (session?.user?.role === "ADMIN") {
      return pickupLocations.map((loc) => loc.id);
    }
    const locationAccess = session?.user?.locationAccess ?? [];
    if (!locationAccess.length) return [];
    return locationAccess;
  }, [session?.user?.locationAccess, session?.user?.role]);

  useEffect(() => {
    if (!selectedLocations.length && accessibleLocations.length) {
      setSelectedLocations(accessibleLocations);
    }
  }, [accessibleLocations, selectedLocations.length]);

  const locationSelectValue = useMemo(() => {
    if (accessibleLocations.length <= 1) return accessibleLocations[0] ?? "";
    if (selectedLocations.length === accessibleLocations.length) return "all";
    return selectedLocations[0] ?? "all";
  }, [accessibleLocations, selectedLocations]);

  const toggleStatus = (status: AppointmentStatus, nextValue: boolean) => {
    setSelectedStatuses((prev) => {
      if (nextValue) {
        return prev.includes(status) ? prev : [...prev, status];
      }
      return prev.filter((item) => item !== status);
    });
  };

  const fetchAppointments = async () => {
    if (!session?.user?.role) return;
    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      from: format(rangeStart, "yyyy-MM-dd"),
      to: format(rangeEnd, "yyyy-MM-dd"),
    });
    if (selectedLocations.length === 1) {
      params.set("locationId", selectedLocations[0]);
    }

    const res = await fetch(`/api/staff/pickups?${params.toString()}`);
    const data = await res.json().catch(() => ({}));
    console.info("[staff-pickups] fetch", {
      ok: res.ok,
      status: res.status,
      rangeStart: format(rangeStart, "yyyy-MM-dd"),
      rangeEnd: format(rangeEnd, "yyyy-MM-dd"),
      selectedLocations,
      received: Array.isArray(data?.pickups) ? data.pickups.length : 0,
    });
    if (!res.ok) {
      setError(data?.message ?? "Unable to load pickups.");
      setLoading(false);
      return;
    }

    const rows = Array.isArray(data?.pickups) ? data.pickups : [];
    setAppointments(rows);
    setLoading(false);
  };

  const loadAppointmentItems = async (appointmentId: string) => {
    setItemsLoading(true);
    setItemsError("");
    setOrderLinesByOrder({});
    setSelectedItems([]);
    setShipmentDrafts({});
    setShipmentOriginals({});
    setShipmentEditing(false);
    setShipmentError("");

    const res = await fetch(`/api/staff/pickups/${appointmentId}/items`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setItemsError(data?.message ?? "Unable to load appointment items.");
      setItemsLoading(false);
      return;
    }

    const lines: StaffAppointmentLine[] = Array.isArray(data?.lines) ? data.lines : [];
    const orderLines: StaffOrderLine[] = Array.isArray(data?.orderLines) ? data.orderLines : [];
    const orderLineMap = orderLines.reduce((map, line) => {
      const list = map.get(line.orderNbr) ?? [];
      list.push(line);
      map.set(line.orderNbr, list);
      return map;
    }, new Map<string, StaffOrderLine[]>());

    const selections = Array.from(
      lines.reduce((map, line) => {
        const items = map.get(line.orderNbr) ?? [];
        items.push({
          lineId: line.lineId ?? undefined,
          inventoryId: line.inventoryId,
          description: line.lineDescription ?? undefined,
          qty: Number(line.qtySelected),
        });
        map.set(line.orderNbr, items);
        return map;
      }, new Map<string, StaffSelectedItem[]>())
    ).map(([orderNbr, items]) => ({ orderNbr, items }));

    const shipments: StaffShipment[] = Array.isArray(data?.shipments) ? data.shipments : [];
    const groupedShipments = shipments.reduce((map, row) => {
      const list = map.get(row.orderNbr) ?? [];
      list.push(row.shipmentNbr);
      map.set(row.orderNbr, list);
      return map;
    }, new Map<string, string[]>());

    const shipmentObj = Object.fromEntries(
      Array.from(groupedShipments.entries()).map(([orderNbr, values]) => [
        orderNbr,
        values.filter(Boolean),
      ])
    );

    setOrderLinesByOrder(Object.fromEntries(orderLineMap));
    setSelectedItems(selections);
    setShipmentDrafts(shipmentObj);
    setShipmentOriginals(shipmentObj);
    setItemsLoading(false);
  };

  useEffect(() => {
    fetchAppointments();
  }, [rangeStart, rangeEnd, selectedLocations.join("|")]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const consumeNewFlag = () => {
      const flag = window.sessionStorage.getItem("staff_pickups_open_new");
      if (flag === "1") {
        window.sessionStorage.removeItem("staff_pickups_open_new");
        setShouldOpenNew(true);
      }
    };

    const onOpenNew = () => setShouldOpenNew(true);

    consumeNewFlag();
    window.addEventListener("staff:new-appointment", onOpenNew);
    return () => window.removeEventListener("staff:new-appointment", onOpenNew);
  }, []);

  useEffect(() => {
    if (!shouldOpenNew) return;
    if (!canCreate) {
      setShouldOpenNew(false);
      return;
    }
    handleOpenCreate();
    setShouldOpenNew(false);
  }, [shouldOpenNew, canCreate]);

  const filteredAppointments = useMemo(() => {
    let rows = appointments;
    const showAllLocations = isAdmin && selectedLocations.length === accessibleLocations.length;
    if (selectedLocations.length && !showAllLocations) {
      rows = rows.filter((apt) => selectedLocations.includes(apt.locationId));
    }
    if (selectedStatuses.length) {
      rows = rows.filter((apt) => selectedStatuses.includes(apt.status));
    } else {
      rows = [];
    }
    return rows;
  }, [appointments, selectedLocations, selectedStatuses]);

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, StaffPickup[]>();
    filteredAppointments.forEach((apt) => {
      const dateKey = format(parseISO(apt.startAt), "yyyy-MM-dd");
      const list = map.get(dateKey) ?? [];
      list.push(apt);
      map.set(dateKey, list);
    });
    return map;
  }, [filteredAppointments]);

  // In day view, allow empty days without snapping to the first appointment date.

  const timeLabels = useMemo(() => {
    const labels: { minutes: number; label: string }[] = [];
    for (let minutes = START_HOUR * 60; minutes <= END_HOUR * 60; minutes += 60) {
      labels.push({ minutes, label: minutesToLabel(minutes) });
    }
    return labels;
  }, []);

  const timeOptions = useMemo(() => {
    const options: string[] = [];
    for (let minutes = START_HOUR * 60; minutes <= END_HOUR * 60; minutes += SLOT_MINUTES) {
      options.push(minutesToLabel(minutes));
    }
    return options;
  }, []);

  const createStartTimeOptions = useMemo(() => {
    const options: string[] = [];
    for (let minutes = START_HOUR * 60; minutes <= END_HOUR * 60 - SLOT_MINUTES; minutes += SLOT_MINUTES) {
      options.push(minutesToLabel(minutes));
    }
    return options;
  }, []);

  useEffect(() => {
    if (!dialogOpen || !isCreating) return;
    if (!formData.locationId || !formData.date) return;
    const parsedDate = parse(formData.date, "MM/dd/yyyy", new Date());
    if (Number.isNaN(parsedDate.getTime())) return;
    const day = format(parsedDate, "yyyy-MM-dd");

    const load = async () => {
      const params = new URLSearchParams({
        from: day,
        to: day,
        locationId: formData.locationId,
      });
      const res = await fetch(`/api/staff/pickups?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateDayAppointments([]);
        return;
      }
      const rows = Array.isArray(data?.pickups) ? (data.pickups as StaffPickup[]) : [];
      setCreateDayAppointments(rows);
    };

    void load();
  }, [dialogOpen, isCreating, formData.locationId, formData.date]);

  const availableCreateStartTimeOptions = useMemo(() => {
    if (!isCreating) return createStartTimeOptions;
    const parsedDate = parse(formData.date, "MM/dd/yyyy", new Date());
    if (Number.isNaN(parsedDate.getTime())) return createStartTimeOptions;
    const now = new Date();
    const salespersonMinStart = new Date(now.getTime() + 4 * 60 * 60_000);

    return createStartTimeOptions.filter((option) => {
      const startAt = parse(`${formData.date} ${option}`, "MM/dd/yyyy h:mm a", new Date());
      if (Number.isNaN(startAt.getTime())) return false;
      const endAt = new Date(startAt.getTime() + SLOT_MINUTES * 60_000);
      if (startAt <= now) return false;
      if (isSalesperson && startAt < salespersonMinStart) return false;

      const blocked = createDayAppointments.some((apt) => {
        if (!ACTIVE_BLOCKING_STATUSES.includes(apt.status)) return false;
        if (apt.locationId !== formData.locationId) return false;
        const aptStart = new Date(apt.startAt);
        const aptEnd = new Date(apt.endAt);
        return startAt < aptEnd && endAt > aptStart;
      });

      return !blocked;
    });
  }, [
    isCreating,
    createStartTimeOptions,
    formData.date,
    formData.locationId,
    createDayAppointments,
    isSalesperson,
  ]);

  useEffect(() => {
    if (!isCreating || !dialogOpen) return;
    if (!availableCreateStartTimeOptions.length) return;
    if (!availableCreateStartTimeOptions.includes(formData.startTime)) {
      const next = availableCreateStartTimeOptions[0] ?? "";
      setFormData((prev) => ({
        ...prev,
        startTime: next,
        endTime: addMinutesToTimeLabel(next, SLOT_MINUTES),
      }));
    }
  }, [availableCreateStartTimeOptions, formData.startTime, isCreating, dialogOpen]);

  const normalizeOrderNbrs = (value: string) =>
    value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const selectionsByOrder = useMemo(() => {
    const map = new Map<string, Map<string, StaffSelectedItem>>();
    selectedItems.forEach((selection) => {
      const itemMap = new Map<string, StaffSelectedItem>();
      selection.items.forEach((item) => {
        const key = item.lineId ?? item.inventoryId;
        itemMap.set(key, item);
      });
      map.set(selection.orderNbr, itemMap);
    });
    return map;
  }, [selectedItems]);

  const updateSelection = (orderNbr: string, updater: (items: StaffSelectedItem[]) => StaffSelectedItem[]) => {
    setSelectedItems((prev) => {
      const existing = prev.find((selection) => selection.orderNbr === orderNbr);
      const nextItems = updater(existing?.items ?? []);
      const next = prev.filter((selection) => selection.orderNbr !== orderNbr);
      if (nextItems.length) {
        next.push({ orderNbr, items: nextItems });
      }
      return next;
    });
  };

  const normalizeSelectionsForSave = (selections: StaffOrderSelection[]) =>
    selections
      .map((selection) => ({
        orderNbr: selection.orderNbr,
        items: selection.items.filter((item) => item.qty > 0 && item.inventoryId),
      }))
      .filter((selection) => selection.items.length > 0);

  const formatPhone = (value?: string | null) => {
    if (!value) return null;
    const digits = value.replace(/\D/g, "");
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return value;
  };

  const formatSalesPersonContact = (salesPerson?: StaffCreateOrder["salesPerson"] | null) => {
    if (!salesPerson) return "your salesperson";
    const label = salesPerson.name || salesPerson.number || "your salesperson";
    const contact: string[] = [];
    const phone = formatPhone(salesPerson.phone);
    if (phone) contact.push(phone);
    if (salesPerson.email) contact.push(salesPerson.email);
    if (!contact.length) return label;
    return `${label} at ${contact.join(" or ")}`;
  };

  const createPrepayBlocks = useMemo(() => {
    if (!isCreating) return [];
    return createOrders
      .map((order) => {
        if (String(order.orderNbr || "").trim().toUpperCase().startsWith("R1")) return null;
        const terms = (order.payment.terms ?? "").trim().toUpperCase();
        if (!PREPAY_TERMS.has(terms)) return null;
        const lines = orderLinesByOrder[order.orderNbr] ?? [];
        const selectedByLine = selectionsByOrder.get(order.orderNbr) ?? new Map();
        const unpaidBalance = Number(order.payment.unpaidBalance ?? 0) || 0;

        const remainingGoodsPreTax = lines.reduce((sum, line) => {
          const orderQty = Number(line.orderQty ?? 0) || 0;
          const lineAmount = Number(line.lineAmount ?? 0) || 0;
          if (orderQty <= 0) return sum;
          const selected = selectedByLine.get(line.id);
          const selectedQty = selected ? selected.qty : 0;
          const openQty = Math.max(0, Number(line.openQty ?? 0));
          const remainingQty = Math.max(0, openQty - selectedQty);
          if (remainingQty <= 0) return sum;
          const perUnitPreTax = lineAmount / orderQty;
          return sum + remainingQty * perUnitPreTax;
        }, 0);

        const retainRequired = remainingGoodsPreTax * 0.5;
        const amountOwed = Math.max(0, unpaidBalance - retainRequired);
        if (amountOwed <= 0) return null;
        return {
          orderNbr: order.orderNbr,
          amountOwed: Math.round(amountOwed * 100) / 100,
          salesPerson: order.salesPerson,
        };
      })
      .filter(Boolean) as Array<{
      orderNbr: string;
      amountOwed: number;
      salesPerson: StaffCreateOrder["salesPerson"] | null;
    }>;
  }, [createOrders, isCreating, orderLinesByOrder, selectionsByOrder]);

  const hasR1CreateOrder = useMemo(
    () => createOrders.some((order) => String(order.orderNbr || "").trim().toUpperCase().startsWith("R1")),
    [createOrders]
  );

  const submitCreateAppointment = async (createPayload: Record<string, unknown>) => {
    const res = await fetch("/api/staff/pickups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createPayload),
    });
    const data = await res.json().catch(() => ({}));
    console.info("[staff-create-appointment] create response", {
      status: res.status,
      ok: res.ok,
      message: data?.message,
      pickupId: data?.pickup?.id,
    });
    if (res.ok) {
      setDialogOpen(false);
      fetchAppointments();
    } else {
      setCreateModalError(data?.message ?? "Unable to create appointment.");
    }
  };

  const shipmentDirty = useMemo(() => {
    const keys = new Set([...Object.keys(shipmentDrafts), ...Object.keys(shipmentOriginals)]);
    for (const key of keys) {
      const left = (shipmentDrafts[key] ?? []).filter(Boolean);
      const right = (shipmentOriginals[key] ?? []).filter(Boolean);
      if (left.length !== right.length) return true;
      for (let i = 0; i < left.length; i += 1) {
        if (left[i] !== right[i]) return true;
      }
    }
    return false;
  }, [shipmentDrafts, shipmentOriginals]);

  const updateShipmentValue = (orderNbr: string, idx: number, value: string) => {
    setShipmentDrafts((prev) => {
      const next = [...(prev[orderNbr] ?? [])];
      next[idx] = value.toUpperCase();
      return { ...prev, [orderNbr]: next };
    });
  };

  const addShipment = (orderNbr: string) => {
    setShipmentDrafts((prev) => ({
      ...prev,
      [orderNbr]: [...(prev[orderNbr] ?? []), ""],
    }));
  };

  const removeShipment = (orderNbr: string, idx: number) => {
    setShipmentDrafts((prev) => {
      const next = [...(prev[orderNbr] ?? [])];
      next.splice(idx, 1);
      return { ...prev, [orderNbr]: next };
    });
  };

  const saveShipments = async () => {
    if (!activeAppointment) return;
    setShipmentSaving(true);
    setShipmentError("");

    const payload = {
      shipments: (activeAppointment.orders ?? []).map((order) => ({
        orderNbr: order.orderNbr,
        shipmentNbrs: (shipmentDrafts[order.orderNbr] ?? [])
          .map((value) => value.trim().toUpperCase())
          .filter(Boolean),
      })),
    };

    const res = await fetch(`/api/staff/pickups/${activeAppointment.id}/shipments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setShipmentError(data?.message ?? "Unable to save shipments.");
      setShipmentSaving(false);
      return;
    }

    const data = await res.json().catch(() => ({}));
    const updated: StaffPickup | null = data?.pickup ?? null;
    if (updated) {
      setAppointments((prev) => prev.map((apt) => (apt.id === updated.id ? updated : apt)));
    }
    setShipmentOriginals(shipmentDrafts);
    setShipmentEditing(false);
    setShipmentSaving(false);
  };

  const hasNotifiableChange = (appointment: StaffPickup, payload: Record<string, any>, orderNbrs: string[]) => {
    const timeChanged =
      payload.startAt &&
      payload.endAt &&
      (new Date(payload.startAt).getTime() !== new Date(appointment.startAt).getTime() ||
        new Date(payload.endAt).getTime() !== new Date(appointment.endAt).getTime());
    const locationChanged = payload.locationId && payload.locationId !== appointment.locationId;
    const statusChanged = payload.status && payload.status !== appointment.status;
    const existingOrders = appointment.orders.map((o) => o.orderNbr);
    const orderChanged =
      orderNbrs.length !== existingOrders.length ||
      orderNbrs.some((nbr) => !existingOrders.includes(nbr));
    return timeChanged || locationChanged || statusChanged || orderChanged;
  };

  const submitUpdate = async (
    appointmentId: string,
    body: Record<string, any>,
    notify: boolean,
    reason: string
  ) => {
    const res = await fetch(`/api/staff/pickups/${appointmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        notifyCustomer: notify,
        cancelReason: reason || undefined,
      }),
    });
    if (res.ok) {
      setDialogOpen(false);
      fetchAppointments();
    } else {
      setError("Unable to update appointment.");
    }
    return res.ok;
  };

  const handleOpenEdit = (appointment: StaffPickup) => {
    if (!canEditAppointments) return;
    setActiveAppointment(appointment);
    setIsCreating(false);
    setShipmentEditing(appointment.status !== "Ready");
    const startDate = parseISO(appointment.startAt);
    const endDate = parseISO(appointment.endAt);
    setFormData({
      locationId: appointment.locationId,
      customerEmail: appointment.customerEmail,
      customerFirstName: appointment.customerFirstName,
      customerLastName: appointment.customerLastName ?? "",
      customerPhone: appointment.customerPhone ?? "",
      date: format(startDate, "MM/dd/yyyy"),
      startTime: format(startDate, "h:mm a"),
      endTime: format(endDate, "h:mm a"),
      status: appointment.status,
      orderNbrs: appointment.orders.map((o) => o.orderNbr).join(", "),
    });
    loadAppointmentItems(appointment.id);
    setDialogOpen(true);
  };

  const addCreateOrder = async () => {
    const orderNbr = createOrderInput.trim().toUpperCase();
    setCreateModalError("");
    console.info("[staff-create-appointment] add order click", {
      orderNbr,
      existingCount: createOrders.length,
    });
    if (!orderNbr) return;
    if (createOrders.some((order) => order.orderNbr === orderNbr)) {
      console.warn("[staff-create-appointment] duplicate order blocked", { orderNbr });
      const message = `Order ${orderNbr} is already added.`;
      setCreateOrderError(message);
      setCreateModalError(message);
      return;
    }

    setCreateOrderLoading(true);
    setCreateOrderError("");
    try {
      console.info("[staff-create-appointment] lookup start", { orderNbr });
      const res = await fetch("/api/staff/pickups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookupOrder: true, orderNbr }),
      });
      const data = await res.json().catch(() => ({}));
      console.info("[staff-create-appointment] lookup response", {
        orderNbr,
        status: res.status,
        ok: res.ok,
        message: data?.message,
        hasOrder: Boolean(data?.order),
      });
      if (!res.ok) {
        const message = data?.message ?? "Unable to load order.";
        setCreateOrderError(message);
        setCreateModalError(message);
        return;
      }

      const order = data?.order as StaffCreateOrder & { lines?: StaffOrderLine[] };
      if (!order?.orderNbr) {
        setCreateOrderError("Unable to load order.");
        return;
      }

      const lines: StaffOrderLine[] = Array.isArray(order.lines)
        ? order.lines.map((line) => ({
            id: line.id,
            orderNbr: order.orderNbr,
            inventoryId: line.inventoryId,
            lineDescription: line.lineDescription,
            openQty: Number(line.openQty ?? 0),
            orderQty: Number(line.orderQty ?? 0),
            warehouse: line.warehouse,
            allocatedQty: Number(line.allocatedQty ?? 0),
            isAllocated: Boolean(line.isAllocated),
            lineAmount: Number(line.lineAmount ?? (line as any).amount ?? 0),
            taxRate: Number(line.taxRate ?? 0),
          }))
            .sort((a, b) => {
              const aAvailable =
                Number(a.openQty ?? 0) > 0 &&
                Boolean(a.isAllocated) &&
                Number(a.allocatedQty ?? 0) > 0 &&
                Boolean(a.inventoryId);
              const bAvailable =
                Number(b.openQty ?? 0) > 0 &&
                Boolean(b.isAllocated) &&
                Number(b.allocatedQty ?? 0) > 0 &&
                Boolean(b.inventoryId);
              if (aAvailable === bAvailable) return 0;
              return aAvailable ? -1 : 1;
            })
        : [];

      const selected = lines
        .filter((line) => {
          const openQty = Number(line.openQty ?? 0);
          const allocatedQty = Number(line.allocatedQty ?? 0);
          return Boolean(line.inventoryId) && openQty > 0 && Boolean(line.isAllocated) && allocatedQty > 0;
        })
        .map((line) => ({
          lineId: line.id,
          inventoryId: line.inventoryId ?? "",
          description: line.lineDescription ?? undefined,
          qty: Math.max(1, Math.floor(Number(line.openQty ?? 0))),
          maxQty: Math.max(1, Math.floor(Number(line.openQty ?? 0))),
          warehouse: line.warehouse ?? undefined,
        }));
      console.info("[staff-create-appointment] lookup parsed", {
        orderNbr: order.orderNbr,
        lineCount: lines.length,
        defaultSelectedCount: selected.length,
        terms: order.payment?.terms ?? null,
        unpaidBalance: Number(order.payment?.unpaidBalance ?? 0),
      });

      setCreateOrders((prev) => [...prev, {
        orderNbr: order.orderNbr,
        baid: order.baid,
        status: order.status,
        shipVia: order.shipVia,
        payment: order.payment,
        salesPerson: order.salesPerson ?? null,
      }]);
      setOrderLinesByOrder((prev) => ({ ...prev, [order.orderNbr]: lines }));
      if (selected.length) {
        setSelectedItems((prev) => [...prev, { orderNbr: order.orderNbr, items: selected }]);
      }
      setCreateOrderInput("");
      console.info("[staff-create-appointment] order added", {
        orderNbr: order.orderNbr,
      });
    } finally {
      setCreateOrderLoading(false);
    }
  };

  const removeCreateOrder = (orderNbr: string) => {
    console.info("[staff-create-appointment] remove order", { orderNbr });
    setCreateOrders((prev) => prev.filter((row) => row.orderNbr !== orderNbr));
    setOrderLinesByOrder((prev) => {
      const next = { ...prev };
      delete next[orderNbr];
      return next;
    });
    setSelectedItems((prev) => prev.filter((row) => row.orderNbr !== orderNbr));
    setCreateOrderSearch((prev) => {
      const next = { ...prev };
      delete next[orderNbr];
      return next;
    });
  };

  const handleCreateSelectAll = (orderNbr: string) => {
    const lines = orderLinesByOrder[orderNbr] ?? [];
    const items = lines
      .filter((line) => {
        const openQty = Math.max(0, Math.floor(Number(line.openQty ?? 0)));
        const allocatedQty = Math.max(0, Math.floor(Number(line.allocatedQty ?? 0)));
        return openQty > 0 && Boolean(line.inventoryId) && Boolean(line.isAllocated) && allocatedQty > 0;
      })
      .map((line) => ({
        lineId: line.id,
        inventoryId: line.inventoryId ?? "",
        description: line.lineDescription ?? undefined,
        qty: Math.max(1, Math.floor(Number(line.openQty ?? 0))),
        maxQty: Math.max(1, Math.floor(Number(line.openQty ?? 0))),
        warehouse: line.warehouse ?? undefined,
      }));
    setSelectedItems((prev) => {
      const rest = prev.filter((row) => row.orderNbr !== orderNbr);
      if (!items.length) return rest;
      return [...rest, { orderNbr, items }];
    });
  };

  const handleCreateUnselectAll = (orderNbr: string) => {
    setSelectedItems((prev) => prev.filter((row) => row.orderNbr !== orderNbr));
  };

  const handleOpenCreate = () => {
    console.info("[staff-create-appointment] open create modal", {
      selectedDate: selectedDate.toISOString(),
      locationDefault: selectedLocations[0] ?? null,
    });
    setActiveAppointment(null);
    setIsCreating(true);
    setItemsError("");
    setItemsLoading(false);
    setOrderLinesByOrder({});
    setSelectedItems([]);
    setShipmentDrafts({});
    setShipmentOriginals({});
    setShipmentEditing(true);
    setCreateOrderInput("");
    setCreateOrderLoading(false);
    setCreateOrderError("");
    setCreateModalError("");
    setCreateOrders([]);
    setCreateDayAppointments([]);
    setPrepayOverride(false);
    const start = toIsoLocal(selectedDate);
    const startDate = parseISO(start);
    const suggestedStartTime = format(startDate, "h:mm a");
    const defaultStartTime = createStartTimeOptions.includes(suggestedStartTime)
      ? suggestedStartTime
      : createStartTimeOptions[0] ?? "7:00 AM";
    setFormData({
      locationId: selectedLocations[0] ?? "",
      customerEmail: "",
      customerFirstName: "",
      customerLastName: "",
      customerPhone: "",
      date: format(startDate, "MM/dd/yyyy"),
      startTime: defaultStartTime,
      endTime: addMinutesToTimeLabel(defaultStartTime, SLOT_MINUTES),
      status: "Scheduled",
      orderNbrs: "",
    });
    setDialogOpen(true);
  };

  const handleSaveAppointment = async () => {
    if (isViewer || (!isCreating && !canEditAppointments)) {
      setError("Viewer access is read-only.");
      return;
    }
    const startAt = toIsoLocalFromDateAndTime(formData.date, formData.startTime);
    const computedEndTime = isCreating ? addMinutesToTimeLabel(formData.startTime, SLOT_MINUTES) : formData.endTime;
    const endAt = toIsoLocalFromDateAndTime(formData.date, computedEndTime);
    const orderNbrs = normalizeOrderNbrs(formData.orderNbrs);
    const payload = {
      locationId: formData.locationId,
      customerEmail: formData.customerEmail,
      customerFirstName: formData.customerFirstName,
      customerLastName: formData.customerLastName || undefined,
      customerPhone: formData.customerPhone || undefined,
      startAt,
      endAt,
      status: isCreating && isSalesperson ? "Scheduled" : formData.status,
      orderNbrs,
    };

    if (isCreating) {
      setCreateModalError("");
      console.info("[staff-create-appointment] create submit start", {
        locationId: payload.locationId,
        startAt: payload.startAt,
        endAt: payload.endAt,
        customerEmail: payload.customerEmail,
        orderCount: createOrders.length,
        selectedGroupCount: selectedItems.length,
        prepayOverride: canUsePrepayOverride && prepayOverride,
        prepayBlocks: createPrepayBlocks.map((x) => ({ orderNbr: x.orderNbr, amountOwed: x.amountOwed })),
      });
      if (createOrders.length === 0) {
        console.warn("[staff-create-appointment] blocked: no orders");
        setCreateModalError("Add at least one order before creating the appointment.");
        return;
      }
      const effectivePrepayOverride = canUsePrepayOverride && prepayOverride;
      if (createPrepayBlocks.length > 0 && !effectivePrepayOverride) {
        console.warn("[staff-create-appointment] blocked: prepay override required");
        setCreateModalError("Payment is required before pickup unless prepay override is enabled.");
        return;
      }
      const selectionPayload = normalizeSelectionsForSave(selectedItems);
      const createPayload = {
        ...payload,
        orderNbrs: createOrders.map((order) => order.orderNbr),
        selectedItems: selectionPayload,
        prepayOverride: effectivePrepayOverride,
      };
      if (hasR1CreateOrder) {
        setPendingCreatePayload(createPayload);
        setReturnAckChecked(false);
        setReturnAckOpen(true);
        return;
      }
      await submitCreateAppointment(createPayload);
      return;
    }

    if (!activeAppointment) return;
    const updateBody = {
      status: payload.status,
      startAt: payload.startAt,
      endAt: payload.endAt,
      locationId: payload.locationId,
      customerFirstName: payload.customerFirstName,
      customerLastName: payload.customerLastName ?? null,
      customerEmail: payload.customerEmail,
      customerPhone: payload.customerPhone ?? null,
      orderNbrs: payload.orderNbrs,
    };

    if (hasNotifiableChange(activeAppointment, updateBody, orderNbrs)) {
      setPendingUpdate({
        id: activeAppointment.id,
        body: updateBody,
        orderNbrs,
        status: formData.status,
      });
      setNotifyCustomer(false);
      setCancelReason("");
      setDialogOpen(false);
      setNotifyDialogOpen(true);
      return;
    }

    await submitUpdate(activeAppointment.id, updateBody, false, "");
  };

  const handleToggleLine = (orderNbr: string, line: StaffOrderLine, checked: boolean) => {
    const maxQty = Math.max(0, Math.floor(Number(line.openQty ?? 0)));
    const allocatedQty = Math.max(0, Math.floor(Number(line.allocatedQty ?? 0)));
    if (!checked) {
      updateSelection(orderNbr, (items) => items.filter((item) => item.lineId !== line.id));
      return;
    }
    if (maxQty <= 0) return;
    if (!line.isAllocated || allocatedQty <= 0) return;
    const inventoryId = line.inventoryId;
    if (!inventoryId) return;
    updateSelection(orderNbr, (items) => {
      const existing = items.find((item) => item.lineId === line.id);
      if (existing) return items;
      return [
        ...items,
        {
          lineId: line.id,
          inventoryId,
          description: line.lineDescription ?? undefined,
          maxQty,
          qty: Math.min(1, maxQty),
        },
      ];
    });
  };

  const handleAdjustQty = (orderNbr: string, key: string, delta: number, maxQty?: number) => {
    updateSelection(orderNbr, (items) =>
      items
        .map((item) => {
          const itemKey = item.lineId ?? item.inventoryId;
          if (itemKey !== key) return item;
          const nextQty = Math.max(0, item.qty + delta);
          const cappedQty = maxQty ? Math.min(nextQty, maxQty) : nextQty;
          return { ...item, qty: cappedQty };
        })
        .filter((item) => item.qty > 0)
    );
  };

  const handleSetQty = (orderNbr: string, key: string, value: number, maxQty?: number) => {
    const qty = Number.isNaN(value) ? 0 : Math.max(0, Math.floor(value));
    updateSelection(orderNbr, (items) =>
      items
        .map((item) => {
          const itemKey = item.lineId ?? item.inventoryId;
          if (itemKey !== key) return item;
          const cappedQty = maxQty ? Math.min(qty, maxQty) : qty;
          return { ...item, qty: cappedQty };
        })
        .filter((item) => item.qty > 0)
    );
  };

  const handleSaveItems = async () => {
    if (isViewer || !canEditAppointments || !activeAppointment) return;
    const payload = normalizeSelectionsForSave(selectedItems);
    setPendingItemsSave(payload);
    setNotifyItemsCustomer(true);
    setItemsNotifyOpen(true);
  };

  const submitItemsUpdate = async (notify: boolean) => {
    if (!activeAppointment || !pendingItemsSave) return;
    const res = await fetch(`/api/staff/pickups/${activeAppointment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectedItems: pendingItemsSave,
        notifyCustomer: notify,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setItemsError(data?.message ?? "Unable to update items.");
      return;
    }
    await loadAppointmentItems(activeAppointment.id);
    setItemsNotifyOpen(false);
    setPendingItemsSave(null);
  };

  const handleDragDrop = async (event: React.DragEvent<HTMLDivElement>, day: Date) => {
    if (isViewer || !canEditAppointments) return;
    event.preventDefault();
    const appointmentId = event.dataTransfer.getData("text/plain");
    const appointment = appointments.find((apt) => apt.id === appointmentId);
    if (!appointment) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const offsetY = Math.max(0, event.clientY - rect.top);
    const minutesOffset = Math.floor(offsetY / slotHeight) * SLOT_MINUTES;
    const startMinutes = Math.min(START_HOUR * 60 + minutesOffset, END_HOUR * 60 - SLOT_MINUTES);

    const duration = (new Date(appointment.endAt).getTime() - new Date(appointment.startAt).getTime()) / 60000;

    const start = new Date(day);
    start.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
    const end = new Date(start.getTime() + duration * 60_000);

    const updateBody = {
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    };

    if (hasNotifiableChange(appointment, updateBody, appointment.orders.map((o) => o.orderNbr))) {
      setPendingUpdate({
        id: appointment.id,
        body: updateBody,
        orderNbrs: appointment.orders.map((o) => o.orderNbr),
        status: appointment.status,
      });
      setNotifyCustomer(false);
      setCancelReason("");
      setNotifyDialogOpen(true);
      return;
    }

    await submitUpdate(appointment.id, updateBody, false, "");
  };

  const renderAppointments = (day: Date) => {
    const dateKey = format(day, "yyyy-MM-dd");
    const dayAppointments = appointmentsByDay.get(dateKey) ?? [];
    const layout = layoutAppointments(dayAppointments, slotHeight);

    return (
      <div
        className="relative border border-border/60 bg-white"
        style={{ height: calendarHeight }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => handleDragDrop(event, day)}
      >
        {layout.map((apt) => {
          const width = 100 / apt.columnCount;
          const left = width * apt.column;
          const isCompact = apt.height < 36;
          const showTime = apt.height >= 32;
          const showOrders = apt.height >= 52;
          const isWeek = view === "week";
          return (
            <div
              key={apt.id}
              draggable={!isViewer && canEditAppointments}
              onDragStart={
                isViewer || !canEditAppointments
                  ? undefined
                  : (event) => event.dataTransfer.setData("text/plain", apt.id)
              }
              onClick={canEditAppointments ? () => handleOpenEdit(apt) : undefined}
              className={cn(
                "absolute rounded-lg border border-border/60 text-xs shadow-sm cursor-pointer overflow-hidden",
                isCompact ? "p-1" : "p-2",
                "bg-white hover:shadow-md transition-shadow"
              )}
              style={{
                top: apt.top,
                height: apt.height,
                left: `${left}%`,
                width: `${width}%`,
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    `rounded-full ${STATUS_STYLES[apt.status]}`,
                    isWeek ? "px-1.5 py-0.5 text-[9px] leading-none" : "px-2 py-0.5 text-[10px]"
                  )}
                >
                  {apt.status}
                </span>
                <span className={cn("font-semibold truncate", isWeek ? "text-[11px]" : "text-xs")}>
                  {apt.customerFirstName} {apt.customerLastName}
                </span>
              </div>
              {showTime ? (
                <div className={cn("mt-1 text-muted-foreground", isWeek ? "text-[10px] leading-tight" : "text-[11px]")}>
                  {format(parseISO(apt.startAt), "h:mm a")} - {format(parseISO(apt.endAt), "h:mm a")}
                </div>
              ) : null}
              {showOrders ? (
                <div className={cn("mt-1 text-muted-foreground truncate", isWeek ? "text-[10px] leading-tight" : "text-[11px]")}>
                  {apt.orders.map((o) => o.orderNbr).join(", ")}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-xl">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Pickups Calendar
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {view === "week"
                  ? `${format(rangeStart, "MMM d")} - ${format(rangeEnd, "MMM d")}`
                  : format(selectedDate, "MMMM d, yyyy")}
              </p>
            </div>

          <div className="flex flex-wrap items-center gap-3">
            {view === "day" ? (
              <Input
                type="date"
                value={format(selectedDate, "yyyy-MM-dd")}
                onChange={(event) => {
                  const next = event.target.value;
                  if (next) setSelectedDate(parseISO(next));
                }}
                className="w-[160px]"
              />
            ) : null}

            <Tabs value={view} onValueChange={(val) => setView(val as "day" | "week")}>
              <TabsList className="bg-white">
                <TabsTrigger value="day">Day</TabsTrigger>
                <TabsTrigger value="week" className="hidden md:inline-flex">Week</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="bg-white"
                onClick={() => setSelectedDate(addDays(selectedDate, view === "week" ? -7 : -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="bg-white"
                onClick={() => setSelectedDate(addDays(selectedDate, view === "week" ? 7 : 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* moved to staff nav */}
          </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">Store</Label>
              <Select
                value={locationSelectValue}
                onValueChange={(value) => {
                  if (!value) return;
                  if (value === "all") {
                    setSelectedLocations(accessibleLocations);
                  } else {
                    setSelectedLocations([value]);
                  }
                }}
                disabled={accessibleLocations.length <= 1}
              >
                <SelectTrigger className="w-[240px] bg-white">
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {accessibleLocations.length > 1 ? (
                    <SelectItem value="all">All locations</SelectItem>
                  ) : null}
                  {accessibleLocations.map((locId) => {
                    const location = pickupLocations.find((loc) => loc.id === locId);
                    return (
                      <SelectItem key={locId} value={locId}>
                        {location?.name ?? locId.toUpperCase()}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">Status</Label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((status) => {
                  const checked = selectedStatuses.includes(status);
                  return (
                    <label
                      key={status}
                      className="flex items-center gap-2 rounded-md border border-border/60 bg-white px-3 py-1.5 text-xs"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => toggleStatus(status, Boolean(value))}
                      />
                      <span>{status}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center text-muted-foreground py-12">Loading pickups...</div>
          ) : error ? (
            <div className="text-center text-destructive py-12">{error}</div>
          ) : (
            <div className="grid grid-cols-[70px_1fr] gap-4">
              <div>
                <div className="text-xs font-semibold text-muted-foreground opacity-0 mb-2">Spacer</div>
                <div
                  className="relative text-xs text-muted-foreground"
                  style={{ height: calendarHeight + timeLabelOffset }}
                >
                  {timeLabels.map((label) => {
                    const offset = ((label.minutes - START_HOUR * 60) / SLOT_MINUTES) * slotHeight;
                    return (
                      <div
                        key={label.minutes}
                        className="absolute -translate-y-1"
                        style={{ top: offset + timeLabelOffset }}
                      >
                        {label.label}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={cn("grid gap-4", view === "week" ? "grid-cols-7" : "grid-cols-1")}>
                {visibleDays.map((day) => (
                  <div key={day.toISOString()} className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground">
                      {format(day, "EEE, MMM d")}
                      {isSameDay(day, new Date()) ? " - Today" : ""}
                    </div>
                    {renderAppointments(day)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>{isCreating ? "Create Appointment" : "Edit Appointment"}</DialogTitle>
            <DialogDescription>Update appointment details and orders.</DialogDescription>
          </DialogHeader>
          {isCreating && createModalError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {createModalError}
            </div>
          ) : null}

          <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
            <div className="grid gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Select
                    value={formData.locationId}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, locationId: value }))}
                    disabled={isViewer}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {accessibleLocations.map((locId) => {
                        const location = pickupLocations.find((loc) => loc.id === locId);
                        return (
                          <SelectItem key={locId} value={locId}>
                            {location?.name ?? locId.toUpperCase()}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value as AppointmentStatus }))}
                    disabled={isViewer || isCreating}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {(isCreating ? ["Scheduled"] : Object.keys(STATUS_STYLES)).map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Customer Email</Label>
                  <Input
                    value={formData.customerEmail}
                    onChange={(event) => setFormData((prev) => ({ ...prev, customerEmail: event.target.value }))}
                    placeholder="customer@email.com"
                    disabled={isViewer}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={formData.customerPhone}
                    onChange={(event) => setFormData((prev) => ({ ...prev, customerPhone: event.target.value }))}
                    placeholder="(555) 555-5555"
                    disabled={isViewer}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input
                    value={formData.customerFirstName}
                    onChange={(event) => setFormData((prev) => ({ ...prev, customerFirstName: event.target.value }))}
                    placeholder="First name"
                    disabled={isViewer}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input
                    value={formData.customerLastName}
                    onChange={(event) => setFormData((prev) => ({ ...prev, customerLastName: event.target.value }))}
                    placeholder="Last name"
                    disabled={isViewer}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      disabled={isViewer}
                    >
                      {formData.date || "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.date ? parse(formData.date, "MM/dd/yyyy", new Date()) : undefined}
                      onSelect={(date) => {
                        if (!date) return;
                        setFormData((prev) => ({ ...prev, date: format(date, "MM/dd/yyyy") }));
                      }}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Select
                    value={formData.startTime}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, startTime: value }))}
                    disabled={isViewer}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select start time" />
                    </SelectTrigger>
                    <SelectContent>
                      {(isCreating ? availableCreateStartTimeOptions : timeOptions).map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isCreating && availableCreateStartTimeOptions.length === 0 ? (
                    <p className="text-xs text-destructive">
                      No available start times for this date/location.
                    </p>
                  ) : null}
                </div>
                {isCreating ? (
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input value={addMinutesToTimeLabel(formData.startTime, SLOT_MINUTES)} disabled />
                    <p className="text-xs text-muted-foreground">Appointment duration is fixed at 15 minutes.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Select
                      value={formData.endTime}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, endTime: value }))}
                      disabled={isViewer}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select end time" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {isCreating ? (
                <div className="space-y-2">
                  <Label>Add Order</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={createOrderInput}
                      onChange={(event) => setCreateOrderInput(event.target.value)}
                      placeholder="SO12345"
                      disabled={isViewer || createOrderLoading}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addCreateOrder();
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      onClick={addCreateOrder}
                      disabled={isViewer || createOrderLoading || !createOrderInput.trim()}
                    >
                      {createOrderLoading ? "Loading..." : "Add"}
                    </Button>
                  </div>
                  {createOrders.length ? (
                    <div className="flex flex-wrap gap-2">
                      {createOrders.map((order) => (
                        <div
                          key={order.orderNbr}
                          className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/20 px-3 py-1 text-xs"
                        >
                          <span>{order.orderNbr}</span>
                          <button
                            type="button"
                            onClick={() => removeCreateOrder(order.orderNbr)}
                            className="text-muted-foreground hover:text-foreground"
                            disabled={isViewer}
                          >
                            x
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No orders added yet.</p>
                  )}
                </div>
              ) : null}
            </div>

            <div className="rounded-lg border border-border/60 bg-white p-4 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-foreground">Items for this appointment</div>
                  <p className="text-xs text-muted-foreground">
                    Adjust items and quantities for each order. 0 qty removes a line.
                  </p>
                </div>
                {activeAppointment?.status === "Ready" ? (
                  <Button
                    size="sm"
                    onClick={() => setShipmentEditing((prev) => !prev)}
                    className={shipmentEditing ? DESTRUCTIVE_BUTTON : undefined}
                  >
                    {shipmentEditing ? "Cancel edit" : "Edit"}
                  </Button>
                ) : null}
              </div>

              {isCreating ? (
                createOrders.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
                    Add at least one order to load line items.
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {createPrepayBlocks.length ? (
                      <div className="rounded-md border border-[#d24f39] bg-[#fdf5f2] p-3 text-xs text-[#b13d2b] space-y-2">
                        <div className="font-semibold">Payment required before pickup.</div>
                        {createPrepayBlocks.map((block) => (
                          <div key={block.orderNbr} className="rounded-md border border-[#f1c3ba] bg-white px-3 py-2">
                            <div className="font-semibold">Order {block.orderNbr}</div>
                            <div>Amount owed: ${block.amountOwed.toFixed(2)}</div>
                            <div>
                              Contact {formatSalesPersonContact(block.salesPerson)}.
                            </div>
                          </div>
                        ))}
                        {canUsePrepayOverride ? (
                          <label className="flex items-start gap-2 text-foreground">
                            <input
                              type="checkbox"
                              checked={prepayOverride}
                              onChange={(event) => setPrepayOverride(event.target.checked)}
                              className="mt-0.5"
                              disabled={isViewer}
                            />
                            <span>Prepay override (staff/admin emergency use only)</span>
                          </label>
                        ) : null}
                      </div>
                    ) : null}
                    {createOrders.map((order) => {
                      const orderNbr = order.orderNbr;
                      const lines = orderLinesByOrder[orderNbr] ?? [];
                      const selectedMap = selectionsByOrder.get(orderNbr);
                      const search = (createOrderSearch[orderNbr] ?? "").trim().toLowerCase();
                      const filteredLines = !search
                        ? lines
                        : lines.filter((line) => {
                            const inv = String(line.inventoryId ?? "").toLowerCase();
                            const desc = String(line.lineDescription ?? "").toLowerCase();
                            return inv.includes(search) || desc.includes(search);
                          });
                      return (
                        <div key={orderNbr} className="rounded-md border border-border/60 p-3 space-y-3">
                          <div className="space-y-1">
                            <div className="text-sm font-semibold text-foreground">Order {orderNbr}</div>
                            <div className="text-xs text-muted-foreground">
                              Terms: {order.payment.terms || "N/A"} | Unpaid balance: ${Number(order.payment.unpaidBalance ?? 0).toFixed(2)}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <Input
                              value={createOrderSearch[orderNbr] ?? ""}
                              onChange={(event) =>
                                setCreateOrderSearch((prev) => ({ ...prev, [orderNbr]: event.target.value }))
                              }
                              placeholder="Search items"
                              className="md:max-w-xs"
                              disabled={isViewer}
                            />
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCreateSelectAll(orderNbr)}
                                disabled={isViewer}
                              >
                                Select all
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCreateUnselectAll(orderNbr)}
                                disabled={isViewer}
                              >
                                Unselect all
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {filteredLines.length === 0 ? (
                              <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                                {lines.length === 0 ? "No items found for this order yet." : "No items match your search."}
                              </div>
                            ) : null}
                            {filteredLines.map((line) => {
                              const maxQty = Math.max(0, Math.floor(Number(line.openQty ?? 0)));
                              const allocatedQty = Math.max(0, Math.floor(Number(line.allocatedQty ?? 0)));
                              const selected = selectedMap?.get(line.id);
                              const key = line.id;
                              const canSelect =
                                maxQty > 0 && Boolean(line.inventoryId) && Boolean(line.isAllocated) && allocatedQty > 0;
                              return (
                                <div
                                  key={line.id}
                                  className={cn(
                                    "rounded-md border border-border/60 p-2 flex items-start justify-between gap-3",
                                    selected
                                      ? "bg-secondary/30"
                                      : canSelect
                                        ? "bg-white"
                                        : "bg-muted/50"
                                  )}
                                >
                                  <label className="flex items-start gap-2">
                                    <Checkbox
                                      checked={Boolean(selected)}
                                      onCheckedChange={(value) =>
                                        handleToggleLine(orderNbr, line, Boolean(value))
                                      }
                                      disabled={isViewer || !canSelect}
                                    />
                                    <div>
                                      <div className="text-sm font-medium text-foreground">
                                        {line.inventoryId ?? "Item"}
                                      </div>
                                      {line.lineDescription ? (
                                        <div className="text-xs text-muted-foreground">
                                          {line.lineDescription}
                                        </div>
                                      ) : null}
                                      <div className="text-[11px] text-muted-foreground">
                                        Open qty: {Number(line.openQty ?? 0)}
                                      </div>
                                      {!canSelect ? (
                                        <div className="text-[11px] font-semibold text-foreground">
                                          {maxQty <= 0
                                            ? "Item already picked up"
                                            : "Item(s) not ready for pick up"}
                                        </div>
                                      ) : null}
                                    </div>
                                  </label>
                                  {selected ? (
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2"
                                        onClick={() => handleAdjustQty(orderNbr, key, -1, maxQty)}
                                        disabled={isViewer}
                                      >
                                        -
                                      </Button>
                                      <Input
                                        type="number"
                                        min={0}
                                        max={maxQty}
                                        value={selected.qty}
                                        onChange={(event) =>
                                          handleSetQty(orderNbr, key, Number(event.target.value), maxQty)
                                        }
                                        className="h-7 w-16 text-center"
                                        disabled={isViewer}
                                      />
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2"
                                        onClick={() => handleAdjustQty(orderNbr, key, 1, maxQty)}
                                        disabled={isViewer}
                                      >
                                        +
                                      </Button>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : itemsLoading ? (
                <div className="text-sm text-muted-foreground">Loading items...</div>
              ) : itemsError ? (
                <div className="text-sm text-destructive">{itemsError}</div>
              ) : (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                  {(activeAppointment?.orders ?? []).map((order) => {
                    const orderNbr = order.orderNbr;
                    const lines = orderLinesByOrder[orderNbr] ?? [];
                    const selectedMap = selectionsByOrder.get(orderNbr);
                    const shipments = shipmentDrafts[orderNbr] ?? [];
                    const isShipmentLocked =
                      isViewer ||
                      (activeAppointment?.status === "Ready" && !shipmentEditing) ||
                      activeAppointment?.status === "Cancelled" ||
                      activeAppointment?.status === "Completed" ||
                      activeAppointment?.status === "NoShow";
                    const isItemsLocked = isViewer;

                    return (
                      <div key={orderNbr} className="rounded-md border border-border/60 p-3 space-y-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="text-sm font-semibold text-foreground">Order {orderNbr}</div>
                          <div className="rounded-md border border-border/60 bg-muted/30 p-3 md:min-w-[220px]">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Shipments
                            </div>
                            <div className="mt-2 space-y-2">
                              {shipments.length ? (
                                shipments.map((value, idx) => {
                                  const isValid =
                                    value.trim().length === 0 || SHIPMENT_FORMAT.test(value.trim());
                                  return (
                                    <div key={`${orderNbr}-${idx}`} className="flex items-center gap-2">
                                      <Input
                                        value={value}
                                        onChange={(event) =>
                                          updateShipmentValue(orderNbr, idx, event.target.value)
                                        }
                                        placeholder="SMT0123456"
                                        className={cn(!isValid && "border-destructive")}
                                        disabled={isShipmentLocked}
                                      />
                                      <Button
                                        size="sm"
                                        onClick={() => removeShipment(orderNbr, idx)}
                                        disabled={isShipmentLocked}
                                        className={DESTRUCTIVE_BUTTON}
                                      >
                                        Remove
                                      </Button>
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="text-xs text-muted-foreground">No shipments yet.</div>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => addShipment(orderNbr)}
                                disabled={isShipmentLocked}
                              >
                                + Add shipment
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {lines.map((line) => {
                            const maxQty = Math.max(0, Math.floor(Number(line.openQty ?? 0)));
                            const allocatedQty = Math.max(0, Math.floor(Number(line.allocatedQty ?? 0)));
                            const selected = selectedMap?.get(line.id);
                            const key = line.id;
                            const canSelect =
                              maxQty > 0 &&
                              Boolean(line.inventoryId) &&
                              Boolean(line.isAllocated) &&
                              allocatedQty > 0;
                            return (
                              <div
                                key={line.id}
                                className={cn(
                                  "rounded-md border border-border/60 p-2 flex items-start justify-between gap-3",
                                  selected ? "bg-secondary/30" : canSelect ? "bg-white" : "bg-muted/50"
                                )}
                              >
                                <label className="flex items-start gap-2">
                                  <Checkbox
                                    checked={Boolean(selected)}
                                    onCheckedChange={(value) =>
                                      handleToggleLine(orderNbr, line, Boolean(value))
                                    }
                                    disabled={isItemsLocked || !canSelect}
                                  />
                                  <div>
                                    <div className="text-sm font-medium text-foreground">
                                      {line.inventoryId ?? "Item"}
                                    </div>
                                    {line.lineDescription ? (
                                      <div className="text-xs text-muted-foreground">
                                        {line.lineDescription}
                                      </div>
                                    ) : null}
                                    <div className="text-[11px] text-muted-foreground">
                                      Open qty: {Number(line.openQty ?? 0)}
                                    </div>
                                    {!canSelect ? (
                                      <div className="text-[11px] font-semibold text-foreground">
                                        {maxQty <= 0
                                          ? "Item already picked up"
                                          : "Item(s) not ready for pick up"}
                                      </div>
                                    ) : null}
                                  </div>
                                </label>
                                {selected ? (
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 px-2"
                                      onClick={() => handleAdjustQty(orderNbr, key, -1, maxQty)}
                                      disabled={isItemsLocked}
                                    >
                                      -
                                    </Button>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={maxQty}
                                      value={selected.qty}
                                      onChange={(event) =>
                                        handleSetQty(orderNbr, key, Number(event.target.value), maxQty)
                                      }
                                      className="h-7 w-16 text-center"
                                      disabled={isItemsLocked}
                                    />
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 px-2"
                                      onClick={() => handleAdjustQty(orderNbr, key, 1, maxQty)}
                                      disabled={isItemsLocked}
                                    >
                                      +
                                    </Button>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

              {shipmentError ? <p className="text-xs text-destructive">{shipmentError}</p> : null}
              {!isCreating ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      Shipment numbers must follow the format SMT#######.
                    </p>
                    <Button
                      variant="outline"
                      onClick={saveShipments}
                      disabled={
                        isViewer ||
                        shipmentSaving ||
                        (activeAppointment?.status === "Ready" && !shipmentEditing) ||
                        activeAppointment?.status === "Cancelled" ||
                        activeAppointment?.status === "Completed" ||
                        activeAppointment?.status === "NoShow" ||
                        !shipmentDirty
                      }
                    >
                      {shipmentSaving ? "Saving..." : "Save Shipments"}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      Items are based on the current order list. Save orders first if they changed.
                    </p>
                    <Button
                      variant="outline"
                      onClick={handleSaveItems}
                      disabled={isViewer}
                    >
                      Save Items
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              onClick={() => {
                setCreateModalError("");
                setReturnAckOpen(false);
                setReturnAckChecked(false);
                setPendingCreatePayload(null);
                setDialogOpen(false);
              }}
              className={DESTRUCTIVE_BUTTON}
            >
              Cancel
            </Button>
            <Button
              variant="hero"
              onClick={handleSaveAppointment}
              disabled={
                isViewer ||
                (!isCreating && !canEditAppointments) ||
                (isCreating && availableCreateStartTimeOptions.length === 0) ||
                (isCreating && createPrepayBlocks.length > 0 && !(canUsePrepayOverride && prepayOverride))
              }
            >
              {isCreating ? "Create Appointment" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={returnAckOpen}
        onOpenChange={(open) => {
          setReturnAckOpen(open);
          if (!open) {
            setReturnAckChecked(false);
            setPendingCreatePayload(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Return Acknowledgement</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={returnAckChecked}
                onChange={(event) => setReturnAckChecked(event.target.checked)}
                className="mt-1"
              />
              <span>
                I acknowledge that original product must be returned before my appointment or at the
                time of my appointment before my replacement product can be given to me.
              </span>
            </label>
          </div>

          <DialogFooter className="mt-4">
            <Button
              onClick={() => {
                setReturnAckOpen(false);
                setReturnAckChecked(false);
                setPendingCreatePayload(null);
              }}
              className={DESTRUCTIVE_BUTTON}
            >
              Cancel
            </Button>
            <Button
              variant="hero"
              disabled={!returnAckChecked}
              onClick={async () => {
                if (!pendingCreatePayload || !returnAckChecked) return;
                setReturnAckOpen(false);
                await submitCreateAppointment(pendingCreatePayload);
                setReturnAckChecked(false);
                setPendingCreatePayload(null);
              }}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={notifyDialogOpen} onOpenChange={setNotifyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send customer notification?</DialogTitle>
            <DialogDescription>
              This change affects time, location, status, or orders.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={notifyCustomer}
                onChange={(event) => setNotifyCustomer(event.target.checked)}
                className="mt-1"
              />
              <span>Notify customer about this update.</span>
            </label>

            {pendingUpdate?.status === "Cancelled" && notifyCustomer ? (
              <div className="space-y-2">
                <Label>Cancellation reason (required to notify)</Label>
                <Input
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  placeholder="Reason for cancellation"
                />
              </div>
            ) : null}
          </div>

          <DialogFooter className="mt-4">
            <Button
              onClick={() => {
                setNotifyDialogOpen(false);
                setPendingUpdate(null);
                setNotifyCustomer(false);
                setCancelReason("");
              }}
              className={DESTRUCTIVE_BUTTON}
            >
              Cancel
            </Button>
            <Button
              variant="hero"
              onClick={async () => {
                if (!pendingUpdate) return;
                if (pendingUpdate.status === "Cancelled" && notifyCustomer && !cancelReason.trim()) {
                  setError("Cancellation reason is required to notify the customer.");
                  return;
                }
                await submitUpdate(
                  pendingUpdate.id,
                  pendingUpdate.body,
                  notifyCustomer,
                  cancelReason.trim()
                );
                setNotifyDialogOpen(false);
                setPendingUpdate(null);
                setCancelReason("");
              }}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={itemsNotifyOpen} onOpenChange={setItemsNotifyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Notify customer about item changes?</DialogTitle>
            <DialogDescription>
              Send an update if you changed the items or quantities for this appointment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={notifyItemsCustomer}
                onChange={(event) => setNotifyItemsCustomer(event.target.checked)}
                className="mt-1"
              />
              <span>Notify customer about these item updates.</span>
            </label>
          </div>

          <DialogFooter className="mt-4">
            <Button
              onClick={() => {
                setItemsNotifyOpen(false);
                setPendingItemsSave(null);
              }}
              className={DESTRUCTIVE_BUTTON}
            >
              Cancel
            </Button>
            <Button
              variant="hero"
              onClick={async () => {
                await submitItemsUpdate(notifyItemsCustomer);
              }}
            >
              Save Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
