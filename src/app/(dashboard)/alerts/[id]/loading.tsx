import { Card, CardContent, CardHeader } from "@/components/ui/card";

function Skel({ className }: { className?: string }) {
  return <div className={"animate-pulse rounded-md bg-muted " + (className || "")} />;
}

export default function AlertDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Skel className="h-8 w-48" />
          <Skel className="h-5 w-16 rounded-full" />
          <Skel className="h-5 w-20 rounded-full" />
        </div>
        <Skel className="h-4 w-72" />
      </div>
      <Card>
        <CardHeader><Skel className="h-5 w-28" /></CardHeader>
        <CardContent className="space-y-3">
          <Skel className="h-16 w-full" />
          <Skel className="h-10 w-full" />
          <Skel className="h-10 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><Skel className="h-5 w-24" /></CardHeader>
        <CardContent><Skel className="h-24 w-full" /></CardContent>
      </Card>
    </div>
  );
}
