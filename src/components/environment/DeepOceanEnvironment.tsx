"use client";

import React from "react";

/**
 * DeepOceanEnvironment
 *
 * Cinematic deep-ocean intelligence environment matching the reference design:
 * - Base seabed rock silhouette & volumetric sunlight rays asset (/images/underwater-bg.jpg)
 * - Layered deep navy-to-black gradient vignette
 * - Subtle underwater atmospheric haze & light scattering
 * - Floating micro-particles (marine snow)
 */

const PARTICLES = Array.from({ length: 26 }, (_, i) => ({
  id: i,
  left: `${(i * 37 + 11) % 100}%`,
  top: `${(i * 53 + 7) % 100}%`,
  size: i % 5 === 0 ? 3 : i % 3 === 0 ? 2 : 1.5,
  opacity: i % 4 === 0 ? 0.45 : i % 3 === 0 ? 0.3 : 0.18,
  duration: 14 + (i % 7) * 4,
  delay: (i % 9) * 1.5,
  driftX: (i % 2 === 0 ? 1 : -1) * (8 + (i % 5) * 4),
  driftY: -(15 + (i % 6) * 6),
}));

export function DeepOceanEnvironment() {
  return (
    <div
      className="deep-ocean-env pointer-events-none absolute inset-0 z-0 h-full w-full overflow-hidden"
      aria-hidden="true"
    >
      {/* Layer 1: The uploaded cinematic underwater image as hero background */}
      <div
        className="absolute inset-0 h-full w-full bg-cover bg-center bg-no-repeat transition-opacity duration-700"
        style={{
          backgroundImage: "url('/images/underwater-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />

      {/* Layer 2: Subtle dark navy gradient overlay
          - Top: moderate dark navy (allows sun rays to shine through, keeps navbar readable)
          - Center: light transparent navy (keeps globe and open ocean luminous and visible)
          - Bottom: slightly darker navy (grounds seabed and command bar)
      */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#020814]/45 via-[#030a1a]/20 to-[#01040d]/65" />

      {/* Left text-contrast subtle wash so hero headline remains crisp */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#020814]/50 via-transparent to-[#020814]/30" />

      {/* Layer 3: Soft deep-ocean back-glow centered behind the 3D globe area */}
      <div className="absolute right-[10%] top-[35%] -translate-y-1/2 h-[580px] w-[580px] rounded-full bg-radial from-[#0284c7]/[0.05] via-[#07516a]/[0.02] to-transparent blur-3xl" />

      {/* Layer 4: Subtle ocean depth atmospheric haze */}
      <div className="absolute inset-0 bg-[#020814]/[0.08]" />

      {/* Layer 5: Floating micro-particles (marine snow) */}
      <div className="deep-ocean-particles absolute inset-0">
        {PARTICLES.map((p) => (
          <span
            key={p.id}
            className="ocean-particle"
            style={{
              left: p.left,
              top: p.top,
              width: `${p.size}px`,
              height: `${p.size}px`,
              opacity: p.opacity,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              // @ts-expect-error CSS custom properties
              "--drift-x": `${p.driftX}px`,
              "--drift-y": `${p.driftY}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
