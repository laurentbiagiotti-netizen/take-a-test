"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UnlockForm({ testId }: { testId: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr(null);
    const res = await fetch(`/api/exam/${testId}/unlock`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return setErr(j.message || "Code incorrect.");
    }
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <input
        className="input font-mono tracking-widest text-center text-lg"
        placeholder="XXXX-XXXX-XXXX" value={code} maxLength={32} autoComplete="off"
        onChange={(e) => setCode(e.target.value.toUpperCase())} autoFocus required
      />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button className="btn w-full justify-center" disabled={loading || !code}>
        {loading ? "Vérification…" : "Valider le code"}
      </button>
    </form>
  );
}
