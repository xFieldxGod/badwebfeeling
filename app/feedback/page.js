"use client";
import { useState } from "react";
import Link from 'next/link';

export default function FeedbackPage() {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");

  const handleSendFeedback = async () => {
    if (!message.trim()) {
      alert("กรุณากรอกข้อความก่อนส่ง");
      return;
    }

    try {
      const res = await fetch("/api/send-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatus("✅ ส่งข้อความเรียบร้อยแล้ว!");
        setMessage("");
      } else {
        setStatus("❌ ส่งไม่สำเร็จ: " + data.error);
      }
    } catch (error) {
      console.error("Error sending feedback:", error);
      setStatus("❌ เกิดข้อผิดพลาดในการส่งข้อความ");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-50 to-purple-100 p-6">
        <div className="flex justify-center mb-4">
        <Link href="/">
  <div className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-full text-sm inline-block">
    🏠 ไปหน้าหลัก
  </div>
</Link>
</div>

      <h1 className="text-3xl font-bold text-center text-purple-800 mb-6">
        📝 อยากให้อัพเดทอะไรพิมไว้เลย
      </h1>

      <div className="max-w-md mx-auto bg-white rounded-xl shadow p-6 space-y-4">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="พิมพ์ข้อความที่นี่..."
          className="w-full border rounded p-3 h-32 resize-none"
        />
        <button
          onClick={handleSendFeedback}
          className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 rounded"
        >
          📤 ส่งข้อความ
        </button>

        {status && (
          <div className="text-center text-sm text-gray-600 mt-4">
            {status}
          </div>
        )}
      </div>
    </main>
  );
}
