"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { API, GROUP, LIMITS, ROUTES, SERVE_MODE_LABEL, ServeMode } from "@/lib/constants";
import { apiJson, getMemberId, HttpMethod, loadCustomer, saveCustomer, saveHostToken } from "@/lib/client";
import type { CreateGroupInput, CreateGroupResult } from "@/lib/types";

/** Banner on the home page: start a group order or join one by code. */
export function GroupEntry() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState("");
  const [mode, setMode] = useState<ServeMode>(ServeMode.Table);
  const [table, setTable] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = loadCustomer();
    if (saved.customer) setHost(saved.customer);
    const fromQr = new URLSearchParams(window.location.search).get("ban");
    setTable(fromQr?.slice(0, LIMITS.table) || saved.table || "");
  }, []);

  async function create() {
    setBusy(true);
    setError("");
    try {
      const body: CreateGroupInput = { host, memberId: getMemberId(), mode, table };
      const res = await apiJson<CreateGroupResult>(API.groups, HttpMethod.Post, body);
      saveHostToken(res.code, res.hostToken);
      saveCustomer({ customer: host, table });
      router.push(ROUTES.group(res.code));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  function join(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length === GROUP.codeLength) router.push(ROUTES.group(code));
  }

  return (
    <section className="group-entry" aria-label="Đơn nhóm">
      <div className="group-entry-row">
        <div>
          <strong>Đi cùng bạn bè?</strong>
          <p className="hint">Tạo đơn nhóm, gửi link cho cả bàn. Mỗi người tự chọn món trên điện thoại, một người gửi đơn.</p>
        </div>
        <div className="group-entry-actions">
          <button className="ghost strong" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? "Đóng" : "Tạo đơn nhóm"}
          </button>
          <form className="join" onSubmit={join}>
            <input
              id="join-code"
              className="field code-input"
              placeholder="Mã nhóm"
              value={joinCode}
              maxLength={GROUP.codeLength}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              aria-label="Nhập mã nhóm"
            />
            <button className="ghost" disabled={joinCode.trim().length !== GROUP.codeLength}>Vào</button>
          </form>
        </div>
      </div>

      {open && (
        <div className="group-form">
          <label className="label" htmlFor="group-host">
            Tên của bạn (trưởng nhóm)
            <input id="group-host" className="field" value={host} maxLength={LIMITS.customerName}
              placeholder="vd: Anh Đạt" onChange={(e) => setHost(e.target.value)} />
          </label>
          <div className="seg">
            {Object.values(ServeMode).map((m) => (
              <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>{SERVE_MODE_LABEL[m]}</button>
            ))}
          </div>
          {mode === ServeMode.Table && (
            <label className="label" htmlFor="group-table">
              Số bàn
              <input id="group-table" className="field" inputMode="numeric" value={table} maxLength={LIMITS.table}
                placeholder="có thể điền sau" onChange={(e) => setTable(e.target.value)} />
            </label>
          )}
          {error && <p className="err">{error}</p>}
          <button className="primary" disabled={!host.trim() || busy} onClick={create}>
            {busy ? "Đang tạo…" : "Tạo nhóm và lấy link mời"}
          </button>
        </div>
      )}
    </section>
  );
}
