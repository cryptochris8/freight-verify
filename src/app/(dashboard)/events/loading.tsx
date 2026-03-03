import { Card, CardContent, CardHeader } from "@/components/ui/card";

function Skel({ className }: { className?: string }) {
  return <div className={"animate-pulse rounded-md bg-muted " + (className || "")} />;
}

export default function EventsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div className="space-y-2"><Skel className="h-8 w-28" /><Skel className="h-4 w-72" /></div><Skel className="h-10 w-28" /></div>
      <Skel className="h-10 w-full" />
      <Card><CardHeader><Skel className="h-5 w-32" /></CardHeader><CardContent className="space-y-4">{[1,2,3,4,5,6].map((i) => (<div key={i} className="flex items-start gap-4 py-3 border-b last:border-0"><Skel className="h-8 w-8 rounded-full" /><div className="flex-1 space-y-2"><Skel className="h-4 w-48" /><Skel className="h-3 w-full" /><Skel className="h-3 w-24" /></div></div>))}</CardContent></Card>
    </div>
  );
}
