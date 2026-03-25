function Skel({ className }: { className?: string }) {
  return <div className={"animate-pulse rounded-md bg-muted " + (className || "")} />;
}

export default function DriverLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-1">
          <Skel className="h-6 w-32 mx-auto" />
          <Skel className="h-4 w-24 mx-auto" />
        </div>
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <Skel className="h-5 w-28" />
            <Skel className="h-5 w-16 rounded-full" />
          </div>
          <div className="space-y-3">
            <Skel className="h-12 w-full" />
            <Skel className="h-10 w-full" />
            <Skel className="h-10 w-full" />
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <Skel className="h-20 w-full" />
        </div>
      </div>
    </div>
  );
}
