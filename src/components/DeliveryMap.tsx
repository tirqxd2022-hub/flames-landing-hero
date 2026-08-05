import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) || "/api";

// react-leaflet's default marker assets break under Vite. Inline SVG keeps it
// dependency-free and matches the flame branding.
const makeIcon = (color: string, glyph: string) =>
  L.divIcon({
    className: "",
    iconSize: [32, 40],
    iconAnchor: [16, 38],
    html: `
      <div style="position:relative;width:32px;height:40px;">
        <div style="position:absolute;inset:0;display:flex;align-items:flex-start;justify-content:center;">
          <svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C7.2 0 0 6.8 0 15.2 0 26.4 16 40 16 40s16-13.6 16-24.8C32 6.8 24.8 0 16 0z"
              fill="${color}" stroke="rgba(0,0,0,0.35)" stroke-width="1"/>
            <circle cx="16" cy="15" r="6" fill="white"/>
          </svg>
        </div>
        <div style="position:absolute;top:8px;left:0;right:0;text-align:center;font:600 12px/14px system-ui;color:${color};">
          ${glyph}
        </div>
      </div>`,
  });

const pickupIcon = L.divIcon({
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  html: `<div style="width:24px;height:24px;border-radius:50%;background:#10b981;border:3px solid white;box-shadow:0 0 0 1px rgba(0,0,0,.4);"></div>`,
});
const dropoffIcon = makeIcon("#ef4444", "");
const courierIcon = makeIcon("#f59e0b", "•");
const customerIcon = L.divIcon({
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#38bdf8;border:3px solid white;box-shadow:0 0 0 1px rgba(0,0,0,.5),0 0 0 6px rgba(56,189,248,.25);"></div>`,
});

type LatLng = { lat: number; lng: number };
type LiveData = {
  status: string | null;
  trackingUrl: string | null;
  courierName: string | null;
  courierPhone: string | null;
  dropoffEta: string | null;
  pickup: LatLng | null;
  dropoff: LatLng | null;
  courier: LatLng | null;
  customer: (LatLng & { at?: string | null }) | null;
};

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 15);
    } else {
      const b = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
      map.fitBounds(b, { padding: [40, 40], maxZoom: 16 });
    }
  }, [map, points]);
  return null;
}

export default function DeliveryMap({ orderNumber }: { orderNumber: string }) {
  const [data, setData] = useState<LiveData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/delivery/${encodeURIComponent(orderNumber)}/live`);
        if (!r.ok) return;
        const j = (await r.json()) as LiveData;
        if (!cancelled) setData(j);
      } catch { /* ignore */ }
    };
    load();
    const id = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [orderNumber]);

  const points = useMemo(() => {
    if (!data) return [];
    return [data.pickup, data.dropoff, data.courier, data.customer].filter(Boolean) as LatLng[];
  }, [data]);

  if (!data || points.length === 0) {
    return (
      <div className="rounded-lg bg-white/5 border border-white/10 p-4 text-xs text-muted-foreground text-center">
        Map will appear once the courier route is available.
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden border border-white/10" style={{ height: 280 }}>
      <MapContainer
        center={[points[0].lat, points[0].lng]}
        zoom={14}
        style={{ height: "100%", width: "100%", background: "#0b0b0b" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {data.pickup && (
          <Marker position={[data.pickup.lat, data.pickup.lng]} icon={pickupIcon}>
            <Popup>Pickup — store</Popup>
          </Marker>
        )}
        {data.dropoff && (
          <Marker position={[data.dropoff.lat, data.dropoff.lng]} icon={dropoffIcon}>
            <Popup>Your address</Popup>
          </Marker>
        )}
        {data.courier && (
          <Marker position={[data.courier.lat, data.courier.lng]} icon={courierIcon}>
            <Popup>
              {data.courierName || "Courier"}
              {data.courierPhone && <><br /><a href={`tel:${data.courierPhone}`}>{data.courierPhone}</a></>}
            </Popup>
          </Marker>
        )}
        {data.customer && (
          <Marker position={[data.customer.lat, data.customer.lng]} icon={customerIcon}>
            <Popup>Your live location</Popup>
          </Marker>
        )}
        {data.pickup && data.dropoff && (
          <Polyline
            positions={[
              [data.pickup.lat, data.pickup.lng],
              ...(data.courier ? [[data.courier.lat, data.courier.lng] as [number, number]] : []),
              [data.dropoff.lat, data.dropoff.lng],
            ]}
            pathOptions={{ color: "#f59e0b", weight: 3, opacity: 0.7, dashArray: "6 6" }}
          />
        )}
      </MapContainer>
    </div>
  );
}
