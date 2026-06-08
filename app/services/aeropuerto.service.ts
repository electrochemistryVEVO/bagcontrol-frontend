import axiosApi from './config/axios'
import { Aeropuerto } from '../shared/types/Aeropuerto'

export type ActualizarAeropuertoDTO = {
  ciudad: string
  pais: string
  continente: string
  gmt: number
  capacidadAlmacen: number
  latitud: number
  longitud: number
}

export type NuevoAeropuertoDTO = ActualizarAeropuertoDTO & {
  codigoIata: string
}

export const AeropuertoService = {
  listarAeropuertos: () =>
    axiosApi.get<Aeropuerto[]>('/aeropuertos'),

  crearAeropuerto: (data: NuevoAeropuertoDTO) =>
    axiosApi.post<Aeropuerto>('/aeropuertos', data),

  actualizarAeropuerto: (iata: string, data: ActualizarAeropuertoDTO) =>
    axiosApi.put<Aeropuerto>(`/aeropuertos/${iata}`, data),

  eliminarAeropuerto: (iata: string) =>
    axiosApi.delete(`/aeropuertos/${iata}`),
}
