import { Aeropuerto } from './types/Aeropuerto';

const pad = (value: number) => value.toString().padStart(2, '0');

export function formatUtcDisplay(
  value: string | number | Date | null | undefined,
  showSeconds?: boolean,
): string {
  if (value == null) return 'No disponible';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'No disponible';
  const sec = showSeconds ? `:${pad(date.getUTCSeconds())}` : '';
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}${sec} UTC`;
}

export function formatShortDateTime(
  value: string | number | Date | null | undefined,
): string {
  if (value == null) return '--';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  const yy = String(date.getUTCFullYear()).slice(-2);
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${yy}-${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function formatAirportLocalDisplay(
  value: string | number | Date | null | undefined,
  aeropuerto?: Pick<Aeropuerto, 'codigoIata' | 'gmt'> | null,
  showSeconds?: boolean,
): string {
  if (value == null || !aeropuerto) return 'No disponible';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'No disponible';
  const localMs = date.getTime() + aeropuerto.gmt * 60 * 60 * 1000;
  const local = new Date(localMs);
  const sec = showSeconds ? `:${pad(local.getUTCSeconds())}` : '';
  return `${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)}/${local.getUTCFullYear()} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}${sec} ${aeropuerto.codigoIata}`;
}

export function toDateTimeLocalInput(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) {
    return value.slice(0, 16);
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function nowDateTimeLocalInput(gmt : number): string {
  return toDateTimeLocalInput(new Date(Date.now() + 1000*60*60*(gmt+5)));
}

export function formatGmtOffset(gmt: number): string {
  const sign = gmt >= 0 ? '+' : '-';
  return `GMT${sign}${Math.abs(gmt)}`;
}

export function convertLocalToUtcDisplay(localDateTimeStr: string, gmt: number): string {
  if (!localDateTimeStr) return '--';
  const localDate = new Date(localDateTimeStr);
  if (Number.isNaN(localDate.getTime())) return '--';
  const utcMs = localDate.getTime() - gmt * 60 * 60 * 1000;
  const utcDate = new Date(utcMs);
  return `${pad(utcDate.getUTCDate())}/${pad(utcDate.getUTCMonth() + 1)}/${utcDate.getUTCFullYear()} ${pad(utcDate.getUTCHours())}:${pad(utcDate.getUTCMinutes())} UTC`;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const prefix = days > 0 ? `${days}d ` : '';
  return `${prefix}${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}
