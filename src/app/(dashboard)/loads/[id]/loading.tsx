import { Card, CardContent, CardHeader } from "@/components/ui/card";

function Skel({ className }: { className?: string }) {
  return <div className={"animate-pulse rounded-md bg-muted " + (className || "")} />;
}

export default function LoadDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skel className="h-8 w-40" />
            <Skel className="h-5 w-20 rounded-full" />
          </div>
          <Skel className="h-4 w-56" />
        </div>
        <div className="flex gap-2">
          <Skel className="h-9 w-24" />
          <Skel className="h-9 w-24" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><Skel className="h-5 w-28" /></CardHeader>
          <CardContent className="space-y-4">
            <Skel className="h-14 w-full" />
            <Skel className="h-4 w-8 mx-auto" />
            <Skel className="h-14 w-full" />
            <Skel className="h-px w-full" />
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (<Skel key={i} className="h-10 w-full" />))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><Skel className="h-5 w-32" /></CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3].map((i) => (<Skel key={i} className="h-16 w-full" />))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><Skel className="h-5 w-24" /></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (<Skel key={i} className="h-12 w-full" />))}
        </CardContent>
      </Card>
    </div>
  );
}
