import axiosApi from './config/axios'

export type NuevoEnvioDTO = {
  origenIata: string
  destinoIata: string
  cantidadMaletas: number
  idCliente: string
  fechaHora: string // ISO string
}

export const EnvioService = {
  registrarEnvio: (data: NuevoEnvioDTO) =>
    axiosApi.post('/envios', data),

  listarEnviosVentana: (inicio: string, fin: string) =>
    axiosApi.get('/envios/ventana', { params: { inicio, fin } }),

  listarEnviosPorDias: (fechaInicio: string, dias: number) =>
    axiosApi.get('/envios/rango-dias', { params: { fechaInicio, dias } }),
}
