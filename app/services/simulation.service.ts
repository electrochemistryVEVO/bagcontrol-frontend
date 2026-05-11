import Aeropuertos from '@/assets/mockdata/mockAeropuerto.json'
import {Aeropuerto} from "@/app/shared/models/Aeropuerto";

export async function ObtenerAeropuertosMock(): Promise<Aeropuerto[]> {
    //MOCK DATA
    return Aeropuertos.data as Aeropuerto[];
}


