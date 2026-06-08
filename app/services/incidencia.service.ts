import axiosApi from './config/axios'

export type IncidenciaDTO = {
  id?: number
  fechaHora: string        // ISO datetime
  descripcion: string
  origenIata: string
  noPuedeRecibir: boolean
  noPuedeEnviar: boolean
  tiempoRecuperacionMinutos: number
}

export const IncidenciaService = {
  listarIncidencias: () =>
    axiosApi.get<IncidenciaDTO[]>('/incidencias'),

  crearIncidencia: (data: IncidenciaDTO) =>
    axiosApi.post<IncidenciaDTO>('/incidencias', data),

  actualizarIncidencia: (id: number, data: IncidenciaDTO) =>
    axiosApi.put<IncidenciaDTO>(`/incidencias/${id}`, data),

  eliminarIncidencia: (id: number) =>
    axiosApi.delete(`/incidencias/${id}`),
}
