import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { LocateFixed, Minus, Plus } from 'lucide-react';
import { supplyChain } from '../utils/product';

const locationCache = new Map();
async function resolveStop(stop, signal) {
  if (stop.coordinates || !stop.location) return stop;
  if (locationCache.has(stop.location)) return { ...stop, ...locationCache.get(stop.location) };
  try {
    const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(stop.location)}&limit=1`, { signal });
    if (!response.ok) return stop;
    const data = await response.json();
    const point = data.features?.[0]?.geometry?.coordinates;
    if (point && Number.isFinite(point[0]) && Number.isFinite(point[1])) {
      const result = { coordinates: [point[1], point[0]], approximate: true };
      locationCache.set(stop.location, result);
      return { ...stop, ...result };
    }
  } catch { /* The recorded address remains available in the journey sheet. */ }
  return stop;
}

export default function SupplyMap({ product, mode, expanded }) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const routeRef = useRef(null);
  const [points, setPoints] = useState([]);
  const [locating, setLocating] = useState(false);
  const [tileError, setTileError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const stops = useMemo(() => supplyChain(product), [product]);
  const fitRef = useRef(() => {});

  useEffect(() => {
    const controller = new AbortController();
    setPoints([]);
    setLocating(stops.some(stop => !stop.coordinates && stop.location));
    Promise.all(stops.map(stop => resolveStop(stop, controller.signal))).then(resolved => {
      if (!controller.signal.aborted) { setPoints(resolved.filter(stop => stop.coordinates)); setLocating(false); }
    });
    return () => controller.abort();
  }, [stops, retryKey]);

  useEffect(() => {
    const map = L.map(container.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: true }).setView([18, 0], 2);
    map.attributionControl.setPrefix(false);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    tiles.on('tileerror', () => setTileError(true));
    tiles.on('tileload', () => setTileError(false));
    mapRef.current = map;
    routeRef.current = L.featureGroup().addTo(map);
    const observer = new ResizeObserver(() => { map.invalidateSize(); fitRef.current(); });
    observer.observe(container.current);
    return () => { observer.disconnect(); map.remove(); mapRef.current = null; };
  }, [retryKey]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = routeRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (points.length > 1) L.polyline(points.map(point => point.coordinates), { className: 'supply-route', weight: 2.5, opacity: 0.8, dashArray: '5 7' }).addTo(layer);
    points.forEach((point, index) => {
      const icon = L.divIcon({ className: 'journey-marker', html: `<span class="map-point ${index === points.length - 1 ? 'destination' : ''}"><i></i></span>`, iconSize: [44, 44], iconAnchor: [22, 22] });
      const popup = document.createElement('div');
      const heading = document.createElement('strong'); heading.textContent = point.role;
      const name = document.createElement('p'); name.textContent = point.name;
      const address = document.createElement('p'); address.textContent = `${point.location}${point.approximate ? ' (approximate)' : ''}`;
      popup.append(heading, name, address);
      L.marker(point.coordinates, { icon, title: `${point.role}: ${point.name}`, keyboard: true }).bindPopup(popup).addTo(layer);
    });
    fitRef.current = () => {
      if (!points.length) return;
      const height = map.getSize().y;
      const landscape = map.getSize().x > height * 1.5;
      const top = landscape ? 100 : mode === 'carousel' ? height * 0.79 : expanded ? 80 : 120;
      const bottom = landscape ? 50 : mode === 'list' ? height * (expanded ? 0.72 : 0.46) : 62;
      const left = landscape && mode === 'carousel' ? map.getSize().x * 0.6 : 46;
      const right = landscape && mode === 'list' ? map.getSize().x * 0.5 : 70;
      map.fitBounds(L.latLngBounds(points.map(point => point.coordinates)), { paddingTopLeft: [left, top], paddingBottomRight: [right, bottom], maxZoom: 14, animate: false });
    };
    fitRef.current();
  }, [points, mode, expanded, retryKey]);

  return <>
    <div className="supply-map" ref={container} aria-label="Interactive supply-chain map. Drag to move and pinch to zoom." />
    <div className="map-top-fade" />
    <div className={`map-controls ${mode}`}>
      <button className="circle-button raised" aria-label="Show entire supply chain" onClick={() => fitRef.current()} disabled={!points.length}><LocateFixed size={21} /></button>
      <div className="map-zoom"><button aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}><Plus size={18} /></button><button aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}><Minus size={18} /></button></div>
    </div>
    <div className={`map-caption ${mode}`} role="status">
      {tileError ? <button onClick={() => setRetryKey(key => key + 1)}>Map unavailable · Retry</button> : locating ? 'Finding supply-chain locations…' : !points.length ? 'No mapped locations for this scan' : `${points.length} supply-chain stops${points.some(point => point.approximate) ? ' · Approximate locations' : ''}`}
    </div>
  </>;
}
