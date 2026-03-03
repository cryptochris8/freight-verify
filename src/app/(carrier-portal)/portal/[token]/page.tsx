import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, FileText, Upload, Clock, CheckCircle, AlertCircle } from "lucide-react";

interface PortalPageProps {
  params: Promise<{ token: string }>;
}

export default async function CarrierPortalPage({ params }: PortalPageProps) {
  const { token } = await params;
  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2"><Shield className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">FreightVerify</h1></div>
          <p className="text-muted-foreground">Carrier Self-Service Portal</p>
        </div>
        <Card>
          <CardHeader><div className="flex items-center justify-between"><CardTitle>Carrier Profile</CardTitle><Badge variant="secondary">Pending Verification</Badge></div></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Your carrier profile is being reviewed. Complete the steps below to expedite verification.</p>
            <div className="grid gap-3">
              <div className="flex items-center gap-3 p-3 rounded-lg border"><CheckCircle className="h-5 w-5 text-green-600" /><div className="flex-1"><p className="text-sm font-medium">FMCSA Lookup</p><p className="text-xs text-muted-foreground">Operating authority verified</p></div><Badge variant="outline" className="text-green-600">Complete</Badge></div>
              <div className="flex items-center gap-3 p-3 rounded-lg border"><Clock className="h-5 w-5 text-amber-600" /><div className="flex-1"><p className="text-sm font-medium">Insurance Certificate</p><p className="text-xs text-muted-foreground">Upload current certificate of insurance</p></div><Badge variant="outline" className="text-amber-600">Required</Badge></div>
              <div className="flex items-center gap-3 p-3 rounded-lg border"><Clock className="h-5 w-5 text-amber-600" /><div className="flex-1"><p className="text-sm font-medium">W-9 Form</p><p className="text-xs text-muted-foreground">Upload signed W-9</p></div><Badge variant="outline" className="text-amber-600">Required</Badge></div>
              <div className="flex items-center gap-3 p-3 rounded-lg border"><AlertCircle className="h-5 w-5 text-muted-foreground" /><div className="flex-1"><p className="text-sm font-medium">Operating Authority</p><p className="text-xs text-muted-foreground">Upload MC/FF authority letter</p></div><Badge variant="outline">Optional</Badge></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Upload Documents</CardTitle></CardHeader>
          <CardContent>
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium mb-1">Drag and drop files here</p>
              <p className="text-xs text-muted-foreground mb-3">PDF, JPG, or PNG up to 10MB</p>
              <Button variant="outline" size="sm">Browse Files</Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Load History</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground text-center py-4">No load history with this broker yet.</p></CardContent>
        </Card>
      </div>
    </div>
  );
}
