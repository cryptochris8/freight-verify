import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link href="/" className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">FreightVerify</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/login"><Button variant="ghost" size="sm">Log In</Button></Link>
            <Link href="/signup"><Button size="sm">Sign Up</Button></Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t py-8 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 mb-3"><Shield className="h-5 w-5 text-primary" /><span className="font-bold">FreightVerify</span></div>
              <p className="text-sm text-muted-foreground">Carrier verification and chain-of-custody for freight brokers.</p>
            </div>
            <div><h4 className="font-semibold mb-3 text-sm">Product</h4><ul className="space-y-2 text-sm text-muted-foreground"><li><Link href="/pricing" className="hover:text-foreground">Pricing</Link></li><li><span>Features</span></li><li><span>Security</span></li></ul></div>
            <div><h4 className="font-semibold mb-3 text-sm">Company</h4><ul className="space-y-2 text-sm text-muted-foreground"><li><span>About</span></li><li><span>Blog</span></li><li><span>Careers</span></li></ul></div>
            <div><h4 className="font-semibold mb-3 text-sm">Legal</h4><ul className="space-y-2 text-sm text-muted-foreground"><li><span>Privacy Policy</span></li><li><span>Terms of Service</span></li></ul></div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground"><p>FreightVerify. All rights reserved.</p></div>
        </div>
      </footer>
    </div>
  );
}
