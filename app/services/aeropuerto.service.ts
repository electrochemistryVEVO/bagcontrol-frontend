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

type AeropuertoListResponse =
  | Aeropuerto[]
  | { content: Aeropuerto[] }
  | { data: Aeropuerto[] }

const normalizarListaAeropuertos = (response: AeropuertoListResponse): Aeropuerto[] => {
  if (Array.isArray(response)) return response
  if ('content' in response && Array.isArray(response.content)) return response.content
  if ('data' in response && Array.isArray(response.data)) return response.data
  throw new Error('Formato de respuesta inesperado al listar aeropuertos')
}

export const AeropuertoService = {
  listarAeropuertos: async (): Promise<{ data: Aeropuerto[] }> => {
    const response = await axiosApi.get<AeropuertoListResponse>('/aeropuertos')
    return { data: normalizarListaAeropuertos(response.data) }
  },

  crearAeropuerto: async (data: NuevoAeropuertoDTO): Promise<Aeropuerto> => {
    const response = await axiosApi.post<Aeropuerto>('/aeropuertos', data)
    return response.data
  },

  actualizarAeropuerto: async (
    iata: string,
    data: ActualizarAeropuertoDTO,
  ): Promise<Aeropuerto> => {
    const response = await axiosApi.put<Aeropuerto>(`/aeropuertos/${iata}`, data)
    return response.data
  },

  eliminarAeropuerto: (iata: string) =>
    axiosApi.delete(`/aeropuertos/${iata}`),

  cargarCsv: (archivo: File) => {
    const fd = new FormData()
    fd.append('archivo', archivo)
    return axiosApi.post<{ insertados: number; errores: string[]; totalFilas: number }>(
      '/aeropuertos/cargar-csv', fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
  },
}
