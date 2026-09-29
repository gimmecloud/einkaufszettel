import { useRef, useState, type FormEvent } from 'react';
import { PlusIcon } from './icons';

interface Props {
  disabled: boolean;
  saving: boolean;
  onAdd: (name: string) => Promise<boolean>;
}

export function AddItemForm({ disabled, saving, onAdd }: Props) {
  const [name, setName] = useState('');
  const [validation, setValidation] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled) return;
    const form = event.currentTarget;
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 120) {
      setValidation('Bitte einen Produktnamen mit 1 bis 120 Zeichen eingeben.');
      input.current?.focus();
      return;
    }
    setValidation('');
    if (await onAdd(trimmed)) {
      setName('');
    }
    if (form.contains(document.activeElement) || document.activeElement === document.body) input.current?.focus();
  };

  return (
    <form className="add-form" onSubmit={(event) => { void submit(event); }} noValidate>
      <label htmlFor="product-name">Was brauchst du?</label>
      <div className={`input-group ${validation ? 'input-group--invalid' : ''}`}>
        <input
          ref={input}
          id="product-name"
          name="product"
          placeholder="Zum Beispiel Butter"
          value={name}
          onChange={(event) => { setName(event.target.value); setValidation(''); }}
          maxLength={120}
          readOnly={saving}
          disabled={disabled && !saving}
          aria-invalid={!!validation}
          aria-describedby={validation ? 'name-error' : undefined}
          autoComplete="off"
        />
        <button className="add-button" type="submit" disabled={disabled && !saving} aria-disabled={saving}>
          {saving ? <span className="spinner" aria-hidden="true" /> : <PlusIcon />}
          <span>{saving ? 'Speichert …' : 'Hinzufügen'}</span>
        </button>
      </div>
      {validation && <p id="name-error" className="field-error" role="alert">{validation}</p>}
    </form>
  );
}
