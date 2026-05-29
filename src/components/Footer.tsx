"use client";

import Link from "next/link";
import { Zap, Code2, Globe, MessageCircle, Mail, MapPin } from "lucide-react";
import { TextHoverEffect, FooterBackgroundGradient } from "@/components/ui/hover-footer";
import { Button } from "@/components/ui/button";

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
      { href: "/docs", label: "Documentation" },
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

const contactInfo = [
  { icon: <Mail size={18} className="text-primary" />, text: "hello@quotra.io", href: "mailto:hello@quotra.io" },
  { icon: <MapPin size={18} className="text-primary" />, text: "Built on Base" },
];

const socialLinks = [
  { icon: <Code2 size={20} />, label: "GitHub", href: "#" },
  { icon: <Globe size={20} />, label: "Twitter", href: "#" },
  { icon: <MessageCircle size={20} />, label: "Discord", href: "#" },
];

export function Footer() {
  return (
    <footer className="relative overflow-hidden rounded-3xl mx-4 md:mx-8 mb-8 border border-primary/10">
      <div className="max-w-7xl mx-auto px-6 md:px-14 py-14 z-40 relative">
        {/* CTA Section (merged from CTASection) */}
        <div className="text-center space-y-6 pb-16">
          <h2 className="text-3xl md:text-4xl font-display font-bold">
            Ready to get started?
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Whether you&apos;re an AI provider looking to monetize your models or a consumer
            seeking affordable AI access, Quotra has you covered.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <Button size="lg" asChild>
              <Link href="/dashboard/provider">Start as Provider</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/dashboard/consumer">Start as Consumer</Link>
            </Button>
          </div>
        </div>

        <hr className="border-t border-primary/10 my-12" />

        {/* Footer grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 md:gap-8 lg:gap-16 pb-12">
          {/* Brand */}
          <div className="flex flex-col space-y-4 lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl">
              <Zap className="h-6 w-6 text-primary" />
              <span>Quotra</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs">
              Decentralized P2P AI API marketplace. Connect AI providers with consumers through trustless escrow on Base.
            </p>
            <ul className="space-y-3 pt-2">
              {contactInfo.map((item, i) => (
                <li key={i} className="flex items-center space-x-3 text-sm text-muted-foreground">
                  {item.icon}
                  {item.href ? (
                    <a href={item.href} className="hover:text-primary transition-colors">{item.text}</a>
                  ) : (
                    <span>{item.text}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Link sections */}
          {footerLinks.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold mb-5">{section.title}</h3>
              <ul className="space-y-3">
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

        <hr className="border-t border-primary/10 my-8" />

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row justify-between items-center text-sm space-y-4 md:space-y-0">
          <div className="flex space-x-5 text-muted-foreground">
            {socialLinks.map(({ icon, label, href }) => (
              <a key={label} href={href} aria-label={label} className="hover:text-primary transition-colors">
                {icon}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <Link href="#" className="text-muted-foreground hover:text-primary transition-colors">Privacy</Link>
            <Link href="#" className="text-muted-foreground hover:text-primary transition-colors">Terms</Link>
            <span className="text-muted-foreground">
              &copy; {new Date().getFullYear()} Quotra. All rights reserved.
            </span>
          </div>
        </div>
      </div>

      {/* Text hover effect */}
      <div className="hidden lg:flex h-[30rem] -mt-52 -mb-36">
        <TextHoverEffect text="Quotra" className="z-50" />
      </div>

      <FooterBackgroundGradient />
    </footer>
  );
}
