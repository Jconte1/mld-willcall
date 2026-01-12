"use client";

import React from "react";
import Header from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SmsConsentPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-10">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>SMS Consent for Pickup Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Customers can opt in to receive SMS notifications during the pickup scheduling
                confirmation step. SMS is used only for operational updates related to pickup
                appointments (confirmation, reminders, reschedules, and cancellations). No marketing
                messages are sent.
              </p>

              <div className="rounded-lg border border-border/60 bg-background/80 p-4">
                <p className="font-medium text-foreground mb-2">Consent language shown:</p>
                <p>
                  "I agree to receive pickup appointment notifications by SMS at the number provided.
                  Message and data rates may apply. Reply STOP to opt out."
                </p>
                <p className="mt-2 text-xs">
                  "SMS is used only for pickup appointment updates (confirmation, reminders,
                  reschedules, cancellations). No marketing messages."
                </p>
              </div>

              <p>
                The checkbox is presented on the confirmation page where customers enter their name,
                phone number, email, and vehicle description. Consent is captured only when the
                checkbox is selected.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default SmsConsentPage;
