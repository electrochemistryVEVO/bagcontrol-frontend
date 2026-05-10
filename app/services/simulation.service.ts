import Aeropuertos from '@/assets/mockdata/mockAeropuerto.json'
import {Aeropuerto} from "@/app/shared/models/Aeropuerto";

export async function ObtenerAeropuertos() : Promise<Aeropuerto[]>{
    //Funcion con mock data
    const {data} = Aeropuertos;
    const res = [];
    for(const obj of data){res.push(new Aeropuerto(obj))}
    return res;
}