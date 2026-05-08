'use client'
import {Map} from '@vis.gl/react-maplibre';

export default function Home(){
    return (<div style={{height: "80vh"}}>Pagina de simulación
        <Map
            initialViewState={{
                longitude: 0,
                latitude: 0,
                zoom: 3.5
            }}
            mapStyle="https://demotiles.maplibre.org/style.json"
        />
    </div>);
}