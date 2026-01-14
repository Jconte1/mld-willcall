import Link from "next/link";
import Header from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type UnsubscribePageProps = {
  searchParams?: { status?: string };
};

export default function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  const status = searchParams?.status ?? "success";
  const isSuccess = status === "success";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="flex items-center justify-center py-16 px-4">
        <Card className="w-full max-w-lg shadow-xl">
          <CardHeader>
            <CardTitle>{isSuccess ? "Unsubscribed" : "Unable to unsubscribe"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            {isSuccess ? (
              <p>
                You will no longer receive email updates for this appointment. You can still manage
                your appointment using your secure link.
              </p>
            ) : (
              <p>
                This unsubscribe link is invalid or expired. Please use the most recent email link or
                contact support.
              </p>
            )}
            <div>
              <Button asChild variant="outline">
                <Link href="/">Go to homepage</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
