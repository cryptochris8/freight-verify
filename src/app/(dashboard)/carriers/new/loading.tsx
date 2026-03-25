import { Card, CardContent, CardHeader } from "@/components/ui/card";

function Skel({ className }: { className?: string }) {
  return <div className={"animate-pulse rounded-md bg-muted " + (className || "")} />;
}

export default function NewCarrierLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2"><Skel className="h-8 w-36" /><Skel className="h-4 w-56" /></div>
      <Card>
        <CardHeader><Skel className="h-5 w-32" /></CardHeader>
        <CardContent className="space-y-4">
          <Skel className="h-10 w-full" />
          <Skel className="h-10 w-full" />
          <Skel className="h-10 w-full" />
          <Skel className="h-10 w-full" />
          <Skel className="h-10 w-full" />
          <Skel className="h-10 w-32" />
        </CardContent>
      </Card>
    </div>
  );
}
