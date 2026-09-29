import { useEffect, useRef, useState } from 'react';
import { itemsApi, type ShoppingItem } from '../api/items';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Etwas ist schiefgegangen. Bitte erneut versuchen.';
}

export function useShoppingList() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [reloadKey, setReloadKey] = useState(0);
  // A synchronous lock also covers clicks before React renders the pending state.
  const locks = useRef(new Set<string>());

  useEffect(() => {
    const controller = new AbortController();
    void itemsApi.list(controller.signal).then((data) => {
      setItems(data);
      setHasLoaded(true);
      setError(null);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(errorMessage(cause));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [reloadKey]);

  const reload = () => {
    if (locks.current.size > 0) return;
    setLoading(true);
    setError(null);
    setReloadKey((key) => key + 1);
  };

  const mutate = async (key: string, operation: () => Promise<void>): Promise<boolean> => {
    if (loading || !hasLoaded || locks.current.has(key)) return false;
    locks.current.add(key);
    setPending(new Set(locks.current));
    setError(null);
    setAnnouncement('');
    try {
      await operation();
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    } finally {
      locks.current.delete(key);
      setPending(new Set(locks.current));
    }
  };

  const add = (name: string) => mutate('add', async () => {
    const item = await itemsApi.add(name);
    setItems((current) => [...current, item]);
    setAnnouncement(`${item.name} hinzugefügt.`);
  });

  const toggle = (item: ShoppingItem) => mutate(item._id, async () => {
    const updated = await itemsApi.setBought(item._id, !item.bought);
    setItems((current) => current.map((entry) => entry._id === updated._id ? updated : entry));
    setAnnouncement(`${updated.name} ${updated.bought ? 'als gekauft markiert' : 'wieder offen'}.`);
  });

  const remove = (item: ShoppingItem) => mutate(item._id, async () => {
    await itemsApi.remove(item._id);
    setItems((current) => current.filter((entry) => entry._id !== item._id));
    setAnnouncement(`${item.name} gelöscht.`);
  });

  return { items, loading, hasLoaded, error, announcement, pending, add, toggle, remove, reload };
}
