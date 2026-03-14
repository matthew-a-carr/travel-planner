'use client';

import { useId, useRef, useState } from 'react';
import type { CountryReference } from '@/domain/country-reference/types';

/**
 * Filters countries by case-insensitive substring match on name, alpha2, or alpha3.
 * Exported for unit testing.
 */
export function filterCountries(
  query: string,
  countries: readonly CountryReference[],
): CountryReference[] {
  const q = query.toLowerCase().trim();
  if (!q) return [...countries];
  return countries.filter(
    (c) =>
      c.country.toLowerCase().includes(q) ||
      c.alpha2.toLowerCase() === q ||
      c.alpha3.toLowerCase() === q,
  );
}

export function CountryCombobox({
  id,
  name,
  countries,
  value,
  onChange,
  required,
  placeholder = 'Search countries…',
}: {
  id: string;
  name: string;
  countries: readonly CountryReference[];
  value: string;
  onChange: (country: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const [inputText, setInputText] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = isOpen ? filterCountries(inputText, countries) : [];

  function selectCountry(country: string) {
    setInputText(country);
    onChange(country);
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function handleInputChange(text: string) {
    setInputText(text);
    setIsOpen(true);
    setActiveIndex(-1);
    // Clear selected value when user types — only valid after explicit selection
    if (text !== value) {
      onChange('');
    }
  }

  function handleBlur() {
    // Delay to allow click on option to fire before closing
    window.setTimeout(() => {
      setIsOpen(false);
      // If input doesn't match a valid selection, revert or clear
      if (!value) {
        setInputText('');
      } else {
        setInputText(value);
      }
    }, 150);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      return;
    }

    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = activeIndex < filtered.length - 1 ? activeIndex + 1 : 0;
        setActiveIndex(next);
        scrollToIndex(next);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = activeIndex > 0 ? activeIndex - 1 : filtered.length - 1;
        setActiveIndex(prev);
        scrollToIndex(prev);
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filtered.length) {
          const selected = filtered[activeIndex];
          if (selected) selectCountry(selected.country);
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
        break;
      }
      case 'Home': {
        if (filtered.length > 0) {
          e.preventDefault();
          setActiveIndex(0);
          scrollToIndex(0);
        }
        break;
      }
      case 'End': {
        if (filtered.length > 0) {
          e.preventDefault();
          setActiveIndex(filtered.length - 1);
          scrollToIndex(filtered.length - 1);
        }
        break;
      }
    }
  }

  function scrollToIndex(index: number) {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[index] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }

  const activeOptionId = activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  return (
    <div className="relative">
      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={value} />

      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen && filtered.length > 0}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        autoComplete="off"
        required={required}
        placeholder={placeholder}
        value={inputText}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
      />

      {isOpen && filtered.length > 0 && (
        <div
          id={listboxId}
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {filtered.map((c, i) => (
            <div
              key={c.alpha2}
              id={`${listboxId}-option-${i}`}
              role="option"
              tabIndex={-1}
              aria-selected={i === activeIndex}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectCountry(c.country)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') selectCountry(c.country);
              }}
              className={`cursor-pointer rounded-md px-3 py-2 text-sm transition-colors ${
                i === activeIndex
                  ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800'
              }`}
            >
              {c.country}
            </div>
          ))}
        </div>
      )}

      {isOpen && inputText && filtered.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No countries found.</p>
        </div>
      )}
    </div>
  );
}
