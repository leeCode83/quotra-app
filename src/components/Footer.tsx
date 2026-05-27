import Link from "next/link";
import { Zap } from "lucide-react";

const footerLinks = [
  {
    title: "Platform",
    links: [
      { href: "/marketplace", label: "Marketplace" },
      { href: "/dashboard/provider", label: "For Providers" },
      { href: "/dashboard/consumer", label: "For Consumers" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "#", label: "Documentation" },
      { href: "#", label: "API Reference" },
      { href: "#", label: "GitHub" },
    ],
  },
  {
    title: "Community",
    links: [
      { href: "#", label: "Discord" },
      { href: "#", label: "Twitter" },
      { href: "#", label: "Blog" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl">
              <Zap className="h-6 w-6 text-primary" />
              <span>Quotra</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs">
              Decentralized P2P AI API marketplace. Connect AI providers with consumers through trustless escrow on Base.
            </p>
          </div>

          {footerLinks.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold mb-3">{section.title}</h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Quotra. All rights reserved.
          </p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href="#" className="hover:text-primary transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-primary transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}