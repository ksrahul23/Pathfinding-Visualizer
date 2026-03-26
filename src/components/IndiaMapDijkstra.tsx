'use client';

import React, { useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMap, useMapEvent } from 'react-leaflet';
import L, { LatLngExpression, LatLngLiteral, LeafletMouseEvent } from 'leaflet';

const INDIA_CENTER: LatLngExpression = [22.3511148, 78.6677428];

const startIcon = new L.DivIcon({
    className: 'start-marker',
    html: '<div style="width:14px;height:14px;background:#22c55e;border:2px solid #16a34a;border-radius:50%;box-shadow:0 0 12px rgba(34,197,94,0.8)"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7]
});

const endIcon = new L.DivIcon({
    className: 'end-marker',
    html: '<div style="width:14px;height:14px;background:#ef4444;border:2px solid #b91c1c;border-radius:50%;box-shadow:0 0 12px rgba(239,68,68,0.8)"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7]
});

function FlyToRoute({ coords }: { coords: LatLngExpression[] }) {
    const map = useMap();
    useEffect(() => {
        if (coords.length >= 2) {
            const bounds = L.latLngBounds(coords as [number, number][]);
            map.fitBounds(bounds.pad(0.2));
        }
    }, [coords, map]);
    return null;
}

function ClickToSet({
    onSelect
}: {
    onSelect: (latlng: LatLngLiteral) => void;
}) {
    useMapEvent('click', (e: LeafletMouseEvent) => {
        onSelect(e.latlng);
    });
    return null;
}

async function fetchOsrmRoute(start: LatLngLiteral, end: LatLngLiteral) {
    const coords = `${start.lng},${start.lat};${end.lng},${end.lat}`;
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&alternatives=false&steps=false`; 
    const res = await fetch(url);
    if (!res.ok) throw new Error('Routing service error');
    const data = await res.json();
    if (!data.routes || data.routes.length === 0) throw new Error('No route found');
    const route = data.routes[0];
    const geometry = route.geometry.coordinates as [number, number][]; // [lon, lat]
    const latlngs: LatLngExpression[] = geometry.map(([lon, lat]) => [lat, lon]);
    const distanceKm = Math.round(route.distance / 100) / 10; // km, 1 decimal
    const durationMin = Math.round(route.duration / 6) / 10; // minutes, 1 decimal
    return { latlngs, distanceKm, durationMin };
}

export default function IndiaMapDijkstra() {
    const [start, setStart] = useState<LatLngLiteral | null>(null);
    const [end, setEnd] = useState<LatLngLiteral | null>(null);
    const [routeCoords, setRouteCoords] = useState<LatLngExpression[]>([]);
    const [animatedCount, setAnimatedCount] = useState(0);
    const [speed, setSpeed] = useState<'slow' | 'normal' | 'fast'>('fast');
    const [distanceKm, setDistanceKm] = useState<number | null>(null);
    const [durationMin, setDurationMin] = useState<number | null>(null);
    const [isRouting, setIsRouting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
        if (!start || !end) return;
        let isCancelled = false;
        setIsRouting(true);
        setError(null);
        setAnimatedCount(0);
        fetchOsrmRoute(start, end)
            .then(({ latlngs, distanceKm, durationMin }) => {
                if (isCancelled) return;
                setRouteCoords(latlngs);
                setDistanceKm(distanceKm);
                setDurationMin(durationMin);
                setIsComplete(false);
            })
            .catch((e) => {
                if (isCancelled) return;
                setRouteCoords([]);
                setDistanceKm(null);
                setDurationMin(null);
                setError(e.message || 'Failed to compute route');
                setIsComplete(false);
            })
            .finally(() => !isCancelled && setIsRouting(false));
        return () => { isCancelled = true; };
    }, [start, end]);

    useEffect(() => {
        if (routeCoords.length === 0) return;
        setAnimatedCount(0);
        const baseMs = speed === 'fast' ? 8 : speed === 'normal' ? 14 : 24;
        const step = Math.max(1, Math.ceil(routeCoords.length / 1800));
        const timer = setInterval(() => {
            setAnimatedCount((c) => {
                if (c >= routeCoords.length) { clearInterval(timer); setIsComplete(true); return c; }
                const next = Math.min(routeCoords.length, c + step);
                return next;
            });
        }, baseMs);
        return () => clearInterval(timer);
    }, [routeCoords, speed]);

    const instructions = !start
        ? 'Click anywhere on the map to set START'
        : !end
            ? 'Click anywhere to set END'
            : isRouting
                ? 'Finding best route...'
                : 'Click again to reset START at a new point';

    function handleMapSelect(latlng: LatLngLiteral) {
        if (!start) {
            setStart(latlng);
            setEnd(null);
            setRouteCoords([]);
            setDistanceKm(null);
            setDurationMin(null);
            setIsComplete(false);
        } else if (!end) {
            setEnd(latlng);
        } else {
            setStart(latlng);
            setEnd(null);
            setRouteCoords([]);
            setDistanceKm(null);
            setDurationMin(null);
            setIsComplete(false);
        }
    }

    const gmapsUrl = React.useMemo(() => {
        if (!start || !end) return null;
        return `https://www.google.com/maps/dir/?api=1&origin=${start.lat},${start.lng}&destination=${end.lat},${end.lng}&travelmode=driving`;
    }, [start, end]);

    return (
        <div className="bg-black min-h-screen text-gray-200">
            <div className="px-6 py-4 flex flex-wrap items-center gap-4 border-b border-gray-800 bg-gradient-to-r from-cyan-900/20 via-transparent to-yellow-900/10">
                <div className="text-zinc-200 font-semibold tracking-wide">Real-world Dijkstra (OSRM) on India Map</div>
                <div className="text-xs sm:text-sm text-gray-400 px-2 py-1 rounded bg-gray-900/60 border border-gray-800">{instructions}</div>
                <div className="ml-auto flex items-center gap-2 text-sm">
                    <div className="hidden sm:flex items-center gap-2 mr-2">
                        <span className="text-gray-400">Speed</span>
                        <div className="flex rounded border border-gray-700 overflow-hidden">
                            <button className={`px-2 py-1 ${speed==='slow'?'bg-gray-800 text-gray-200':'text-gray-400 hover:bg-gray-800'}`} onClick={() => setSpeed('slow')}>Slow</button>
                            <button className={`px-2 py-1 ${speed==='normal'?'bg-gray-800 text-gray-200':'text-gray-400 hover:bg-gray-800'}`} onClick={() => setSpeed('normal')}>Normal</button>
                            <button className={`px-2 py-1 ${speed==='fast'?'bg-gray-800 text-gray-200':'text-gray-400 hover:bg-gray-800'}`} onClick={() => setSpeed('fast')}>Fast</button>
                        </div>
                    </div>
                    {distanceKm != null && durationMin != null && (
                        <div className="flex items-center gap-3">
                            <span className="px-2 py-0.5 rounded bg-green-900/30 border border-green-700 text-green-300">{distanceKm} km</span>
                            <span className="px-2 py-0.5 rounded bg-yellow-900/30 border border-yellow-700 text-yellow-300">{durationMin} min</span>
                        </div>
                    )}
                    <button
                        className="px-2 py-1 rounded border border-gray-700 text-gray-300 hover:bg-gray-800"
                        onClick={() => { setStart(null); setEnd(null); setRouteCoords([]); setDistanceKm(null); setDurationMin(null); setError(null); }}
                    >
                        Reset
                    </button>
                </div>
            </div>
            <div style={{ height: 'calc(100vh - 60px)', position: 'relative' }}>
                <MapContainer center={INDIA_CENTER} zoom={5} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution="&copy; OpenStreetMap contributors"
                    />

                    <div className="leaflet-top leaflet-right" style={{ zIndex: 1000, pointerEvents: 'none' }}>
                        <div className="leaflet-control bg-black/80 backdrop-blur-md text-gray-200 border border-cyan-800 p-4 rounded-xl shadow-2xl m-4 pointer-events-auto max-w-sm">
                            <h3 className="font-bold text-cyan-400 mb-2 flex items-center gap-2">
                                <span>🌐</span> Dijkstra in the Real World
                            </h3>
                            <p className="text-sm opacity-90 leading-relaxed text-gray-300">
                                This map uses OSRM (Open Source Routing Machine), which computes shortest paths on real-world road networks based on distance/time weights. The underlying concept demonstrates how Dijkstra&apos;s Algorithm scales to conquer massive, complex graphs like earthly road systems globally!
                            </p>
                        </div>
                    </div>

                    <ClickToSet onSelect={handleMapSelect} />

                    {start && <Marker position={start} icon={startIcon} />}
                    {end && <Marker position={end} icon={endIcon} />}

                    {routeCoords.length > 1 && (
                        <>
                            {/* Glow shadow */}
                            <Polyline positions={routeCoords} pathOptions={{ color: '#06b6d4', weight: 10, opacity: 0.15 }} />
                            {/* Dark shadow */}
                            <Polyline positions={routeCoords} pathOptions={{ color: '#111827', weight: 8, opacity: 0.6 }} />
                            {/* Main route */}
                            <Polyline positions={routeCoords.slice(0, animatedCount)} pathOptions={{ color: '#fbbf24', weight: 6, opacity: 0.95, lineCap: 'round' }} />
                            {/* Bright head segment */}
                            {animatedCount > 2 && (
                                <Polyline positions={routeCoords.slice(Math.max(0, animatedCount - 12), animatedCount)} pathOptions={{ color: '#22d3ee', weight: 8, opacity: 0.6, lineCap: 'round' }} />
                            )}
                            {/* Moving head dot */}
                            {animatedCount > 0 && animatedCount <= routeCoords.length && (
                                <CircleMarker center={routeCoords[Math.min(animatedCount - 1, routeCoords.length - 1)] as LatLngExpression} radius={6} pathOptions={{ color: '#22d3ee', fillColor: '#22d3ee', fillOpacity: 1, weight: 2 }} />
                            )}
                            <FlyToRoute coords={routeCoords} />
                        </>
                    )}
                </MapContainer>
            </div>
            {isComplete && gmapsUrl && (
                <div className="fixed right-4 bottom-20 bg-gray-900/90 border border-gray-700 rounded-lg shadow-xl px-4 py-3 flex items-center gap-3 pointer-events-auto" style={{ zIndex: 1000 }}>
                    <div className="text-sm text-gray-300">Open this route in Google Maps</div>
                    <a
                        href={gmapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-zinc-200 text-black font-medium text-sm"
                    >
                        Open
                    </a>
                </div>
            )}
            {error && (
                <div className="px-6 py-2 text-red-400 text-sm">{error}</div>
            )}
        </div>
    );
}

