import { Aeropuerto } from '../shared/types/Aeropuerto'
import axiosApi from './axios'

export const AeropuertoService = {
    listarAeropuertos : () => axiosApi.get<Aeropuerto[]>('/aeropuertos')
}