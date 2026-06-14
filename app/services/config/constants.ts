export const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8090/api"

export const INIT_WEB_SOCKET_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  "http://localhost:8090/ws/simulacion"

export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/bright"
