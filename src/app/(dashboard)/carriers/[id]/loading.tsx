import { Card, CardContent, CardHeader } from "@/components/ui/card";

function Skel({ className }: { className?: string }) {
  return <div className={"animate-pulse rounded-md bg-muted " + (className || "")} />;
}

export default function CarrierDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skel className="h-8 w-48" />
            <Skel className="h-5 w-20 rounded-full" />
          </div>
          <Skel className="h-4 w-64" />
        </div>
        <Skel className="h-9 w-28" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2"><Skel className="h-4 w-24" /></CardHeader>
            <CardContent><Skel className="h-6 w-32" /></CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><Skel className="h-5 w-36" /></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map((i) => (<Skel key={i} className="h-12 w-full" />))}
        </CardContent>
      </Card>
    </div>
  );
}
