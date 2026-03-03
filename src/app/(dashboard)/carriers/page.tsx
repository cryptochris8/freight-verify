import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import Link from "next/link";

// Placeholder data for initial scaffold
const carriers: {
  id: string;
  legalName: string;
  dotNumber: string;
  mcNumber: string;
  status: string;
  lastVerified: string;
  fleetSize: number;
}[] = [];

function getStatusVariant(status: string) {
  switch (status) {
    case "verified":
      return "default" as const;
    case "pending":
      return "secondary" as const;
    case "flagged":
    case "suspended":
      return "destructive" as const;
    case "expired":
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

export default function CarriersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Carriers</h2>
          <p className="text-muted-foreground">
            Manage and verify your carrier network.
          </p>
        </div>
        <Link href="/carriers/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Carrier
          </Button>
        </Link>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Legal Name</TableHead>
              <TableHead>DOT #</TableHead>
              <TableHead>MC #</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Verified</TableHead>
              <TableHead className="text-right">Fleet Size</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {carriers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No carriers found. Add your first carrier to get started.
                </TableCell>
              </TableRow>
            ) : (
              carriers.map((carrier) => (
                <TableRow key={carrier.id}>
                  <TableCell className="font-medium">
                    <Link href={"/carriers/" + carrier.id} className="hover:underline">
                      {carrier.legalName}
                    </Link>
                  </TableCell>
                  <TableCell>{carrier.dotNumber}</TableCell>
                  <TableCell>{carrier.mcNumber || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(carrier.status)}>
                      {carrier.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{carrier.lastVerified || "Never"}</TableCell>
                  <TableCell className="text-right">{carrier.fleetSize}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
