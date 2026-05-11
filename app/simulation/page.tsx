'use client'
import {
    Map,
    MapGeoJSONFeature,
    MapLayerMouseEvent,
    MapSourceDataEvent,
    Marker,
    Popup,
    PopupInstance
} from '@vis.gl/react-maplibre';
import {useEffect, useRef, useState} from "react";
import {Aeropuerto} from "../shared/models/Aeropuerto";
import {ObtenerAeropuertos} from "@/app/services/simulation.service";
import RoomIcon from '@mui/icons-material/Room';
import {FeatureCollection} from "geojson";
import 'maplibre-gl/dist/maplibre-gl.css';
import {Source,Layer,CircleLayerSpecification} from "@vis.gl/react-maplibre";


export default function Home(){
    const [airports,setAirports] = useState<Aeropuerto[]>([]);
    const [showPopup,setShowPopup] = useState(false);
    const [selAirport,setSelAirport] = useState<MapGeoJSONFeature|null>(null);
    const popupRef = useRef<PopupInstance|null>(null);
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
            onMouseEnter={(event : MapLayerMouseEvent)=>{
                console.log("over")
                setSelAirport(event.features ? event.features[0] : null)
                setShowPopup(true)
            }}
            onMouseLeave={()=>{console.log("left");setShowPopup(false)}}
            interactiveLayerIds={["point"]}
        >
            <AirportMarkers airports={airports} showPopup={showPopup} selAirport={selAirport}/>
        </Map>
    </div>);
}

type AirportMarkersProps = {
    airports : Aeropuerto[]
    showPopup : boolean
    selAirport : MapGeoJSONFeature|null
}

function AirportMarkers(props : AirportMarkersProps){
    const geojson : FeatureCollection = {
        type: "FeatureCollection",
        features: props.airports.map((airport)=>({
            type: "Feature",
            properties: {...airport},
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
    const popupRef = useRef<PopupInstance|null>(null);

    useEffect(() => {
        popupRef.current?.trackPointer();
        console.log(popupRef.current ? "true" : "false")
        console.log("son")
    })

    const showPopup = props.showPopup
    const selAirport = props.selAirport
    //const [showPopup,setShowPopup] = useState(false);
    //const [selAirport,setSelAirport] = useState<Aeropuerto|null>(null);
    return (<>
        {showPopup ? (
            <Popup longitude={-100} latitude={40}
                   anchor="bottom" ref={popupRef}>
                <b>{selAirport?.properties.codigoIata}</b>
                <p>{selAirport?.properties.cantidadAlmacen}/{selAirport?.properties.capacidadAlmacen} maletas</p>
            </Popup>) : (<div></div>)}
        <Source id="my-data" type="geojson" data={geojson}>
            <Layer {...layerStyle} />
        </Source>
    </>)
}