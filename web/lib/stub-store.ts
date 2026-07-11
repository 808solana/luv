export const MIN_BALANCE_CENTS = 500;
export const CURRENCY = "USD";

export type ApiKeyRecord = {
  id: string;
  name: string;
  prefix: string;
  secret: string;
  createdAt: string;
};

type Store = {
  balanceCents: number;
  keys: Map<string, ApiKeyRecord>;
};

const store: Store = {
  balanceCents: 0,
  keys: new Map(),
};

function randomSuffix(length = 8): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function getBalance() {
  return {
    balanceCents: store.balanceCents,
    currency: CURRENCY,
    minBalanceCents: MIN_BALANCE_CENTS,
  };
}

export function listKeys() {
  return Array.from(store.keys.values()).map(({ id, name, prefix, createdAt }) => ({
    id,
    name,
    prefix,
    createdAt,
  }));
}

export function createKey(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Name is required.");
  }

  const suffix = randomSuffix();
  const secret = `luv_${suffix}${randomSuffix(4)}`;
  const prefix = `luv_••••${suffix.slice(-4)}`;
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const record: ApiKeyRecord = { id, name: trimmed, prefix, secret, createdAt };
  store.keys.set(id, record);

  return { id, name: trimmed, key: secret, createdAt };
}

export function topUp(amountCents: number, _method: string) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("Amount must be a positive integer in cents.");
  }

  store.balanceCents += amountCents;
  return { balanceCents: store.balanceCents };
}
