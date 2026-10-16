"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  API,
  GroupStatus,
  LIMITS,
  MESSAGES,
  POLL_MS,
  ROUTES,
  SERVE_MODE_LABEL,
  ServeMode,
} from "@/lib/constants";
import { apiJson, getMemberId, groupHeaders, HttpMethod, loadCustomer, saveCustomer } from "@/lib/client";
import { formatMoney, formatTime } from "@/lib/format";
import type {
  AddGroupItemInput,
  Menu,
  MenuItem,
  MenuVariant,
  PublicGroup,
  PublicGroupItem,
  PublicOrder,
  UpdateGroupInput,
  UpdateGroupItemInput,
} from "@/lib/types";
import { MenuBrowser } from "./MenuBrowser";

interface MemberBlock {
  name: string;
  mine: boolean;
  items: PublicGroupItem[];
  subtotal: number;
}

function groupByMember(items: PublicGroupItem[]): MemberBlock[] {
  const blocks = new Map<string, MemberBlock>();
  for (const it of [...items].sort((a, b) => a.addedAt - b.addedAt)) {
    const k = it.mine ? "\u0000me" : it.member;
    const b = blocks.get(k) ?? { name: it.member, mine: it.mine, items: [], subtotal: 0 };
    b.items.push(it);
    b.subtotal += it.price * it.qty;
    b.name = it.member;
    blocks.set(k, b);
  }
  return [...blocks.values()].sort((a, b) => Number(b.mine) - Number(a.mine));
}

/* ---------- One drink row ---------- */
function ItemRow({ item, editable, onQty, onNote, onRemove }: {
  item: PublicGroupItem;
  editable: boolean;
  onQty: (qty: number) => void;
  onNote: (note: string) => void;
  onRemove: () => void;
}) {
  const [note, setNote] = useState(item.note);
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setNote(item.note);
  }, [item.note]);

  return (
    <div className="gline">
      <div className="line">
        <span>
          {item.name}
          {item.size && <span className="hint"> ({item.size})</span>}
        </span>
        {editable ? (
          <span className="step">
            <button aria-label="Bớt" onClick={() => (item.qty <= 1 ? onRemove() : onQty(item.qty - 1))}>−</button>
            <span>{item.qty}</span>
            <button aria-label="Thêm" onClick={() => onQty(Math.min(item.qty + 1, LIMITS.qtyPerLine))}>+</button>
          </span>
        ) : (
          <span className="num hint">× {item.qty}</span>
        )}
        <span className="num">{formatMoney(item.price * item.qty)}</span>
      </div>
      {item.mine ? (
        <input
          id={`note-${item.id}`}
          className="field note-input"
          placeholder="Ghi chú ly này: ít đường, không đá…"
          value={note}
          maxLength={LIMITS.lineNote}
          onFocus={() => (editing.current = true)}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            editing.current = false;
            if (note.trim() !== item.note) onNote(note);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      ) : (
        item.note && <div className="gnote">{item.note}</div>
      )}
    </div>
  );
}

/* ---------- Share box ---------- */
function ShareBox({ code }: { code: string }) {
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);

  useEffect(() => setUrl(`${window.location.origin}${ROUTES.group(code)}`), [code]);
  useEffect(() => {
    if (!showQr || !url || qr) return;
    QRCode.toDataURL(url, { margin: 1, width: 240 }).then(setQr).catch(() => setQr(""));
  }, [showQr, url, qr]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      linkRef.current?.select();
    }
  }

  return (
    <div className="share">
      <div className="share-row">
        <input ref={linkRef} id="share-link" className="field" readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Link mời" />
        <button className="ghost strong" onClick={copy}>{copied ? "Đã chép" : "Chép link"}</button>
        <button className="ghost" onClick={() => setShowQr((s) => !s)} aria-expanded={showQr}>{showQr ? "Ẩn QR" : "Mã QR"}</button>
      </div>
      {showQr && qr && <img className="qr" src={qr} alt={`Mã QR vào nhóm ${code}`} width={200} height={200} />}
    </div>
  );
}

/* ---------- Page ---------- */
export function GroupApp({ code, menu }: { code: string; menu: Menu }) {
  const router = useRouter();
  const [group, setGroup] = useState<PublicGroup | null>(null);
  const [missing, setMissing] = useState(false);
  const [myName, setMyName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [table, setTable] = useState("");
  const [note, setNote] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const hostFieldsSynced = useRef(false);

  const apply = useCallback((g: PublicGroup) => {
    setGroup(g);
    if (!hostFieldsSynced.current) {
      setTable(g.table);
      setNote(g.note);
      hostFieldsSynced.current = true;
    }
    if (g.status === GroupStatus.Submitted && g.orderCode) router.push(ROUTES.order(g.orderCode));
  }, [router]);

  const load = useCallback(async () => {
    try {
      apply(await apiJson<PublicGroup>(API.group(code), HttpMethod.Get, undefined, groupHeaders(code)));
    } catch (e) {
      if ((e as { status?: number }).status === 404) setMissing(true);
    }
  }, [apply, code]);

  useEffect(() => {
    getMemberId();
    const saved = loadCustomer();
    if (saved.customer) setMyName(saved.customer);
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS.group);
    return () => clearInterval(t);
  }, [load]);

  async function call<T>(url: string, method: HttpMethod, body?: unknown): Promise<T | null> {
    setError("");
    try {
      return await apiJson<T>(url, method, body, groupHeaders(code));
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }

  async function add(item: MenuItem, variant: MenuVariant) {
    if (!myName.trim()) {
      setError(MESSAGES.needMemberName);
      setOpen(true);
      nameRef.current?.focus();
      return;
    }
    saveCustomer({ customer: myName.trim() });
    const body: AddGroupItemInput = { memberId: getMemberId(), member: myName.trim(), variantId: variant.id, qty: 1 };
    const g = await call<PublicGroup>(API.groupItems(code), HttpMethod.Post, body);
    if (g) apply(g);
  }

  async function updateItem(it: PublicGroupItem, patch: UpdateGroupItemInput) {
    const g = await call<PublicGroup>(API.groupItem(code, it.id), HttpMethod.Patch, patch);
    if (g) apply(g);
  }

  async function removeItem(it: PublicGroupItem) {
    const g = await call<PublicGroup>(API.groupItem(code, it.id), HttpMethod.Delete);
    if (g) apply(g);
  }

  async function updateGroupFields(patch: UpdateGroupInput) {
    const g = await call<PublicGroup>(API.group(code), HttpMethod.Patch, patch);
    if (g) apply(g);
  }

  async function submit() {
    if (!group) return;
    if (group.mode === ServeMode.Table && !table.trim()) return setError(MESSAGES.needTable);
    setSubmitting(true);
    if (table !== group.table || note !== group.note) await updateGroupFields({ table, note });
    const order = await call<PublicOrder>(API.groupSubmit(code), HttpMethod.Post);
    if (order) router.push(ROUTES.order(order.code));
    else setSubmitting(false);
  }

  if (missing) {
    return (
      <div className="status-card">
        <p>{MESSAGES.groupNotFound}</p>
        <Link href={ROUTES.home}>Về thực đơn</Link>
      </div>
    );
  }
  if (!group) return <div className="status-card"><p className="hint">Đang mở nhóm…</p></div>;

  const isOpen = group.status === GroupStatus.Open;
  const blocks = groupByMember(group.items);
  const cups = group.items.reduce((s, i) => s + i.qty, 0);
  const mine = (variantId: string) =>
    group.items.filter((i) => i.mine && i.variantId === variantId).reduce((s, i) => s + i.qty, 0);
  const where = group.mode === ServeMode.Table ? (group.table ? `Bàn ${group.table}` : "Chưa có số bàn") : SERVE_MODE_LABEL[ServeMode.Takeaway];

  return (
    <>
      <section className="group-head">
        <div>
          <p className="eyebrow">Đơn nhóm · mã <span className="gcode">{group.code}</span></p>
          <h2>Nhóm của {group.host}</h2>
          <p className="hint">{where} · {blocks.length} người · {cups} ly · mở đến {formatTime(group.expiresAt)}</p>
        </div>
        {isOpen && <ShareBox code={group.code} />}
      </section>

      {!isOpen && (
        <div className="status-card">
          <p>{group.orderCode ? `Đơn đã gửi với mã ${group.orderCode}.` : MESSAGES.groupClosed}</p>
          {group.orderCode ? <Link href={ROUTES.order(group.orderCode)}>Xem trạng thái đơn</Link> : <Link href={ROUTES.home}>Về thực đơn</Link>}
        </div>
      )}

      {isOpen && (
        <div className="layout">
          <MenuBrowser menu={menu} qtyFor={mine} onAdd={add} />

          <aside className={`ticket${open ? " open" : ""}`} aria-label="Món của nhóm">
            <div className="ticket-head">
              <h3>Món của nhóm</h3>
              <button className="toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                {open ? "Thu gọn" : `Xem nhóm (${cups} ly · ${formatMoney(group.total)})`}
              </button>
            </div>
            <div className="ticket-body">
              <label className="label" htmlFor="my-name">
                Tên của bạn
                <input ref={nameRef} id="my-name" className="field" value={myName} maxLength={LIMITS.customerName}
                  placeholder="để quán biết ly nào của ai" onChange={(e) => setMyName(e.target.value)} />
              </label>

              {blocks.length === 0 && <p className="hint">Chưa ai chọn món. Bấm + cạnh món để thêm ly của bạn.</p>}
              <div className="members">
                {blocks.map((b) => (
                  <div className={`member${b.mine ? " me" : ""}`} key={(b.mine ? "me:" : "") + b.name}>
                    <div className="member-head">
                      <strong>{b.mine ? `Bạn · ${b.name}` : b.name}</strong>
                      <span className="num hint">{formatMoney(b.subtotal)}</span>
                    </div>
                    {b.items.map((it) => (
                      <ItemRow
                        key={it.id}
                        item={it}
                        editable={it.mine || group.isHost}
                        onQty={(qty) => updateItem(it, { qty })}
                        onNote={(n) => updateItem(it, { note: n })}
                        onRemove={() => removeItem(it)}
                      />
                    ))}
                  </div>
                ))}
              </div>

              {cups > 0 && (
                <div className="total">
                  <span>Cả nhóm ({cups} ly)</span>
                  <span className="num">{formatMoney(group.total)}</span>
                </div>
              )}

              {group.isHost ? (
                <>
                  <div className="seg">
                    {Object.values(ServeMode).map((m) => (
                      <button key={m} aria-pressed={group.mode === m} onClick={() => updateGroupFields({ mode: m })}>
                        {SERVE_MODE_LABEL[m]}
                      </button>
                    ))}
                  </div>
                  {group.mode === ServeMode.Table && (
                    <label className="label" htmlFor="group-table">
                      Số bàn
                      <input id="group-table" className="field" inputMode="numeric" value={table} maxLength={LIMITS.table}
                        placeholder="vd: 5" onChange={(e) => setTable(e.target.value)}
                        onBlur={() => table !== group.table && updateGroupFields({ table })} />
                    </label>
                  )}
                  <label className="label" htmlFor="group-note">
                    Ghi chú chung
                    <textarea id="group-note" className="field" value={note} maxLength={LIMITS.note}
                      placeholder="vd: mang ra cùng lúc" onChange={(e) => setNote(e.target.value)}
                      onBlur={() => note !== group.note && updateGroupFields({ note })} />
                  </label>
                  {error && <p className="err">{error}</p>}
                  <button className="primary" disabled={!cups || submitting} onClick={submit}>
                    {submitting ? "Đang gửi…" : `Gửi đơn cho quầy${cups ? ` · ${formatMoney(group.total)}` : ""}`}
                  </button>
                  <p className="hint">Bạn là trưởng nhóm. Đợi mọi người chọn xong rồi bấm gửi. Thanh toán tại quầy.</p>
                </>
              ) : (
                <>
                  {error && <p className="err">{error}</p>}
                  <p className="waiting-host">Chọn xong là được. <strong>{group.host}</strong> sẽ gửi đơn cho cả nhóm.</p>
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
