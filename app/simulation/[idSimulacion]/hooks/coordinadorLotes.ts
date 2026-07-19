import type { EventoBatch } from '@/app/shared/types/Evento';

export type LoteFisico = EventoBatch & { indiceFisico: number; versionPlan: number };
export type ResultadoRecepcion =
  | { estado: 'control' | 'duplicado' | 'obsoleto' | 'simulacion-invalida' }
  | { estado: 'aceptado'; reemplazoActual: boolean; huecoDetectado: boolean };

/** Mantiene como máximo un lote actual y uno siguiente; el resto queda ordenado. */
export class CoordinadorLotes {
  loteActual: LoteFisico | null = null;
  loteSiguiente: LoteFisico | null = null;
  colaPosterior: LoteFisico[] = [];
  versionPlan = -1;
  ultimoIndiceConsumido = -1;
  private readonly simulacionId: string;

  constructor(simulacionId: string) {
    this.simulacionId = simulacionId;
  }

  recibir(lote: EventoBatch): ResultadoRecepcion {
    if (lote.simulacionId !== this.simulacionId) return { estado: 'simulacion-invalida' };
    const version = lote.versionPlan ?? 0;
    if (lote.indiceFisico == null) {
      if (version > this.versionPlan) {
        this.versionPlan = version;
        this.loteSiguiente = null;
        this.colaPosterior = [];
      }
      return { estado: 'control' };
    }

    const indice = lote.indiceFisico;
    if (version < this.versionPlan || indice <= this.ultimoIndiceConsumido) return { estado: 'obsoleto' };

    let reemplazoActual = false;
    if (version > this.versionPlan) {
      this.versionPlan = version;
      this.loteSiguiente = null;
      this.colaPosterior = [];
      if (this.loteActual && this.loteActual.indiceFisico === indice) {
        this.loteActual = this.normalizar(lote, version);
        reemplazoActual = true;
      }
    }

    const normalizado = this.normalizar(lote, version);
    if (this.loteActual?.indiceFisico === indice) {
      if (this.loteActual.versionPlan === version && !reemplazoActual) return { estado: 'duplicado' };
      this.loteActual = normalizado;
      reemplazoActual = true;
    } else {
      const pendientes = [this.loteSiguiente, ...this.colaPosterior].filter(Boolean) as LoteFisico[];
      if (pendientes.some(item => item.indiceFisico === indice && item.versionPlan === version)) {
        return { estado: 'duplicado' };
      }
      const sinMismaVentana = pendientes.filter(item => item.indiceFisico !== indice);
      sinMismaVentana.push(normalizado);
      sinMismaVentana.sort((a, b) => a.indiceFisico - b.indiceFisico || b.versionPlan - a.versionPlan);
      if (!this.loteActual) this.loteActual = sinMismaVentana.shift() ?? null;
      this.repartirPendientes(sinMismaVentana);
    }

    return { estado: 'aceptado', reemplazoActual, huecoDetectado: this.hayHueco() };
  }

  promover(): LoteFisico | null {
    if (!this.loteActual) return null;
    this.ultimoIndiceConsumido = Math.max(this.ultimoIndiceConsumido, this.loteActual.indiceFisico);
    if (!this.loteSiguiente || this.loteSiguiente.indiceFisico !== this.ultimoIndiceConsumido + 1) {
      this.loteActual = null;
      return null;
    }
    this.loteActual = this.loteSiguiente;
    this.repartirPendientes(this.colaPosterior);
    return this.loteActual;
  }

  limpiar() {
    this.loteActual = null;
    this.loteSiguiente = null;
    this.colaPosterior = [];
    this.versionPlan = -1;
    this.ultimoIndiceConsumido = -1;
  }

  private normalizar(lote: EventoBatch, versionPlan: number): LoteFisico {
    return {
      ...lote,
      indiceFisico: lote.indiceFisico!,
      versionPlan,
      eventos: [...lote.eventos].sort((a, b) =>
        new Date(a.fechaHoraEvento).getTime() - new Date(b.fechaHoraEvento).getTime()),
    };
  }

  private repartirPendientes(pendientes: LoteFisico[]) {
    const ordenados = [...pendientes].sort((a, b) => a.indiceFisico - b.indiceFisico);
    const esperado = (this.loteActual?.indiceFisico ?? this.ultimoIndiceConsumido) + 1;
    this.loteSiguiente = ordenados[0]?.indiceFisico === esperado ? ordenados.shift()! : null;
    this.colaPosterior = ordenados;
  }

  private hayHueco() {
    if (!this.loteActual) return false;
    const primeroPendiente = this.loteSiguiente ?? this.colaPosterior[0];
    return !!primeroPendiente && primeroPendiente.indiceFisico > this.loteActual.indiceFisico + 1;
  }
}

export function esLoteFisicoVacio(lote: LoteFisico | null): boolean {
  return !!lote && lote.eventos.length === 0;
}

export function instanteInicialLote(lote: LoteFisico): number {
  const valor = lote.eventos[0]?.fechaHoraEvento ?? lote.ventanaInicio;
  const epoch = valor ? new Date(valor).getTime() : Number.NaN;
  if (!Number.isFinite(epoch)) throw new Error('El lote físico no tiene un inicio temporal válido');
  return epoch;
}
