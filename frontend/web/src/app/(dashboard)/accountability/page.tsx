"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy route — PMCS replaced the Accountability module. */
export default function AccountabilityRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/pmcs");
  }, [router]);
  return null;
}
