'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
  name: string;
};

type Props = {
  id?: string;
  countryAlpha2: string | null;
  value: string;
  onChange: (city: string, lat: number | null, lng: number | null) => void;
};

export function CityAutocomplete({ id, countryAlpha2, value, onChange }: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = id ? `${id}-listbox` : 'city-listbox';

  const search = useCallback(
    async (q: string) => {
      if (q.length < 3) {
        setResults([]);
        return;
      }
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          q,
          format: 'json',
          limit: '5',
          featuretype: 'city',
        });
        if (countryAlpha2) params.set('countrycodes', countryAlpha2.toLowerCase());
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
          headers: { 'User-Agent': 'TravelPlanner/1.0' },
        });
        if (res.ok) {
          const data: NominatimResult[] = await res.json();
          setResults(data);
          setIsOpen(data.length > 0);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [countryAlpha2],
  );

  function handleInput(val: string) {
    setQuery(val);
    onChange(val, null, null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  }

  function handleSelect(result: NominatimResult) {
    const cityName = result.name || result.display_name.split(',')[0] || '';
    setQuery(cityName);
    setIsOpen(false);
    setResults([]);
    onChange(cityName, Number.parseFloat(result.lat), Number.parseFloat(result.lon));
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => results.length > 0 && setIsOpen(true)}
        placeholder="Search city…"
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-controls={listboxId}
        className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
      />
      {isLoading && <span className="absolute right-3 top-2.5 text-xs text-zinc-400">…</span>}
      {isOpen && results.length > 0 && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {results.map((r) => (
            <div
              key={`${r.lat}-${r.lon}`}
              role="option"
              tabIndex={0}
              aria-selected={false}
              className="cursor-pointer px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              onMouseDown={() => handleSelect(r)}
            >
              {r.display_name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
