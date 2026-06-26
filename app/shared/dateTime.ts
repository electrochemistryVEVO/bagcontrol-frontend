import { Aeropuerto } from './types/Aeropuerto';

const pad = (value: number) => value.toString().padStart(2, '0');

export function formatUtcDisplay(value: string | number | Date | null | undefined): string {
  if (value == null) return 'No disponible';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'No disponible';
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

export function formatAirportLocalDisplay(
  value: string | number | Date | null | undefined,
  aeropuerto?: Pick<Aeropuerto, 'codigoIata' | 'gmt'> | null,
): string {
  if (value == null || !aeropuerto) return 'No disponible';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'No disponible';
  const localMs = date.getTime() + aeropuerto.gmt * 60 * 60 * 1000;
  const local = new Date(localMs);
  return `${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)}/${local.getUTCFullYear()} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())} ${aeropuerto.codigoIata}`;
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

export function nowDateTimeLocalInput(): string {
  return toDateTimeLocalInput(new Date());
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
