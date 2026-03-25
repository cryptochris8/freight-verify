import { Card, CardContent } from "@/components/ui/card";

function Skel({ className }: { className?: string }) {
  return <div className={"animate-pulse rounded-md bg-muted " + (className || "")} />;
}

export default function OnboardingLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 py-8">
      <div className="text-center space-y-2">
        <Skel className="h-8 w-56 mx-auto" />
        <Skel className="h-4 w-72 mx-auto" />
      </div>
      <Skel className="h-2 w-full rounded-full" />
      <Card>
        <CardContent className="py-8 space-y-4">
          <Skel className="h-6 w-40 mx-auto" />
          <Skel className="h-4 w-80 mx-auto" />
          <Skel className="h-32 w-full" />
          <Skel className="h-10 w-32 mx-auto" />
        </CardContent>
      </Card>
    </div>
  );
}
