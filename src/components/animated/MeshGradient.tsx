"use client";

export function MeshGradient() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden>
      <div className="absolute -top-1/4 -right-1/4 w-1/2 aspect-square rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-[120px] animate-mesh-orb" />
      <div className="absolute -bottom-1/4 -left-1/4 w-1/2 aspect-square rounded-full bg-gradient-to-tr from-cyan-500/15 to-transparent blur-[120px] animate-mesh-orb-delayed" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-1/3 aspect-square rounded-full bg-gradient-to-r from-primary/10 to-cyan-500/10 blur-[100px] animate-mesh-orb-slow" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,var(--color-background)_100%)]" />
    </div>
  );
}
