"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { API, MESSAGES, ROUTES, SHOP_NAME } from "@/lib/constants";
import type { ApiError } from "@/lib/types";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(API.adminLogin, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({ error: MESSAGES.wrongPassword }))) as ApiError;
        throw new Error(data.error);
      }
      router.replace(ROUTES.admin);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="login" onSubmit={submit}>
      <h2>{SHOP_NAME} · Quầy</h2>
      <label className="label" htmlFor="password">
        Mật khẩu quản trị
        <input id="password" className="field" type="password" autoComplete="current-password" autoFocus
          value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p className="err">{error}</p>}
      <button className="primary" disabled={!password || busy}>{busy ? "Đang vào…" : "Vào quầy"}</button>
    </form>
  );
}
