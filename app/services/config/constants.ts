export const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8080/api"

export const INIT_WEB_SOCKET_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  "http://localhost:8080/ws/simulacion"
