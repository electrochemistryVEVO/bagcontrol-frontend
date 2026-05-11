import { Aeropuerto } from '../shared/types/Aeropuerto'
import axiosApi from './config/axios'

export const AeropuertoService = {
    listarAeropuertos : () => axiosApi.get<Aeropuerto[]>('/aeropuertos')
}