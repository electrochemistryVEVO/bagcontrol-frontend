import axiosApi from './config/axios'

export type VueloDTO = {
  codigo?: number
  origenIata: string
  destinoIata: string
  horaSalida: string   // "HH:mm"
  horaLlegada: string  // "HH:mm"
  capacidadMax: number
  estaCancelado?: boolean
}

export const VueloService = {
  listarVuelos: () =>
    axiosApi.get<VueloDTO[]>('/vuelos'),

  crearVuelo: (data: VueloDTO) =>
    axiosApi.post<VueloDTO>('/vuelos', data),

  actualizarVuelo: (id: number, data: VueloDTO) =>
    axiosApi.put<VueloDTO>(`/vuelos/${id}`, data),

  cancelarVuelo: (id: number) =>
    axiosApi.post(`/vuelos/${id}/cancelar`),

  eliminarVuelo: (id: number) =>
    axiosApi.delete(`/vuelos/${id}`),
}
