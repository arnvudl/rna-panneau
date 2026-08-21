'use client'

import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useState } from 'react'

const MADAGASCAR_BOUNDS: [number, number, number, number] = [42.0, -26.0, 51.0, -11.5]

const STYLE_PLAN = {
  version: 8 as const,
  sources: {
    osm: { type: 'raster' as const, tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256 },
  },
  layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
}

const STYLE_SATELLITE = {
  version: 8 as const,
  sources: {
    esri: {
      type: 'raster' as const,
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
    },
  },
  layers: [{ id: 'esri', type: 'raster' as const, source: 'esri' }],
}

export type BillboardPin = {
  id: string
  lat: number
  lng: number
  status: string
}

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: '#16a34a',
  RENTED: '#2563eb',
  EXPIRING_SOON: '#f97316',
  EXPIRED: '#dc2626',
  MAINTENANCE: '#6b7280',
}

export function BillboardMap({
  billboards,
  onSelect,
  selectedId,
  onMapRightClick,
}: {
  billboards: BillboardPin[]
  onSelect: (id: string) => void
  selectedId?: string | null
  onMapRightClick?: (lngLat: { lat: number; lng: number }) => void
}) {
  const [satellite, setSatellite] = useState(false)

  return (
    <div className="relative h-full w-full">
      <Map
        initialViewState={{ longitude: 47.0, latitude: -19.0, zoom: 5 }}
        maxBounds={MADAGASCAR_BOUNDS}
        mapStyle={satellite ? STYLE_SATELLITE : STYLE_PLAN}
        onContextMenu={(e) => {
          e.preventDefault()
          onMapRightClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng })
        }}
      >
        <NavigationControl position="top-left" />
        {billboards.map((b) => (
          <Marker key={b.id} longitude={b.lng} latitude={b.lat} onClick={() => onSelect(b.id)}>
            <div
              className="h-4 w-4 cursor-pointer rounded-full border-2 border-white shadow-md transition-transform hover:scale-125"
              style={{
                backgroundColor: STATUS_COLORS[b.status] ?? '#000',
                outline: selectedId === b.id ? '2px solid #1d4ed8' : 'none',
                outlineOffset: selectedId === b.id ? '1px' : undefined,
              }}
            />
          </Marker>
        ))}
      </Map>
      <button
        onClick={() => setSatellite((s) => !s)}
        className="absolute right-3 top-3 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-md transition-colors hover:bg-slate-50"
      >
        {satellite ? 'Vue plan' : 'Vue satellite'}
      </button>
    </div>
  )
}
