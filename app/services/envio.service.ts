import axiosApi, { axiosSimulacion } from './config/axios'

export type NuevoEnvioDTO = {
  origenIata: string
  destinoIata: string
  cantidadMaletas: number
  idCliente: string
  fechaHora: string // ISO string
}

export type FiltrosEnvios = {
  origenIata?: string
  destinoIata?: string
  idCliente?: string
  q?: string
  maletasMin?: number
  maletasMax?: number
}

export type PageResponse<T> = {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first: boolean
  last: boolean
  empty: boolean
}

export const EnvioService = {
  registrarEnvio: (data: NuevoEnvioDTO) =>
    axiosApi.post('/envios', data),

  listarEnviosVentana: (inicio: string, fin: string) =>
    axiosApi.get('/envios/ventana', { params: { inicio, fin } }),

  listarEnviosPorDias: (fechaInicio: string, dias: number) =>
    axiosSimulacion.get('/envios/rango-dias', { params: { fechaInicio, dias } }),

  listarEnviosPaginados: (
    fechaInicio: string,
    dias: number,
    page: number,
    size: number,
    filtros?: FiltrosEnvios
  ) => {
    const params: Record<string, string | number> = { fechaInicio, dias, page, size }
    if (filtros?.origenIata) params.origenIata = filtros.origenIata
    if (filtros?.destinoIata) params.destinoIata = filtros.destinoIata
    if (filtros?.idCliente) params.idCliente = filtros.idCliente
    if (filtros?.q) params.q = filtros.q
    if (filtros?.maletasMin != null) params.maletasMin = filtros.maletasMin
    if (filtros?.maletasMax != null) params.maletasMax = filtros.maletasMax
    return axiosSimulacion.get<PageResponse<any>>('/envios/paginados', { params })
  },

  cargarCsv: (archivo: File) => {
    const fd = new FormData()
    fd.append('archivo', archivo)
    return axiosApi.post<{ insertados: number; errores: string[]; totalFilas: number }>(
      '/envios/cargar-csv', fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
  },
}
