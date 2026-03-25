import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center py-8 text-center">
          <div className="rounded-full bg-muted p-3 mb-4">
            <FileQuestion className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Page not found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
