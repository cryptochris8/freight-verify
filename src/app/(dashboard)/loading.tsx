import { Card, CardContent, CardHeader } from "@/components/ui/card";

function Skel({ className }: { className?: string }) {
  return <div className={"animate-pulse rounded-md bg-muted " + (className || "")} />;
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2"><Skel className="h-8 w-48" /><Skel className="h-4 w-72" /></div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1,2,3,4].map((i) => (<Card key={i}><CardHeader className="pb-2"><Skel className="h-4 w-24" /></CardHeader><CardContent><Skel className="h-8 w-16" /><Skel className="h-3 w-32 mt-2" /></CardContent></Card>))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><Skel className="h-5 w-36" /></CardHeader><CardContent className="space-y-3">{[1,2,3].map((i) => (<Skel key={i} className="h-16 w-full" />))}</CardContent></Card>
        <Card><CardHeader><Skel className="h-5 w-36" /></CardHeader><CardContent className="space-y-3">{[1,2,3].map((i) => (<Skel key={i} className="h-16 w-full" />))}</CardContent></Card>
      </div>
    </div>
  );
}
