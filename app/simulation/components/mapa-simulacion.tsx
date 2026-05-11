'use client';

import {
  Map,
  MapGeoJSONFeature,
  MapLayerMouseEvent,
  Popup,
  PopupInstance,
  Source,
  Layer,
  CircleLayerSpecification,
} from '@vis.gl/react-maplibre';
import { useMemo, useRef, useState } from 'react';
import { FeatureCollection } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Aeropuerto, AeropuertoSimulacion } from '@/app/shared/types/Aeropuerto';
import { useSimulacion } from '../hooks/useSimulacion';


const layerStyle: CircleLayerSpecification = {
  id: 'point',
  type: 'circle',
  source: 'aeropuertos-data',
  paint: {
    'circle-radius': 10,
    'circle-color': '#007cbf',
  },
};

interface Props {
    aeropuertosIniciales: Aeropuerto[]
}

export function MapaSimulacion({ aeropuertosIniciales }: Props) {

  const { aeropuertos } = useSimulacion(aeropuertosIniciales);

  const [showPopup, setShowPopup] = useState(false);
  const [selAirport, setSelAirport] = useState<MapGeoJSONFeature | null>(null);
  const popupRef = useRef<PopupInstance | null>(null);

  const geojson: FeatureCollection = useMemo(() => ({
    type: 'FeatureCollection',
    features: aeropuertos.map((airport) => ({
      type: 'Feature',
      properties: { ...airport },
      geometry: {
        type: 'Point',
        coordinates: [airport.longitud, airport.latitud],
      },
    })),
  }), [aeropuertos]);

  const handleMouseEnter = (event: MapLayerMouseEvent) => {
    setSelAirport(event.features?.[0] ?? null);
    setShowPopup(true);
    popupRef.current?.trackPointer();
  };

  return (
    <Map
      initialViewState={{ longitude: 0, latitude: 0, zoom: 3.5 }}
      mapStyle="https://demotiles.maplibre.org/style.json"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowPopup(false)}
      interactiveLayerIds={['point']}
    >
      <Source id="aeropuertos-data" type="geojson" data={geojson}>
        <Layer {...layerStyle} />
      </Source>

      {showPopup && selAirport && (
        <Popup
          longitude={selAirport.geometry.type === 'Point' ? (selAirport.geometry.coordinates[0] as number) : 0}
          latitude={selAirport.geometry.type === 'Point' ? (selAirport.geometry.coordinates[1] as number) : 0}
          anchor="bottom"
          ref={popupRef}
          closeButton={false}
        >
          <b>{selAirport.properties?.codigoIata}</b>
          <p>
            {selAirport.properties?.cantidadAlmacen}/
            {selAirport.properties?.capacidadAlmacen} maletas
          </p>
        </Popup>
      )}
    </Map>
  );
}