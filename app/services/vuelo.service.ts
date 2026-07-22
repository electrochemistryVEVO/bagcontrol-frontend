import axiosApi from './config/axios'

export type VueloDTO = {
  codigo?: number
  origenIata: string
  destinoIata: string
  horaSalida: string
  horaLlegada: string
  capacidadMax: number
  estaCancelado: boolean
}

export type VueloPayload = {
  origenIata: string
  destinoIata: string
  horaSalida: string
  horaLlegada: string
  capacidadMax: number
  estaCancelado: boolean
}

type VueloListResponse =
  | VueloDTO[]
  | { content: VueloDTO[] }
  | { data: VueloDTO[] }

const normalizarListaVuelos = (response: VueloListResponse): VueloDTO[] => {
  if (Array.isArray(response)) return response
  if ('content' in response && Array.isArray(response.content)) return response.content
  if ('data' in response && Array.isArray(response.data)) return response.data
  throw new Error('Formato de respuesta inesperado al listar vuelos')
}

export const VueloService = {
  listarVuelos: async (): Promise<VueloDTO[]> => {
    const response = await axiosApi.get<VueloListResponse>('/vuelos')
    return normalizarListaVuelos(response.data)
  },

  crearVuelo: async (data: VueloPayload): Promise<VueloDTO> => {
    const response = await axiosApi.post<VueloDTO>('/vuelos', data)
    return response.data
  },

  actualizarVuelo: async (id: number, data: VueloPayload): Promise<VueloDTO> => {
    const response = await axiosApi.put<VueloDTO>(`/vuelos/${id}`, data)
    return response.data
  },

  cancelarVuelo: (id: number) =>
    axiosApi.post(`/vuelos/${id}/cancelar`),

  eliminarVuelo: (id: number) =>
    axiosApi.delete(`/vuelos/${id}`),

  cargarTxt: (archivo: File) => {
    const fd = new FormData()
    fd.append('archivo', archivo)
    return axiosApi.post<{ insertados: number; errores: string[]; totalFilas: number }>(
      '/vuelos/cargar-txt', fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
  },
}
