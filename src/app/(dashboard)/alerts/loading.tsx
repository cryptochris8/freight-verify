import { Card, CardContent } from "@/components/ui/card";

function Skel({ className }: { className?: string }) {
  return <div className={"animate-pulse rounded-md bg-muted " + (className || "")} />;
}

export default function AlertsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2"><Skel className="h-8 w-24" /><Skel className="h-4 w-56" /></div>
      <div className="grid gap-4 md:grid-cols-5">{[1,2,3,4,5].map((i) => (<Card key={i}><CardContent className="pt-6"><Skel className="h-4 w-16 mb-2" /><Skel className="h-8 w-12" /></CardContent></Card>))}</div>
      <div className="flex gap-3">{[1,2,3].map((i) => (<Skel key={i} className="h-9 w-32" />))}</div>
      <div className="rounded-md border p-4 space-y-4">{[1,2,3,4,5].map((i) => (<div key={i} className="flex items-center gap-4 py-3 border-b"><Skel className="h-6 w-6 rounded-full" /><div className="flex-1 space-y-1"><Skel className="h-4 w-48" /><Skel className="h-3 w-full" /></div><Skel className="h-6 w-16" /></div>))}</div>
    </div>
  );
}
