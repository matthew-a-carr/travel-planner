'use client';

import type { LatLngTuple } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import type { BudgetWaterfall, WaterfallStop } from '@/domain/trip/types';

function createNumberedIcon(index: number, isOverBudget: boolean, isSelected: boolean) {
  const L = require('leaflet') as typeof import('leaflet');

  const colour = isOverBudget ? '#ef4444' : '#3b82f6';
  const size = isSelected ? 36 : 28;
  const pinHeight = isSelected ? 52 : 40;
  const cx = size / 2;
  const cy = cx;
  const r = isSelected ? 13 : 10;
  const fontSize = isSelected ? 14 : 12;
  const textY = isSelected ? 23 : 18;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${pinHeight}" viewBox="0 0 ${size} ${pinHeight}">
    <path d="M${cx} 0C${cx * 0.45} 0 0 ${cx * 0.45} 0 ${cx}c0 ${pinHeight * 0.375} ${cx} ${pinHeight * 0.65} ${cx} ${pinHeight * 0.65}s${cx}-${pinHeight * 0.275} ${cx}-${pinHeight * 0.65}C${size} ${cx * 0.45} ${cx * 1.55} 0 ${cx} 0z" fill="${colour}"${isSelected ? ' stroke="white" stroke-width="2"' : ''}/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="white"/>
    <text x="${cx}" y="${textY}" text-anchor="middle" font-size="${fontSize}" font-weight="bold" fill="${colour}">${index}</text>
  </svg>`;

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size, pinHeight],
    iconAnchor: [cx, pinHeight],
    popupAnchor: [0, -pinHeight],
  });
}

function formatPence(pence: number): string {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Auto-fits the map bounds whenever pinnable stops change. */
function FitBounds({ positions }: { positions: LatLngTuple[] }) {
  const map = useMap();
  const prevLength = useRef(0);

  useEffect(() => {
    if (positions.length > 0 && positions.length !== prevLength.current) {
      const L = require('leaflet') as typeof import('leaflet');
      map.fitBounds(L.latLngBounds(positions), { padding: [40, 40], maxZoom: 8 });
      prevLength.current = positions.length;
    }
  }, [map, positions]);

  return null;
}

type PinnedStop = WaterfallStop & { coordinates: NonNullable<WaterfallStop['coordinates']> };

type Props = {
  waterfall: BudgetWaterfall;
  selectedStopId: string | null;
  onStopClick: (stopId: string | null) => void;
};

export function JourneyMap({ waterfall, selectedStopId, onStopClick }: Props) {
  const pinnable = useMemo(
    () => waterfall.stops.filter((s): s is PinnedStop => s.coordinates !== null),
    [waterfall.stops],
  );

  if (pinnable.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-lg bg-zinc-50 dark:bg-zinc-800">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Add city coordinates to destinations to see them on the map.
        </p>
      </div>
    );
  }

  const positions: LatLngTuple[] = pinnable.map((s) => [
    s.coordinates.latitude,
    s.coordinates.longitude,
  ]);

  const centre: LatLngTuple = positions.length === 1 ? positions[0] : [0, 0];

  return (
    <div className="relative z-0 h-[400px] overflow-hidden rounded-lg">
      <MapContainer
        center={centre}
        zoom={4}
        scrollWheelZoom={false}
        className="h-full w-full"
        style={{ background: '#f4f4f5' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds positions={positions} />

        {/* Route polyline */}
        {positions.length > 1 && (
          <Polyline
            positions={positions}
            pathOptions={{ color: '#3b82f6', weight: 2, dashArray: '8 6' }}
          />
        )}

        {/* Destination markers */}
        {pinnable.map((stop, i) => (
          <Marker
            key={stop.destinationId ?? `marker-${i}`}
            position={[stop.coordinates.latitude, stop.coordinates.longitude]}
            icon={createNumberedIcon(
              i + 1,
              stop.isOverBudget,
              stop.destinationId === selectedStopId,
            )}
            eventHandlers={{ click: () => onStopClick(stop.destinationId) }}
          >
            <Popup>
              <div className="min-w-[140px] text-sm">
                <p className="font-semibold">{stop.label}</p>
                <p className="mt-1 text-zinc-600">Budget: {formatPence(stop.allocatedPence)}</p>
                <p className={stop.isOverBudget ? 'text-red-600' : 'text-zinc-600'}>
                  Actual: {formatPence(stop.spentPence)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Remaining after: {formatPence(Math.max(stop.runningTotalPence, 0))}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
