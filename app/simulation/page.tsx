'use client'
import {Map, Marker} from '@vis.gl/react-maplibre';
import {useEffect, useState} from "react";
import {Aeropuerto} from "../shared/models/Aeropuerto";
import {ObtenerAeropuertos} from "@/app/services/simulation.service";
import RoomIcon from '@mui/icons-material/Room';
import {FeatureCollection} from "geojson";
import {Source,Layer,CircleLayerSpecification} from "@vis.gl/react-maplibre";

export default function Home(){
    const [airports,setAirports] = useState<Aeropuerto[]>([]);
    useEffect(()=>{
        ObtenerAeropuertos().then((res)=>setAirports(res))
    },[])
    return (<div style={{height: "80vh"}}>Pagina de simulación
        <Map
            initialViewState={{
                longitude: 0,
                latitude: 0,
                zoom: 3.5
            }}
            mapStyle="https://demotiles.maplibre.org/style.json"
        >
            <AirportMarkers airports={airports}/>
        </Map>
    </div>);
}

type AirportMarkersProps = {
    airports : Aeropuerto[]
}

function AirportMarkers(props : AirportMarkersProps){
    const geojson : FeatureCollection = {
        type: "FeatureCollection",
        features: props.airports.map((airport)=>({
            type: "Feature",
            properties: {},
            geometry: {type: "Point",coordinates: [airport.latitud,airport.longitud]}
        }))
    }

    const layerStyle : CircleLayerSpecification = {
        id: 'point',
        type: 'circle',
        source:'my-data',
        paint: {
            'circle-radius': 10,
            'circle-color': '#007cbf'
        }
    };
    return (<>
        <Source id="my-data" type="geojson" data={geojson}>
            <Layer {...layerStyle} />
        </Source>
    </>)
}