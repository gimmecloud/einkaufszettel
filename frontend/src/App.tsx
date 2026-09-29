import { useEffect, useRef } from 'react';
import { AddItemForm } from './components/add-item-form';
import { CheckIcon } from './components/icons';
import { ItemRow } from './components/item-row';
import { useShoppingList } from './hooks/use-shopping-list';

export function App() {
  const list = useShoppingList();
  const reloadButton = useRef<HTMLButtonElement>(null);
  const restoreReloadFocus = useRef(false);

  useEffect(() => {
    if (list.loading || !restoreReloadFocus.current) return;
    restoreReloadFocus.current = false;
    if (document.activeElement !== document.body) return;
    if (list.error) reloadButton.current?.focus();
    else document.getElementById('product-name')?.focus();
  }, [list.loading, list.error]);

  const bought = list.items.filter((item) => item.bought).length;
  const open = list.items.length - bought;
  const percent = list.items.length ? Math.round(bought / list.items.length * 100) : 0;
  const complete = list.items.length > 0 && open === 0;
  let countLabel = `${list.items.length} ${list.items.length === 1 ? 'Produkt' : 'Produkte'}`;
  if (!list.hasLoaded) countLabel = 'Nicht geladen';
  if (list.loading) countLabel = 'Lädt …';

  return (
    <>
      <a className="skip-link" href="#main">Zur Einkaufsliste</a>
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="Einkaufszettel – Startseite">
          <span className="brand-icon"><CheckIcon /></span>einkaufszettel<span className="brand-period">.</span>
        </a>
      </header>

      <main id="main" className="page">
        <h1>Einkaufsliste</h1>

        <div className="workspace">
          <section className="list-card" aria-labelledby="list-title">
            <div className="list-card-heading">
              <h2 id="list-title">Produkte</h2>
              <span className="count-label">{countLabel}</span>
            </div>

            <AddItemForm disabled={list.loading || !list.hasLoaded || list.pending.has('add')} saving={list.pending.has('add')} onAdd={list.add} />

            {list.error && (
              <div className="error-notice">
                <p role="alert">{list.error}</p>
                <button ref={reloadButton} type="button" onClick={() => {
                  restoreReloadFocus.current = true;
                  list.reload();
                }} disabled={list.pending.size > 0 || list.loading}>Liste neu laden</button>
              </div>
            )}

            <div className="list-content" aria-busy={list.loading}>
              {list.loading ? (
                <div className="empty-state" role="status"><span className="spinner" aria-hidden="true" /><p>Deine Liste wird geladen …</p></div>
              ) : list.items.length === 0 ? (
                <div className="empty-state">
                  <h3>{!list.hasLoaded ? 'Noch keine Liste geladen' : 'Deine Liste ist leer.'}</h3>
                  <p>{!list.hasLoaded ? 'Versuche es erneut, sobald die Verbindung wieder da ist.' : 'Füge oben dein erstes Produkt hinzu.'}</p>
                </div>
              ) : (
                <>
                  <div className="list-section-heading"><span>Produkt</span><span>{open} noch offen</span></div>
                  <ul className="items">
                    {list.items.map((item) => <ItemRow key={item._id} item={item} pending={list.pending.has(item._id)} onToggle={list.toggle} onRemove={list.remove} />)}
                  </ul>
                </>
              )}
            </div>
          </section>

          <aside className="summary-card" aria-labelledby="summary-title">
            <h2 className="eyebrow" id="summary-title">Übersicht</h2>
            <div className="summary-number">{list.loading || !list.hasLoaded ? '—' : String(open).padStart(2, '0')}</div>
            <p className="summary-label">{open === 1 ? 'Produkt noch offen' : 'Produkte noch offen'}</p>
            <div className="progress-section">
              <div className="progress-label"><span>Gekauft</span><span>{bought} / {list.items.length}</span></div>
              <progress value={bought} max={Math.max(1, list.items.length)} aria-label="Gekaufte Produkte" />
              <span className="progress-percent">{percent}% erledigt</span>
            </div>
            {complete && !list.error && !list.loading && <p className="summary-complete">Alle Produkte gekauft.</p>}
          </aside>
        </div>
      </main>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{list.announcement}</div>
    </>
  );
}
