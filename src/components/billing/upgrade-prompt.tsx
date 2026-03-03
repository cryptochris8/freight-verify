"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import Link from "next/link";

interface UpgradePromptProps { feature: string; message: string; currentUsage?: number; limit?: number; }

export function UpgradePrompt({ feature, message, currentUsage, limit }: UpgradePromptProps) {
  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900"><Zap className="h-4 w-4 text-amber-600" /></div>
          <div>
            <p className="text-sm font-medium">{message}</p>
            {currentUsage !== undefined && limit !== undefined && (<p className="text-xs text-muted-foreground">{"Current usage: " + currentUsage + " / " + limit}</p>)}
          </div>
        </div>
        <Link href="/settings"><Button size="sm" variant="default">Upgrade Plan</Button></Link>
      </CardContent>
    </Card>
  );
}
