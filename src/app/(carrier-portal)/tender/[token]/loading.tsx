function Skel({ className }: { className?: string }) {
  return <div className={"animate-pulse rounded-md bg-muted " + (className || "")} />;
}

export default function TenderLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-muted/30">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-1">
          <Skel className="h-7 w-36 mx-auto" />
          <Skel className="h-4 w-24 mx-auto" />
        </div>
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <Skel className="h-6 w-32" />
            <Skel className="h-5 w-16 rounded-full" />
          </div>
          <div className="space-y-3">
            <Skel className="h-14 w-full" />
            <Skel className="h-4 w-8 mx-auto" />
            <Skel className="h-14 w-full" />
          </div>
          <Skel className="h-px w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skel className="h-12 w-full" />
            <Skel className="h-12 w-full" />
            <Skel className="h-12 w-full" />
            <Skel className="h-12 w-full" />
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          <Skel className="h-10 w-28" />
          <Skel className="h-10 w-28" />
        </div>
      </div>
    </div>
  );
}
