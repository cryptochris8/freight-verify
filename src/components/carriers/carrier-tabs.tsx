"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, FileText, History, Package, AlertTriangle, ExternalLink } from "lucide-react";
import Link from "next/link";

interface CarrierDocument { id: string; docType: string; fileName: string; verified: boolean | null; expiresAt: string | null; createdAt: string | null; }
interface CarrierVerification { id: string; checkType: string; status: string | null; createdAt: string | null; }
interface CarrierLoad { id: string; referenceNumber: string | null; status: string | null; originName: string | null; destinationName: string | null; pickupDate: string | null; }
interface CarrierAlert { id: string; alertType: string; severity: string; title: string; status: string | null; createdAt: string | null; }

interface CarrierTabsProps {
  carrier: {
    id: string; dotNumber: string; mcNumber: string | null; legalName: string | null; dbaName: string | null;
    phone: string | null; email: string | null; status: string | null; safetyRating: string | null;
    insuranceOnFile: boolean | null; fleetSize: number | null; fmcsaLastCheck: string | null;
    fmcsaSnapshot: unknown; address: unknown;
  };
  documents: CarrierDocument[];
  verifications: CarrierVerification[];
  loads: CarrierLoad[];
  alerts: CarrierAlert[];
}

function fmtD(d: string | null): string {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function expiringSoon(d: string | null): boolean { if (!d) return false; const diff = new Date(d).getTime() - Date.now(); return diff > 0 && diff < 30*24*60*60*1000; }
function expired(d: string | null): boolean { if (!d) return false; return new Date(d).getTime() < Date.now(); }
function statusV(s: string | null) { switch (s) { case "verified": case "passed": return "default" as const; case "pending": return "secondary" as const; case "failed": case "flagged": case "suspended": return "destructive" as const; default: return "outline" as const; } }
function sevBadge(sev: string) { switch (sev) { case "critical": return <Badge variant="destructive">Critical</Badge>; case "high": return <Badge className="bg-orange-500 text-white">High</Badge>; case "medium": return <Badge className="bg-yellow-500 text-white">Medium</Badge>; default: return <Badge variant="secondary">{sev}</Badge>; } }

export function CarrierTabs({ carrier, documents, verifications, loads, alerts }: CarrierTabsProps) {
  const address = carrier.address as Record<string, string> | null;
  const openAlerts = alerts.filter((a) => a.status !== "acknowledged").length;
  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="documents">Documents {documents.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{documents.length}</Badge>}</TabsTrigger>
        <TabsTrigger value="history">Verification History</TabsTrigger>
        <TabsTrigger value="loads">Loads {loads.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{loads.length}</Badge>}</TabsTrigger>
        <TabsTrigger value="alerts">Alerts {openAlerts > 0 && <Badge variant="destructive" className="ml-1 text-xs">{openAlerts}</Badge>}</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <div className="grid gap-4 md:grid-cols-2">
          <Card><CardHeader><CardTitle className="text-base">FMCSA Information</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-muted-foreground text-xs">DOT Number</p><p className="font-medium">{carrier.dotNumber}</p></div><div><p className="text-muted-foreground text-xs">MC Number</p><p className="font-medium">{carrier.mcNumber || "N/A"}</p></div><div><p className="text-muted-foreground text-xs">Safety Rating</p><p className="font-medium">{carrier.safetyRating || "None"}</p></div><div><p className="text-muted-foreground text-xs">Fleet Size</p><p className="font-medium">{carrier.fleetSize ?? "Unknown"}</p></div><div><p className="text-muted-foreground text-xs">Phone</p><p className="font-medium">{carrier.phone || "N/A"}</p></div><div><p className="text-muted-foreground text-xs">Email</p><p className="font-medium">{carrier.email || "N/A"}</p></div></div>{address && <div className="text-sm"><p className="text-muted-foreground text-xs">Address</p><p className="font-medium">{[address.street, address.city, address.state, address.zip].filter(Boolean).join(", ")}</p></div>}<div className="text-sm"><p className="text-muted-foreground text-xs">Last FMCSA Check</p><p className="font-medium">{fmtD(carrier.fmcsaLastCheck)}</p></div></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Quick Stats</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Status</span><Badge variant={statusV(carrier.status)}>{carrier.status || "pending"}</Badge></div><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Insurance</span><span className="text-sm font-medium">{carrier.insuranceOnFile ? "Yes" : "No"}</span></div><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Loads</span><span className="text-sm font-medium">{loads.length}</span></div><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Open Alerts</span><span className="text-sm font-medium">{openAlerts}</span></div><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Documents</span><span className="text-sm font-medium">{documents.length}</span></div></CardContent></Card>
        </div>
      </TabsContent>
      <TabsContent value="documents"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-5 w-5" /> Documents</CardTitle></CardHeader><CardContent>{documents.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No documents uploaded.</p> : <div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>Type</TableHead><TableHead>File</TableHead><TableHead>Verified</TableHead><TableHead>Expires</TableHead><TableHead>Uploaded</TableHead></TableRow></TableHeader><TableBody>{documents.map((doc) => <TableRow key={doc.id}><TableCell className="font-medium">{doc.docType.replace(/_/g, " ")}</TableCell><TableCell>{doc.fileName}</TableCell><TableCell>{doc.verified ? <Badge variant="default" className="gap-1"><ShieldCheck className="h-3 w-3" /> Yes</Badge> : <Badge variant="secondary">No</Badge>}</TableCell><TableCell>{doc.expiresAt ? <span className={expired(doc.expiresAt) ? "text-red-600 font-medium" : expiringSoon(doc.expiresAt) ? "text-yellow-600 font-medium" : ""}>{fmtD(doc.expiresAt)}{expired(doc.expiresAt) && " (Expired)"}{expiringSoon(doc.expiresAt) && " (Expiring)"}</span> : "N/A"}</TableCell><TableCell className="text-muted-foreground">{fmtD(doc.createdAt)}</TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card></TabsContent>
      <TabsContent value="history"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="h-5 w-5" /> Verification History</CardTitle></CardHeader><CardContent>{verifications.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No verifications recorded.</p> : <div className="space-y-3">{verifications.map((v) => <div key={v.id} className="flex items-center justify-between p-3 border rounded-lg"><div><p className="text-sm font-medium">{v.checkType.replace(/_/g, " ")}</p><p className="text-xs text-muted-foreground">{fmtD(v.createdAt)}</p></div><Badge variant={statusV(v.status)}>{v.status || "pending"}</Badge></div>)}</div>}</CardContent></Card></TabsContent>
      <TabsContent value="loads"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Package className="h-5 w-5" /> Loads</CardTitle></CardHeader><CardContent>{loads.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No loads assigned.</p> : <div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>Ref</TableHead><TableHead>Status</TableHead><TableHead>Origin</TableHead><TableHead>Dest</TableHead><TableHead>Pickup</TableHead></TableRow></TableHeader><TableBody>{loads.map((ld) => <TableRow key={ld.id}><TableCell><Link href={"/loads/" + ld.id} className="text-blue-600 hover:underline flex items-center gap-1">{ld.referenceNumber || ld.id.slice(0, 8)} <ExternalLink className="h-3 w-3" /></Link></TableCell><TableCell><Badge variant={statusV(ld.status)}>{(ld.status || "draft").replace(/_/g, " ")}</Badge></TableCell><TableCell className="text-sm">{ld.originName || "N/A"}</TableCell><TableCell className="text-sm">{ld.destinationName || "N/A"}</TableCell><TableCell className="text-sm text-muted-foreground">{fmtD(ld.pickupDate)}</TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card></TabsContent>
      <TabsContent value="alerts"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-5 w-5" /> Alerts</CardTitle></CardHeader><CardContent>{alerts.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No alerts.</p> : <div className="space-y-2">{alerts.map((al) => <Link key={al.id} href={"/alerts/" + al.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"><div className="flex items-center gap-3">{sevBadge(al.severity)}<div><p className="text-sm font-medium">{al.title}</p><p className="text-xs text-muted-foreground">{fmtD(al.createdAt)}</p></div></div><Badge variant={al.status === "acknowledged" ? "outline" : "secondary"}>{al.status === "acknowledged" ? "Acknowledged" : "New"}</Badge></Link>)}</div>}</CardContent></Card></TabsContent>
    </Tabs>
  );
}
