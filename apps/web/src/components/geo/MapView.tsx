// Round 21: a thin Leaflet map (OpenStreetMap tiles). Markers are plain CSS dots (ink = member or pin, gold ring = lead, gold star = the club);
// shapes (11 Nov, KC: instead of circles) are whole kelurahan / kecamatan outlines shaded by how many live there. Loaded lazily by the screens that show a map, so Leaflet stays out of the first paint.
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { GeoPoint, GeoShape } from '@cp/shared';

export type MapMarker = { id: string; lat: number; lng: number; kind: 'member' | 'enquiry' | 'club' | 'pin'; label?: string; onClick?: () => void };
export type MapShape = { id: string; shape: GeoShape; color: string; label: string; onClick?: () => void };
export interface MapViewProps {
  center: Pick<GeoPoint, 'lat' | 'lng'>;
  markers: MapMarker[];
  shapes?: MapShape[];
  height: number;
  /** a tap on the map, or the end of a drag of the `pin` marker */
  onPin?: (p: { lat: number; lng: number }) => void;
  draggable?: boolean;
  zoom?: number;
  label?: string;
}

const GOLD = '#CFA550';
const INK = '#24201C';
const html: Record<MapMarker['kind'], string> = {
  member: `<span style="display:block;width:12px;height:12px;border-radius:50%;background:${INK};border:2px solid #fff"></span>`,
  enquiry: `<span style="display:block;width:12px;height:12px;border-radius:50%;background:#fff;border:3px solid ${GOLD}"></span>`,
  pin: `<span style="display:block;width:18px;height:18px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${INK};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35)"></span>`,
  club: `<span style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:${GOLD};color:#fff;font-size:15px;border:2px solid #fff">★</span>`,
};
const size: Record<MapMarker['kind'], number> = { member: 16, enquiry: 18, pin: 22, club: 28 };
const icon = (k: MapMarker['kind']) => L.divIcon({ className: 'cp-map-dot', html: html[k], iconSize: [size[k], size[k]], iconAnchor: k === 'pin' ? [9, 20] : [size[k] / 2, size[k] / 2] });

export function MapView({ center, markers, shapes = [], height, onPin, draggable, zoom = 13, label }: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const onPinRef = useRef(onPin);
  onPinRef.current = onPin;

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true }).setView([center.lat, center.lng], zoom);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => onPinRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // follow the centre when it moves (a search hit), without fighting the user's own panning otherwise
  useEffect(() => { map.current?.panTo([center.lat, center.lng]); }, [center.lat, center.lng]);

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    for (const a of shapes) {
      const r = L.geoJSON(a.shape, { style: { color: '#FFFFFF', weight: 1.5, opacity: 0.9, fillColor: a.color, fillOpacity: 0.6 } })
        .bindTooltip(a.label, { sticky: true })
        .addTo(g);
      if (a.onClick) r.on('click', a.onClick);
    }
    for (const mk of markers) {
      const one = L.marker([mk.lat, mk.lng], { icon: icon(mk.kind), draggable: mk.kind === 'pin' && !!draggable, title: mk.label, zIndexOffset: mk.kind === 'club' ? 1000 : 0 }).addTo(g);
      if (mk.label) one.bindTooltip(mk.label);
      if (mk.onClick) one.on('click', mk.onClick);
      if (mk.kind === 'pin' && draggable) one.on('dragend', () => { const p = one.getLatLng(); onPinRef.current?.({ lat: p.lat, lng: p.lng }); });
    }
  }, [markers, shapes, draggable]);

  return <div ref={el} role="region" aria-label={label} style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden', zIndex: 0, position: 'relative', background: '#EEECE8' }} />;
}
