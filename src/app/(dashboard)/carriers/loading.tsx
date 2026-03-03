import { Card } from "@/components/ui/card";

function Skel({ className }: { className?: string }) {
  return <div className={"animate-pulse rounded-md bg-muted " + (className || "")} />;
}

export default function CarriersLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div className="space-y-2"><Skel className="h-8 w-32" /><Skel className="h-4 w-56" /></div><Skel className="h-10 w-28" /></div>
      <div className="rounded-md border p-4 space-y-4">
        <div className="grid grid-cols-6 gap-4">{[1,2,3,4,5,6].map((i) => (<Skel key={i} className="h-4" />))}</div>
        {[1,2,3,4,5].map((i) => (<div key={i} className="grid grid-cols-6 gap-4 py-3 border-t">{[1,2,3,4,5,6].map((j) => (<Skel key={j} className="h-4" />))}</div>))}
      </div>
    </div>
  );
}
