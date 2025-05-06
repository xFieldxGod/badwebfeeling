"use client";
import { Suspense } from "react";
import RankingContent from "./RankingContent";

export default function RankingPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">กำลังโหลด...</div>}>
      <RankingContent />
    </Suspense>
  );
}
