import { Card, CardContent, CardHeader } from "@/components/ui/card";

function Skel({ className }: { className?: string }) {
  return <div className={"animate-pulse rounded-md bg-muted " + (className || "")} />;
}

export default function NewLoadLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2"><Skel className="h-8 w-36" /><Skel className="h-4 w-64" /></div>
      <Card>
        <CardHeader><Skel className="h-5 w-28" /></CardHeader>
        <CardContent className="space-y-4">
          <Skel className="h-10 w-full" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skel className="h-10 w-full" />
            <Skel className="h-10 w-full" />
            <Skel className="h-10 w-full" />
            <Skel className="h-10 w-full" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Skel className="h-10 w-full" />
            <Skel className="h-10 w-full" />
          </div>
          <Skel className="h-10 w-full" />
          <Skel className="h-20 w-full" />
          <Skel className="h-10 w-32" />
        </CardContent>
      </Card>
    </div>
  );
}
