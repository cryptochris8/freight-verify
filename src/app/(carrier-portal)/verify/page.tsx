import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CarrierVerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Carrier Verification Portal</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Carrier-facing portal for pickup verification and document uploads.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}