import { Card, CardContent, CardHeader } from "@/components/ui/card";

function Skel({ className }: { className?: string }) {
  return <div className={"animate-pulse rounded-md bg-muted " + (className || "")} />;
}

export default function LoadsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div className="space-y-2"><Skel className="h-8 w-24" /><Skel className="h-4 w-64" /></div><Skel className="h-10 w-32" /></div>
      <div className="grid gap-4 md:grid-cols-4">{[1,2,3,4].map((i) => (<Card key={i}><CardHeader className="pb-2"><Skel className="h-4 w-24" /></CardHeader><CardContent><Skel className="h-8 w-16" /></CardContent></Card>))}</div>
      <Skel className="h-10 w-full" />
      <div className="rounded-md border p-4 space-y-4">{[1,2,3,4,5].map((i) => (<div key={i} className="grid grid-cols-6 gap-4 py-3 border-b">{[1,2,3,4,5,6].map((j) => (<Skel key={j} className="h-4" />))}</div>))}</div>
    </div>
  );
}
