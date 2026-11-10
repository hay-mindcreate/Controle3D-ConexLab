import { Config, Impressora } from './types';

export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function formatBrl(val: number | null | undefined): string {
  if (val === null || val === undefined) return 'R$ 0,00';
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDec(val: number | null | undefined, places = 2): string {
  if (val === null || val === undefined) return '0';
  return val.toLocaleString('pt-BR', { minimumFractionDigits: places, maximumFractionDigits: places });
}

export interface CalcResult {
  filamento: number;
  energia: number;
  deprec: number;
  mao: number;
  rateio: number;
  embalagem: number;
  acessorios: number;
  falhas: number;
  lote: number;
  custo_lote: number;
  custo: number;
  preco_lote: number | null;
  preco: number | null;
  taxa: number | null;
  lucro: number | null;
}

export function calcular(
  cfg: Config,
  imp: Impressora | null,
  filamentoTotal: number,
  horas: number,
  embalagem = 0,
  acessorios = 0,
  minTrabalho = 0,
  margemPct?: number,
  taxaPct = 0,
  taxaFixa = 0,
  lote = 1
): CalcResult {
  const finalLote = Math.max(Number(lote || 1), 1);
  const margem = margemPct !== undefined && margemPct !== null ? Number(margemPct) : Number(cfg.margem_pct);
  const taxa_p = Number(taxaPct || 0);
  const taxa_f = Number(taxaFixa || 0);

  const energia = imp ? (Number(imp.watts) / 1000) * horas * Number(cfg.kwh) : 0;
  const custoHoraImp = imp ? (imp.vida_h ? Number(imp.valor) / Number(imp.vida_h) : 0) + Number(imp.manutencao_h || 0) : 0;
  const deprec = imp ? horas * custoHoraImp : 0;
  const mao = (Number(minTrabalho) / 60) * Number(cfg.hora_trabalho);
  const rateio = cfg.horas_mes && Number(cfg.horas_mes) > 0 ? (horas * Number(cfg.custos_fixos_mes)) / Number(cfg.horas_mes) : 0;

  const base = filamentoTotal + energia + deprec + mao + rateio + Number(embalagem) + Number(acessorios);
  const falhas = (base * Number(cfg.falhas_pct)) / 100;
  const custoLote = base + falhas;
  const custoUnit = custoLote / finalLote;

  const divisor = 1 - (margem + taxa_p) / 100;
  const precoUnit = divisor > 0 ? (custoUnit + taxa_f) / divisor : null;
  const precoLote = precoUnit !== null ? precoUnit * finalLote : null;
  const taxaUnit = precoUnit !== null ? (precoUnit * taxa_p) / 100 + taxa_f : null;
  const lucroUnit = precoUnit !== null ? (precoUnit * margem) / 100 : null;

  return {
    filamento: round2(filamentoTotal),
    energia: round2(energia),
    deprec: round2(deprec),
    mao: round2(mao),
    rateio: round2(rateio),
    embalagem: round2(embalagem),
    acessorios: round2(acessorios),
    falhas: round2(falhas),
    lote: finalLote,
    custo_lote: round2(custoLote),
    custo: round2(custoUnit),
    preco_lote: precoLote !== null ? round2(precoLote) : null,
    preco: precoUnit !== null ? round2(precoUnit) : null,
    taxa: taxaUnit !== null ? round2(taxaUnit) : null,
    lucro: lucroUnit !== null ? round2(lucroUnit) : null,
  };
}
