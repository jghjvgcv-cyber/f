import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Truck, Navigation } from 'lucide-react';
import { DriverLocation } from '../types';

export function FleetMap({ drivers, locations, focusedDriverId }: { drivers: any[], locations: DriverLocation[], focusedDriverId?: string | null }) {
  const activeLocations = locations.filter(loc => {
    const driver = drivers.find(d => d.uid === loc.driverId);
    return driver;
  });

  const focusedLoc = focusedDriverId ? activeLocations.find(l => l.driverId === focusedDriverId) : null;

  const center: [number, number] = (focusedLoc && typeof focusedLoc.latitude === 'number' && typeof focusedLoc.longitude === 'number')
    ? [focusedLoc.latitude, focusedLoc.longitude]
    : (activeLocations.length > 0 && typeof activeLocations[0].latitude === 'number' && typeof activeLocations[0].longitude === 'number'
      ? [activeLocations[0].latitude, activeLocations[0].longitude]
      : [-19.9167, -43.9345]);

  return (
    <div className="space-y-8">
      <div className="bg-white p-4 rounded-[3rem] border border-zinc-100 shadow-2xl shadow-zinc-200/50 overflow-hidden">
        <div className="h-[500px] w-full rounded-[2.5rem] overflow-hidden border border-zinc-100 relative z-0">
          <MapContainer center={center} zoom={focusedLoc ? 16 : 12} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {activeLocations.map(loc => {
              const driver = drivers.find(d => d.uid === loc.driverId);
              const isLive = loc.timestamp && (new Date().getTime() - (loc.timestamp.seconds * 1000)) < 60000;
              return (
                <Marker 
                  key={loc.driverId} 
                  position={[loc.latitude, loc.longitude]}
                  icon={L.divIcon({
                    className: 'custom-div-icon',
                    html: `<div class="w-8 h-8 ${focusedDriverId === loc.driverId ? 'bg-emerald-500 scale-125 ring-4 ring-emerald-500/20' : 'bg-zinc-900'} rounded-full flex items-center justify-center border-2 border-white shadow-xl transition-all duration-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
                          </div>`,
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                  })}
                >
                  <Popup>
                    <div className="p-3 min-w-[150px]">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-black text-zinc-900 uppercase tracking-tight">{driver?.name}</p>
                        {isLive && (
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        )}
                      </div>
                      <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{driver?.plate}</p>
                      <div className="mt-3 pt-3 border-t border-zinc-100">
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Status</p>
                          {isLive && <span className="text-[8px] font-black text-emerald-600 uppercase">Live</span>}
                        </div>
                        <p className="text-[10px] font-black text-zinc-900 uppercase">{loc.status}</p>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>

      {/* Map Stats */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-xl shadow-zinc-200/40">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
              <Truck className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-black text-zinc-900 tracking-tight">{activeLocations.length}</p>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Veículos Ativos</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900 p-8 rounded-[2.5rem] shadow-2xl shadow-zinc-900/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
              <Navigation className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-white tracking-tight">100%</p>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Sinal GPS</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
