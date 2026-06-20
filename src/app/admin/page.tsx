"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/roster");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <span className="font-body-sm text-secondary animate-pulse">Redirecting...</span>
    </div>
  );
}
