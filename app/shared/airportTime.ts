const pad = (value: number) => value.toString().padStart(2, '0')

export function formatAirportLocalTime(epochUtc: number, gmt: number, showSeconds = false): string {
  const local = new Date(epochUtc + gmt * 60 * 60 * 1000)
  if (Number.isNaN(local.getTime())) return 'No disponible'
  const seconds = showSeconds ? `:${pad(local.getUTCSeconds())}` : ''
  return `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}${seconds}`
}

export function airportTimeEpoch(
  isOperationDay: boolean,
  realEpoch: number,
  simulatedEpoch: number,
): number {
  return isOperationDay ? realEpoch : simulatedEpoch
}
