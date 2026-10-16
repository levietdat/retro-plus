import "server-only";
import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { GROUP, GroupStatus, LIMITS, MESSAGES, ServeMode } from "./constants";
import { findVariant, getMenu } from "./menu";
import { clean, cleanQty, insertOrder, isServeMode, OrderError } from "./orders";
import { readDoc, updateDoc } from "./storage";
import type {
  AddGroupItemInput,
  CreateGroupInput,
  CreateGroupResult,
  GroupDoc,
  GroupItem,
  OrderLine,
  PublicGroup,
  PublicOrder,
  UpdateGroupInput,
  UpdateGroupItemInput,
} from "./types";

/** Who is calling: a random per-browser member id, plus the host token for the group creator. */
export interface Caller {
  memberId: string;
  hostToken: string;
}

const key = (code: string) => GROUP.keyPrefix + code;
const ttlMs = GROUP.ttlHours * 3600 * 1000;

export function normalizeGroupCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, GROUP.codeLength);
}

function newCode(): string {
  let out = "";
  for (let i = 0; i < GROUP.codeLength; i++) out += GROUP.codeAlphabet[randomInt(GROUP.codeAlphabet.length)];
  return out;
}

function cleanMemberId(v: unknown): string {
  const id = clean(v, GROUP.memberIdMaxLength);
  if (!id) throw new OrderError(MESSAGES.invalidOrder);
  return id;
}

function isHost(doc: GroupDoc, caller: Caller): boolean {
  if (!caller.hostToken) return false;
  const a = Buffer.from(caller.hostToken);
  const b = Buffer.from(doc.hostToken);
  return a.length === b.length && timingSafeEqual(a, b);
}

const isExpired = (doc: GroupDoc) => Date.now() - doc.createdAt > ttlMs;

function effectiveStatus(doc: GroupDoc): GroupStatus {
  return doc.status === GroupStatus.Open && isExpired(doc) ? GroupStatus.Closed : doc.status;
}

function requireOpen(doc: GroupDoc | null): GroupDoc {
  if (!doc) throw new OrderError(MESSAGES.groupNotFound, 404);
  if (effectiveStatus(doc) !== GroupStatus.Open) throw new OrderError(MESSAGES.groupClosed, 409);
  return doc;
}

function toPublic(doc: GroupDoc, caller: Caller): PublicGroup {
  return {
    code: doc.code,
    host: doc.host,
    mode: doc.mode,
    table: doc.table,
    note: doc.note,
    status: effectiveStatus(doc),
    items: doc.items.map(({ memberId, kiotvietProductId: _kv, ...rest }) => ({
      ...rest,
      mine: memberId === caller.memberId,
    })),
    total: doc.items.reduce((s, i) => s + i.price * i.qty, 0),
    createdAt: doc.createdAt,
    expiresAt: doc.createdAt + ttlMs,
    orderCode: doc.orderCode,
    isHost: isHost(doc, caller),
  };
}

export async function createGroup(input: CreateGroupInput): Promise<CreateGroupResult> {
  const host = clean(input.host, LIMITS.customerName);
  if (!host) throw new OrderError(MESSAGES.needName);
  if (!isServeMode(input.mode)) throw new OrderError(MESSAGES.invalidOrder);
  const table = input.mode === ServeMode.Table ? clean(input.table, LIMITS.table) : "";
  const memberId = cleanMemberId(input.memberId);
  const now = Date.now();
  const hostToken = randomBytes(GROUP.tokenBytes).toString("base64url");

  // Retry on the rare code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    const created = await updateDoc<GroupDoc, boolean>(key(code), (existing) => {
      if (existing) return { doc: existing, result: false };
      return {
        doc: {
          code, hostToken, hostMemberId: memberId, host, mode: input.mode, table, note: "",
          status: GroupStatus.Open, items: [], createdAt: now, updatedAt: now, orderCode: null,
        },
        result: true,
      };
    });
    if (created) return { code, hostToken };
  }
  throw new Error("GROUP_CODE_EXHAUSTED");
}

export async function getGroup(code: string, caller: Caller): Promise<PublicGroup | null> {
  const doc = await readDoc<GroupDoc>(key(normalizeGroupCode(code)));
  return doc ? toPublic(doc, caller) : null;
}

export async function addGroupItem(code: string, input: AddGroupItemInput, caller: Caller): Promise<PublicGroup> {
  const member = clean(input.member, LIMITS.customerName);
  if (!member) throw new OrderError(MESSAGES.needMemberName);
  const memberId = cleanMemberId(input.memberId);
  const menu = await getMenu();
  const found = findVariant(menu, String(input.variantId));
  if (!found) throw new OrderError(MESSAGES.itemUnavailable);
  const qty = cleanQty(input.qty ?? 1);
  const note = clean(input.note, LIMITS.lineNote);
  const now = Date.now();

  return updateDoc<GroupDoc, PublicGroup>(key(normalizeGroupCode(code)), (raw) => {
    const doc = requireOpen(raw);
    if (doc.items.length >= GROUP.maxItems) throw new OrderError(MESSAGES.groupFull);
    const members = new Set(doc.items.map((i) => i.memberId));
    if (!members.has(memberId) && members.size >= GROUP.maxMembers) throw new OrderError(MESSAGES.groupTooManyMembers);
    // Same drink, same note, same person: bump the quantity instead of adding a row.
    const same = doc.items.find((i) => i.memberId === memberId && i.variantId === found.variant.id && i.note === note);
    const items = same
      ? doc.items.map((i) => (i === same ? { ...i, member, qty: Math.min(i.qty + qty, LIMITS.qtyPerLine) } : i))
      : [
          ...doc.items,
          {
            id: randomBytes(6).toString("base64url"),
            memberId, member,
            variantId: found.variant.id,
            name: found.item.name,
            size: found.variant.label,
            price: found.variant.price,
            qty, note, addedAt: now,
            kiotvietProductId: found.variant.kiotvietProductId,
          } satisfies GroupItem,
        ];
    const next = { ...doc, items, updatedAt: now };
    return { doc: next, result: toPublic(next, { ...caller, memberId }) };
  });
}

function requireItemAccess(doc: GroupDoc, itemId: string, caller: Caller): GroupItem {
  const item = doc.items.find((i) => i.id === itemId);
  if (!item) throw new OrderError(MESSAGES.orderNotFound, 404);
  if (item.memberId !== caller.memberId && !isHost(doc, caller)) throw new OrderError(MESSAGES.notYourItem, 403);
  return item;
}

export async function updateGroupItem(code: string, itemId: string, input: UpdateGroupItemInput, caller: Caller): Promise<PublicGroup> {
  const qty = input.qty === undefined ? undefined : cleanQty(input.qty);
  const note = input.note === undefined ? undefined : clean(input.note, LIMITS.lineNote);
  return updateDoc<GroupDoc, PublicGroup>(key(normalizeGroupCode(code)), (raw) => {
    const doc = requireOpen(raw);
    const item = requireItemAccess(doc, itemId, caller);
    const items = doc.items.map((i) => (i === item ? { ...i, ...(qty !== undefined && { qty }), ...(note !== undefined && { note }) } : i));
    const next = { ...doc, items, updatedAt: Date.now() };
    return { doc: next, result: toPublic(next, caller) };
  });
}

export async function removeGroupItem(code: string, itemId: string, caller: Caller): Promise<PublicGroup> {
  return updateDoc<GroupDoc, PublicGroup>(key(normalizeGroupCode(code)), (raw) => {
    const doc = requireOpen(raw);
    const item = requireItemAccess(doc, itemId, caller);
    const next = { ...doc, items: doc.items.filter((i) => i !== item), updatedAt: Date.now() };
    return { doc: next, result: toPublic(next, caller) };
  });
}

export async function updateGroup(code: string, input: UpdateGroupInput, caller: Caller): Promise<PublicGroup> {
  return updateDoc<GroupDoc, PublicGroup>(key(normalizeGroupCode(code)), (raw) => {
    const doc = requireOpen(raw);
    if (!isHost(doc, caller)) throw new OrderError(MESSAGES.notHost, 403);
    const mode = input.mode === undefined ? doc.mode : isServeMode(input.mode) ? input.mode : doc.mode;
    const next: GroupDoc = {
      ...doc,
      mode,
      table: mode === ServeMode.Table ? (input.table === undefined ? doc.table : clean(input.table, LIMITS.table)) : "",
      note: input.note === undefined ? doc.note : clean(input.note, LIMITS.note),
      updatedAt: Date.now(),
    };
    return { doc: next, result: toPublic(next, caller) };
  });
}

/**
 * Host sends the group to the counter. The group is locked first so nobody can add
 * items while the order is being created; if creating the order fails it is reopened.
 */
export async function submitGroup(code: string, caller: Caller): Promise<PublicOrder> {
  const k = key(normalizeGroupCode(code));
  const locked = await updateDoc<GroupDoc, GroupDoc>(k, (raw) => {
    const doc = requireOpen(raw);
    if (!isHost(doc, caller)) throw new OrderError(MESSAGES.notHost, 403);
    if (doc.items.length === 0) throw new OrderError(MESSAGES.groupEmpty);
    if (doc.mode === ServeMode.Table && !doc.table) throw new OrderError(MESSAGES.needTable);
    const next = { ...doc, status: GroupStatus.Submitted, updatedAt: Date.now() };
    return { doc: next, result: next };
  });

  const lines: OrderLine[] = locked.items.map((i) => ({
    variantId: i.variantId,
    name: i.name,
    size: i.size,
    price: i.price,
    qty: i.qty,
    member: i.member,
    ...(i.note ? { note: i.note } : {}),
    kiotvietProductId: i.kiotvietProductId,
  }));

  try {
    const order = await insertOrder(
      { customer: `${locked.host} (nhóm)`, mode: locked.mode, table: locked.table, note: locked.note, groupCode: locked.code },
      lines,
    );
    await updateDoc<GroupDoc, null>(k, (raw) => ({ doc: { ...(raw as GroupDoc), orderCode: order.code }, result: null }));
    return order;
  } catch (err) {
    await updateDoc<GroupDoc, null>(k, (raw) => ({ doc: { ...(raw as GroupDoc), status: GroupStatus.Open }, result: null }));
    throw err;
  }
}
