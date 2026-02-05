"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronDown, ChevronRight, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Header from "@/components/layout/Header";
import ProgressSteps from "@/components/scheduling/ProgressSteps";
import { usePickup } from "@/context/PickupContext";
import { OrderItemSelection, SelectedItem } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

const steps = [
  { id: 1, name: "Location" },
  { id: 2, name: "Item Selection" },
  { id: 3, name: "Date & Time" },
  { id: 4, name: "Details" },
  { id: 5, name: "Confirm" },
];

type ItemRow = SelectedItem & {
  selected: boolean;
  orderQty: number;
  lineAmount: number;
  taxRate: number;
  openQty: number;
  allocatedQty: number;
  isAllocated: boolean;
  isAvailable: boolean;
};
type OrderGroup = {
  orderNbr: string;
  items: ItemRow[];
  expanded: boolean;
  payment: {
    orderTotal: number | null;
    unpaidBalance: number | null;
    terms: string | null;
    status: string | null;
  };
  pickedUpValue: number;
  salesPerson?: {
    number: string;
    name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
};

const PREPAY_TERMS = new Set(["PP", "PPP", "PPT", "TRADE", "CONTRACT"]);
const MIN_DEPOSIT_RATIO = 0.47;
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const formatPhone = (value?: string | null) => {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return value;
};

const formatSalespersonContact = (salesPerson?: {
  number: string;
  name: string | null;
  phone: string | null;
  email: string | null;
} | null) => {
  if (!salesPerson) return "your salesperson";
  const label = salesPerson.name || salesPerson.number || "your salesperson";
  const contactPieces: string[] = [];
  const phone = formatPhone(salesPerson.phone);
  if (phone) contactPieces.push(phone);
  if (salesPerson.email) contactPieces.push(salesPerson.email);
  if (contactPieces.length === 0) return label;
  return `${label} at ${contactPieces.join(" or ")}`;
};

type PublicOrderReadyResponse = {
  orderReady: {
    orderNbr: string;
    salesPerson?: {
      number: string;
      name: string | null;
      phone: string | null;
      email: string | null;
    } | null;
  };
  payment?: {
    orderTotal: number | null;
    unpaidBalance: number | null;
    terms: string | null;
    status: string | null;
  } | null;
  orderLines?: {
    id: string;
    inventoryId: string | null;
    lineDescription: string | null;
    warehouse: string | null;
    openQty: number | null;
    orderQty: number | null;
    allocatedQty: number | null;
    isAllocated: boolean;
    amount: number | null;
    taxRate: number | null;
  }[];
};

const ItemSelectionPage: React.FC = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const { formData, updateFormData } = usePickup();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orderGroups, setOrderGroups] = useState<OrderGroup[]>([]);
  const [creditHoldOpen, setCreditHoldOpen] = useState(false);
  const orderReadyToken = formData.orderReadyToken;
  const usePublicFlow = Boolean(orderReadyToken);
  const lockSelection = usePublicFlow;

  const orderNbrs = useMemo(
    () =>
      Array.from(
        new Set(
          formData.appointmentGroups.flatMap((group) => group.orderNbrs || [])
        )
      ),
    [formData.appointmentGroups]
  );

  useEffect(() => {
    if (!formData.pickupReference || orderNbrs.length === 0) {
      router.push("/");
    }
  }, [formData.pickupReference, orderNbrs.length, router]);

  useEffect(() => {
    const user = session?.user as any;
    if (!usePublicFlow && (!user?.id || !user?.email)) return;
    if (orderNbrs.length === 0) return;

    let active = true;
    setLoading(true);
    setError("");

    const previousSelections = new Map<string, Map<string, SelectedItem>>();
    for (const selection of formData.selectedItems) {
      const map = new Map<string, SelectedItem>();
      for (const item of selection.items) {
        map.set(item.lineId, item);
      }
      previousSelections.set(selection.orderNbr, map);
    }

    Promise.all(
      orderNbrs.map(async (orderNbr) => {
        let data: any = {};
        if (usePublicFlow) {
          if (!orderReadyToken) {
            throw new Error("Missing order-ready token.");
          }
          const res = await fetch(
            `/api/public/order-ready/${orderNbr}?token=${encodeURIComponent(orderReadyToken)}`
          );
          data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data?.message ?? "Unable to load items.");
          }
        } else {
          const res = await fetch("/api/customer/orders/detail", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderNbr,
              userId: user.id,
              email: user.email,
              baid: user.baid,
            }),
          });
          data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data?.message ?? "Unable to load items.");
          }
        }

        const publicPayload = data as PublicOrderReadyResponse;
        const lines = Array.isArray(publicPayload?.orderLines)
          ? publicPayload.orderLines
          : Array.isArray(data?.lines)
          ? data.lines
          : [];
        const payment = usePublicFlow ? publicPayload?.payment ?? {} : data?.payment ?? {};
        const orderTotal = Number(payment?.orderTotal ?? 0) || 0;
        const unpaidBalance = Number(payment?.unpaidBalance ?? 0) || 0;
        const terms = typeof payment?.terms === "string" ? payment.terms : null;
        const status = typeof payment?.status === "string" ? payment.status : null;
        const salesPerson = usePublicFlow
          ? publicPayload?.orderReady?.salesPerson ?? null
          : data?.summary?.salesPerson ?? null;
        const pickedUpValueRaw = lines.reduce((sum: number, line: any) => {
          const orderQty = Number(line.orderQty ?? 0) || 0;
          if (orderQty <= 0) return sum;
          const openQty = Math.max(0, Number(line.openQty ?? 0));
          const pickedUpQty = Math.max(0, orderQty - openQty);
          if (pickedUpQty <= 0) return sum;
          const lineAmount = Number(line.amount ?? 0) || 0;
          const taxRate = Number(line.taxRate ?? 0) || 0;
          const perUnitPreTax = lineAmount / orderQty;
          const perUnitTax = perUnitPreTax * (taxRate / 100);
          return sum + pickedUpQty * (perUnitPreTax + perUnitTax);
        }, 0);
        const pickedUpValue = Math.round(pickedUpValueRaw * 100) / 100;
        const prev = previousSelections.get(orderNbr);
        const items: ItemRow[] = lines.map((line: any) => {
          const openQty = Number(line.openQty ?? 0);
          const orderQty = Number(line.orderQty ?? 0) || 0;
          const allocatedQty = Number(line.allocatedQty ?? 0) || 0;
          const isAllocated = Boolean(line.isAllocated);
          const isAvailable = openQty > 0 && isAllocated && allocatedQty > 0;
          const maxQty = isAvailable ? Math.max(1, Math.floor(openQty)) : 0;
          const prevItem = prev?.get(line.id);
          const fallbackQty = Math.max(0, Math.floor(openQty));
          const qty = prevItem
            ? Math.min(prevItem.qty, maxQty)
            : isAvailable
            ? maxQty
            : fallbackQty;
        return {
            lineId: line.id,
            inventoryId: line.inventoryId ?? null,
            description: line.lineDescription ?? null,
            warehouse: line.warehouse ?? null,
            orderQty,
            lineAmount: Number(line.amount ?? 0) || 0,
            taxRate: Number(line.taxRate ?? 0) || 0,
            openQty,
            allocatedQty,
            isAllocated,
            isAvailable,
            maxQty,
            qty,
            selected: isAvailable,
          };
        });

        const sortedItems = [...items].sort((a, b) => {
          if (a.isAvailable === b.isAvailable) return 0;
          return a.isAvailable ? -1 : 1;
        });

        return {
          orderNbr,
          items: sortedItems,
          payment: {
            orderTotal,
            unpaidBalance,
            terms,
            status,
          },
          pickedUpValue,
          salesPerson,
        };
      })
    )
      .then((results) => {
        if (!active) return;
        setOrderGroups(
          results.map((result, index) => ({
            orderNbr: result.orderNbr,
            items: result.items,
            expanded: index === 0,
            payment: result.payment,
            pickedUpValue: result.pickedUpValue,
            salesPerson: result.salesPerson ?? null,
          }))
        );
      })
      .catch((err: any) => {
        if (!active) return;
        setError(err?.message ?? "Unable to load items.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [orderNbrs, session, formData.selectedItems, orderReadyToken]);

  const selectedCount = useMemo(() => {
    return orderGroups.reduce(
      (count, group) => count + group.items.filter((item) => item.selected).length,
      0
    );
  }, [orderGroups]);

  const creditHoldActive = useMemo(() => {
    if (usePublicFlow) return false;
    return orderGroups.some((group) => {
      const status = (group.payment.status ?? "").trim().toLowerCase();
      return status === "credit hold";
    });
  }, [orderGroups, usePublicFlow]);

  useEffect(() => {
    if (creditHoldActive) {
      setCreditHoldOpen(true);
    }
  }, [creditHoldActive]);

  const paymentBlocks = useMemo(() => {
    return orderGroups
      .map((group) => {
        const terms = (group.payment.terms ?? "").trim().toUpperCase();
        if (!PREPAY_TERMS.has(terms)) return null;
        const orderTotal = group.payment.orderTotal ?? 0;
        const unpaidBalance = group.payment.unpaidBalance ?? 0;
        const paid = Math.max(0, orderTotal - unpaidBalance);

        const remainingValueRaw = group.items.reduce((sum, item) => {
          const orderQty = item.orderQty ?? 0;
          const lineAmount = item.lineAmount ?? 0;
          const taxRate = item.taxRate ?? 0;
          if (orderQty <= 0) return sum;
          const perUnitPreTax = lineAmount / orderQty;
          const perUnitTax = perUnitPreTax * (taxRate / 100);
          const openQty = Math.max(0, item.openQty ?? 0);
          const selectedQty = item.selected ? item.qty : 0;
          const remainingQty = Math.max(0, openQty - selectedQty);
          return sum + remainingQty * (perUnitPreTax + perUnitTax);
        }, 0);

        const remainingValue = Math.round(remainingValueRaw * 100) / 100;
        const selectedValueRaw = group.items.reduce((sum, item) => {
          if (!item.selected) return sum;
          const orderQty = item.orderQty ?? 0;
          const lineAmount = item.lineAmount ?? 0;
          const taxRate = item.taxRate ?? 0;
          if (orderQty <= 0) return sum;
          const perUnitPreTax = lineAmount / orderQty;
          const perUnitTax = perUnitPreTax * (taxRate / 100);
          return sum + item.qty * (perUnitPreTax + perUnitTax);
        }, 0);
        const selectedValue = Math.round(selectedValueRaw * 100) / 100;
        const amountOwed =
          remainingValue === 0
            ? Math.max(0, unpaidBalance)
            : Math.max(
                0,
                group.pickedUpValue + selectedValue + remainingValue * 0.5 - paid
              );

        console.log("[prepay-calc]", {
          orderNbr: group.orderNbr,
          orderTotal,
          unpaidBalance,
          paid,
          selectedValue,
          remainingValue,
          pickedUpValue: group.pickedUpValue,
          amountOwed,
          terms,
        });

        if (amountOwed <= 0) return null;
        return {
          orderNbr: group.orderNbr,
          remainingValue,
          selectedValue,
          amountOwed,
          salesPerson: group.salesPerson ?? null,
        };
      })
      .filter(Boolean) as Array<{
      orderNbr: string;
      remainingValue: number;
      selectedValue: number;
      amountOwed: number;
      salesPerson?: {
        number: string;
        name: string | null;
        phone: string | null;
        email: string | null;
      } | null;
    }>;
  }, [orderGroups]);

  const handleToggleOrder = (orderNbr: string) => {
    setOrderGroups((prev) =>
      prev.map((group) =>
        group.orderNbr === orderNbr ? { ...group, expanded: !group.expanded } : group
      )
    );
  };

  const handleToggleItem = (orderNbr: string, lineId: string, checked: boolean) => {
    if (lockSelection) return;
    setOrderGroups((prev) =>
      prev.map((group) => {
        if (group.orderNbr !== orderNbr) return group;
        return {
          ...group,
          items: group.items.map((item) =>
            item.lineId === lineId
              ? { ...item, selected: checked, qty: checked ? item.qty : item.qty }
              : item
          ),
        };
      })
    );
  };

  const handleAdjustQty = (orderNbr: string, lineId: string, delta: number) => {
    if (lockSelection) return;
    setOrderGroups((prev) =>
      prev.map((group) => {
        if (group.orderNbr !== orderNbr) return group;
        return {
          ...group,
          items: group.items.map((item) => {
            if (item.lineId !== lineId) return item;
            if (!item.selected) return item;
            const nextQty = Math.min(item.maxQty, Math.max(1, item.qty + delta));
            return { ...item, qty: nextQty };
          }),
        };
      })
    );
  };

  const handleSelectAllOrder = (orderNbr: string) => {
    if (lockSelection) return;
    setOrderGroups((prev) =>
      prev.map((group) =>
        group.orderNbr === orderNbr
          ? {
              ...group,
              items: group.items.map((item) => ({
                ...item,
                selected: item.isAvailable,
                qty: item.isAvailable ? item.maxQty : item.qty,
              })),
            }
          : group
      )
    );
  };

  const handleSelectAll = () => {
    if (lockSelection) return;
    setOrderGroups((prev) =>
      prev.map((group) => ({
        ...group,
        items: group.items.map((item) => ({
          ...item,
          selected: item.isAvailable,
          qty: item.isAvailable ? item.maxQty : item.qty,
        })),
      }))
    );
  };

  const handleContinue = () => {
    if (creditHoldActive) {
      setCreditHoldOpen(true);
      return;
    }
    if (selectedCount === 0) {
      toast({
        title: "Select at least one item",
        description: "Choose the items you plan to pick up before continuing.",
      });
      return;
    }
    if (paymentBlocks.length > 0) {
      const salesPersonLabel = formatSalespersonContact(paymentBlocks[0]?.salesPerson ?? null);
      toast({
        title: "Payment required before pickup",
        description:
          `Please call (801)-466-0990 Ext. 3 or ${salesPersonLabel} to complete payment.`,
      });
      return;
    }

    const selections: OrderItemSelection[] = orderGroups
      .map((group) => ({
        orderNbr: group.orderNbr,
        items: group.items
          .filter((item) => item.selected)
          .map((item) => ({
            lineId: item.lineId,
            inventoryId: item.inventoryId,
            description: item.description,
            warehouse: item.warehouse,
            maxQty: item.maxQty,
            qty: item.qty,
          })),
      }))
      .filter((group) => group.items.length > 0);

    updateFormData({ selectedItems: selections });
    router.push("/schedule");
  };

  const handleBack = () => {
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <ProgressSteps steps={steps} currentStep={2} />

          <div className="flex justify-between">
            <Button variant="ghost" onClick={handleBack}>
              Back
            </Button>
            <Button variant="hero" onClick={handleContinue} disabled={loading || creditHoldActive}>
              Continue
            </Button>
          </div>

          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle>Select Items for Pickup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {paymentBlocks.length ? (
                <div className="rounded-lg border border-[#d24f39] bg-[#fdf5f2] p-4 text-sm text-[#b13d2b]">
                  <p className="font-semibold text-[#b13d2b]">
                    Prepay balance required.
                  </p>
                  <p className="mt-1 text-xs text-[#b13d2b]">
                    Additional payment is due. To make a payment, please call our accounting team at
                    {" "}(801)-466-0990 Ext. 3 or your salesperson{" "}
                    {formatSalespersonContact(paymentBlocks[0]?.salesPerson ?? null)}.
                  </p>
                  <div className="mt-3 space-y-2 text-xs">
                    {paymentBlocks.map((block) => (
                      <div
                        key={block.orderNbr}
                        className="rounded-md border border-[#f1c3ba] bg-white px-3 py-2"
                      >
                        <div className="font-semibold text-[#7a2b1f]">
                          Order {block.orderNbr}
                        </div>
                        {block.remainingValue === 0 ? (
                          <div className="text-xs text-[#7a2b1f]">
                            All remaining items are selected. Balance due in full.
                          </div>
                        ) : null}
                        <div className="font-semibold">
                          Amount owed: {money.format(block.amountOwed)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] text-[#8f4a3f]">
                    Estimate only. Amount owed is based on current tax rates and available item data.
                    Final balance may vary due to freight or other order adjustments.
                  </p>
                </div>
              ) : null}

              <div className="flex items-center justify-between text-sm">
                <div className="text-muted-foreground">
                  {selectedCount} item{selectedCount === 1 ? "" : "s"} selected
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  className="border-transparent bg-[#d9b45b] text-black hover:bg-[#caa44a]"
                  disabled={lockSelection || orderGroups.every((group) =>
                    group.items.every((item) => !item.isAvailable)
                  )}
                >
                  Select all items
                </Button>
              </div>

              {loading ? (
                <div className="text-sm text-muted-foreground">Loading items...</div>
              ) : error ? (
                <div className="text-sm text-destructive">{error}</div>
              ) : (
                <div className="space-y-4">
                  {orderGroups.map((group) => {
                    const selectedInOrder = group.items.filter((item) => item.selected).length;
                    const availableInOrder = group.items.filter((item) => item.isAvailable).length;
                    return (
                      <div
                        key={group.orderNbr}
                        className="rounded-lg border border-border/60 bg-white"
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleOrder(group.orderNbr)}
                          className="flex w-full items-center justify-between px-4 py-3 text-left"
                        >
                          <div className="flex items-center gap-3">
                            {group.expanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                            <div>
                              <div className="font-semibold text-foreground">Order {group.orderNbr}</div>
                              <div className="text-xs text-muted-foreground">
                                {selectedInOrder} selected / {availableInOrder} available
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleSelectAllOrder(group.orderNbr);
                            }}
                            className="border-transparent bg-[#d9b45b] text-black hover:bg-[#caa44a]"
                            disabled={lockSelection || availableInOrder === 0}
                          >
                            Select all
                          </Button>
                        </button>

                        {group.expanded ? (
                          <div className="border-t border-border/60 px-4 py-3 space-y-3">
                            {group.items.length === 0 ? (
                              <div className="text-sm text-muted-foreground">
                                No items found for this order.
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {availableInOrder === 0 ? (
                                  <div className="rounded-md border border-border/60 bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
                                    No items are available for pickup yet.
                                  </div>
                                ) : null}
                                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-3 text-xs text-muted-foreground">
                                  <span>Item</span>
                                  <span className="text-center">Qty</span>
                                  <span className="text-center">Total on order</span>
                                </div>
                                {group.items.map((item) => (
                                  <div
                                    key={item.lineId}
                                    className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 rounded-md border border-border/60 px-3 py-2 ${
                                      item.isAvailable ? "" : "opacity-50"
                                    } ${lockSelection ? "opacity-60" : ""}`}
                                  >
                                    <label className="flex min-w-0 items-start gap-3">
                                      {item.isAvailable ? (
                                        <Checkbox
                                          checked={item.selected}
                                          onCheckedChange={(checked) =>
                                            handleToggleItem(
                                              group.orderNbr,
                                              item.lineId,
                                              Boolean(checked)
                                            )
                                          }
                                          className="mt-1"
                                          disabled={!item.isAvailable || lockSelection}
                                        />
                                      ) : null}
                                      <div className="min-w-0">
                                        <div className="text-sm font-medium text-foreground truncate">
                                          {item.inventoryId ?? "Item"}
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate">
                                          {item.description ?? "No description"}
                                        </div>
                                        {item.warehouse ? (
                                          <div className="text-xs text-muted-foreground truncate">
                                            Warehouse: {item.warehouse}
                                          </div>
                                        ) : null}
                                      </div>
                                    </label>

                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      {item.isAvailable ? (
                                        <>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() =>
                                              handleAdjustQty(group.orderNbr, item.lineId, -1)
                                            }
                                            disabled={lockSelection || !item.selected || item.qty <= 1}
                                          >
                                            <Minus className="h-3 w-3" />
                                          </Button>
                                          <span className="min-w-[24px] text-center text-sm text-foreground">
                                            {item.qty}
                                          </span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() =>
                                              handleAdjustQty(group.orderNbr, item.lineId, 1)
                                            }
                                            disabled={lockSelection || item.qty >= item.maxQty}
                                          >
                                            <Plus className="h-3 w-3" />
                                          </Button>
                                        </>
                                      ) : (
                                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                          {(item.openQty ?? 0) <= 0
                                            ? "Item already picked up"
                                            : "Item(s) not ready for pick up"}
                                        </span>
                                      )}
                                    </div>

                                    <div className="text-center text-sm font-medium text-foreground">
                                      {item.orderQty}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between mt-8">
            <Button variant="ghost" onClick={handleBack}>
              Back
            </Button>
            <Button variant="hero" onClick={handleContinue} disabled={loading || creditHoldActive}>
              Continue
            </Button>
          </div>
        </div>
      </main>
      <Dialog open={creditHoldOpen} onOpenChange={setCreditHoldOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Account on credit hold</DialogTitle>
            <DialogDescription>
              Your account is on credit hold. No pick ups may be scheduled at this time. Please
              call our accounting team at 801-466-0990 ext. 3 for more information.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setCreditHoldOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ItemSelectionPage;

