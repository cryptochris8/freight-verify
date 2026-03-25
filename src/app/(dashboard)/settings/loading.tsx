import { Card, CardContent, CardHeader } from "@/components/ui/card";

function Skel({ className }: { className?: string }) {
  return <div className={"animate-pulse rounded-md bg-muted " + (className || "")} />;
}

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2"><Skel className="h-8 w-28" /><Skel className="h-4 w-64" /></div>
      <Card>
        <CardHeader><Skel className="h-5 w-44" /></CardHeader>
        <CardContent className="space-y-4">
          <Skel className="h-10 w-full" />
          <Skel className="h-10 w-full" />
          <Skel className="h-10 w-32" />
        </CardContent>
      </Card>
      <Skel className="h-px w-full" />
      <Card>
        <CardHeader><Skel className="h-5 w-48" /></CardHeader>
        <CardContent className="space-y-4">
          <Skel className="h-16 w-full" />
          <Skel className="h-10 w-40" />
        </CardContent>
      </Card>
    </div>
  );
}
