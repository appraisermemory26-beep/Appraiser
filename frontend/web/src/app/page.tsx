"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingCapabilities } from "@/components/landing/landing-capabilities";
import { LandingModules } from "@/components/landing/landing-modules";
import { LandingAccountability } from "@/components/landing/landing-accountability";
import { LandingAI } from "@/components/landing/landing-ai";
import { LandingSecurity } from "@/components/landing/landing-security";
import { LandingRoles } from "@/components/landing/landing-roles";
import { LandingPricing } from "@/components/landing/landing-pricing";
import { LandingCta } from "@/components/landing/landing-cta";
import { LandingFooter } from "@/components/landing/landing-footer";

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, isSetupComplete, loading } = useAuth();

  // Authenticated users get sent to where they belong; the landing page
  // is for visitors who haven't logged in yet.
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) return;
    router.replace(isSetupComplete ? "/dashboard" : "/onboarding");
  }, [isAuthenticated, isSetupComplete, loading, router]);

  return (
    <main
      className="min-h-screen"
      data-theme="light"
      style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      <LandingNav />
      <LandingHero />
      <LandingCapabilities />
      <LandingModules />
      <LandingAccountability />
      <LandingAI />
      <LandingSecurity />
      <LandingRoles />
      <LandingPricing />
      <LandingCta />
      <LandingFooter />
    </main>
  );
}
