"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function VerifyPage() {
  const params = useSearchParams();
  const token = params.get("token");

  useEffect(() => {
    if (token) {
      window.location.href = `/api/auth/verify?token=${token}`;
    }
  }, [token]);

  return <p>Verifying your account...</p>;
}