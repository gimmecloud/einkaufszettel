export interface ShoppingItem {
  _id: string;
  name: string;
  bought: boolean;
  createdAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isItem(value: unknown): value is ShoppingItem {
  return isRecord(value)
    && typeof value._id === 'string'
    && /^[a-f\d]{24}$/i.test(value._id)
    && typeof value.name === 'string'
    && typeof value.bought === 'boolean'
    && typeof value.createdAt === 'string'
    && Number.isFinite(Date.parse(value.createdAt));
}

async function request(path = '', options: RequestInit = {}): Promise<unknown> {
  let response: Response;
  try {
    const timeout = AbortSignal.timeout(12000);
    response = await fetch(`/items${path}`, {
      ...options,
      headers: options.body ? { 'Content-Type': 'application/json' } : {},
      signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new Error('Der Server ist gerade nicht erreichbar. Bitte die Liste neu laden, bevor du es erneut versuchst.', { cause: error });
  }

  if (response.status === 204) return undefined;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(isRecord(data) && typeof data.error === 'string'
      ? data.error
      : 'Die Anfrage ist fehlgeschlagen. Bitte erneut versuchen.');
  }
  return data;
}

function parseItem(data: unknown): ShoppingItem {
  if (!isItem(data)) throw new Error('Die Antwort des Servers ist ungültig. Bitte die Liste neu laden.');
  return data;
}

export const itemsApi = {
  async list(signal: AbortSignal): Promise<ShoppingItem[]> {
    const data = await request('', { signal });
    if (!Array.isArray(data) || !data.every(isItem)) {
      throw new Error('Die Einkaufsliste konnte nicht gelesen werden. Bitte erneut laden.');
    }
    return data;
  },
  async add(name: string) {
    return parseItem(await request('', { method: 'POST', body: JSON.stringify({ name }) }));
  },
  async setBought(id: string, bought: boolean) {
    return parseItem(await request(`/${id}`, { method: 'PUT', body: JSON.stringify({ bought }) }));
  },
  async remove(id: string) {
    await request(`/${id}`, { method: 'DELETE' });
  }
};
