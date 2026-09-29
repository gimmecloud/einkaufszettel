import { useRef, type MouseEvent } from 'react';
import type { ShoppingItem } from '../api/items';
import { TrashIcon } from './icons';

interface Props {
  item: ShoppingItem;
  pending: boolean;
  onToggle: (item: ShoppingItem) => Promise<boolean>;
  onRemove: (item: ShoppingItem) => Promise<boolean>;
}

export function ItemRow({ item, pending, onToggle, onRemove }: Props) {
  const row = useRef<HTMLLIElement>(null);

  const remove = async (event: MouseEvent<HTMLButtonElement>) => {
    if (pending) return;
    const currentRow = row.current;
    if (!currentRow) return;
    const button = event.currentTarget;
    const siblings = Array.from(currentRow.parentElement?.children ?? []);
    const index = siblings.indexOf(currentRow);
    const candidates = [...siblings.slice(index + 1), ...siblings.slice(0, index).reverse()];
    if (await onRemove(item)) {
      // Move focus only if the user has not already continued elsewhere while saving.
      if (document.activeElement === button || document.activeElement === document.body) {
        const nextInput = candidates.find((element) => element.isConnected)?.querySelector('input');
        (nextInput ?? document.getElementById('product-name'))?.focus();
      }
    }
  };

  return (
    <li ref={row} className={`item-row ${item.bought ? 'item-row--bought' : ''}`} aria-busy={pending}>
      <label className="item-label">
        <input
          type="checkbox"
          checked={item.bought}
          aria-disabled={pending}
          onChange={() => { if (!pending) void onToggle(item); }}
          aria-label={`${item.name}: gekauft`}
        />
        <span className="item-name">{item.name}</span>
      </label>
      <button
        type="button"
        className="delete-button"
        aria-label={`${item.name} löschen`}
        aria-disabled={pending}
        onClick={(event) => { void remove(event); }}
      >
        <TrashIcon /><span>Löschen</span>
      </button>
    </li>
  );
}
