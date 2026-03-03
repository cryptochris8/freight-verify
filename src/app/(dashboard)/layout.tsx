"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Truck, Package, Activity, AlertTriangle, Settings, LayoutDashboard, Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Carriers", href: "/carriers", icon: Truck },
  { label: "Loads", href: "/loads", icon: Package },
  { label: "Events", href: "/events", icon: Activity },
  { label: "Alerts", href: "/alerts", icon: AlertTriangle },
  { label: "Settings", href: "/settings", icon: Settings },
];

function SidebarContent() {
  const pathname = usePathname();
  const [alertCount, setAlertCount] = useState(0);
  const [eventCount, setEventCount] = useState(0);

  useEffect(() => {
    fetch("/api/nav-badges")
      .then((res) => res.ok ? res.json() : { alerts: 0, events: 0 })
      .then((data) => {
        setAlertCount(data.alerts ?? 0);
        setEventCount(data.events ?? 0);
      })
      .catch(() => {});
  }, [pathname]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tight">FreightVerify</h1>
        <p className="text-sm text-muted-foreground">Carrier Verification Platform</p>
      </div>
      <Separator />
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const badgeCount = item.href === "/alerts" ? alertCount : item.href === "/events" ? eventCount : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-4 w-4" />
                {item.label}
              </div>
              {badgeCount > 0 && (
                <Badge variant={item.href === "/alerts" ? "destructive" : "secondary"} className="text-xs px-1.5 py-0 min-w-[20px] justify-center">
                  {badgeCount}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <aside className="hidden md:flex w-64 flex-col border-r bg-card">
        <SidebarContent />
      </aside>
      <Sheet>
        <div className="flex flex-col flex-1">
          <header className="flex items-center gap-4 border-b px-4 py-3 md:hidden">
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <h1 className="text-lg font-bold">FreightVerify</h1>
          </header>
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </div>
  );
}
