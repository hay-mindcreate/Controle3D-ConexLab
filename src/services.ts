import { calcular, round2 } from './calc';
import { db } from './db';
import {
  Canal,
  Cliente,
  Config,
  Impressora,
  Insumo,
  ItemOrcamento,
  Lancamento,
  Material,
  MovEstoque,
  Orcamento,
  Pedido,
  PedidoItem,
  Produto,
  Rolo,
  StockAlert,
  Tarefa,
  Venda,
  VendaItem,
} from './types';

export const ORDEM_STATUS = ['aguardando', 'imprimindo', 'acabamento', 'pronto', 'enviado', 'entregue'] as const;

export function addMonths(dateStr: string, n = 1): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const targetDate = new Date(y, m - 1 + n, d);
  const targetYear = targetDate.getFullYear();
  const targetMonth = String(targetDate.getMonth() + 1).padStart(2, '0');
  const targetDay = String(targetDate.getDate()).padStart(2, '0');
  return `${targetYear}-${targetMonth}-${targetDay}`;
}

export function saldos(tipo: 'rolo' | 'insumo' | 'produto'): Record<number, number> {
  const data = db.get();
  const res: Record<number, number> = {};
  for (const m of data.movimentos) {
    if (m.item_tipo === tipo) {
      res[m.item_id] = round2((res[m.item_id] || 0) + Number(m.delta));
    }
  }
  return res;
}

export function saldo(tipo: 'rolo' | 'insumo' | 'produto', itemId: number): number {
  return saldos(tipo)[itemId] || 0;
}

export function custoGMaterial(materialId: number, sd?: Record<number, number>): number {
  const data = db.get();
  const sdRolos = sd || saldos('rolo');
  const rolos = data.rolos.filter((r) => r.material_id === materialId && r.ativo);
  let pesoTotal = 0;
  let custoPonderado = 0;

  for (const r of rolos) {
    const sl = sdRolos[r.id] || 0;
    if (sl > 0) {
      pesoTotal += sl;
      const custoG = r.peso_inicial > 0 ? r.preco / r.peso_inicial : 0;
      custoPonderado += sl * custoG;
    }
  }

  if (pesoTotal > 0) {
    return round2(custoPonderado / pesoTotal);
  }

  if (rolos.length > 0) {
    const last = rolos[rolos.length - 1];
    return last.peso_inicial > 0 ? round2(last.preco / last.peso_inicial) : 0;
  }
  return 0;
}

export function registrarMov(
  tipo: 'rolo' | 'insumo' | 'produto',
  itemId: number,
  delta: number,
  motivo: 'compra' | 'producao' | 'falha' | 'venda' | 'ajuste',
  refTipo = '',
  refId = 0,
  obs = '',
  valor: number | null = null,
  dataCompra: string | null = null,
  fornecedor = ''
) {
  db.update((state) => {
    const newId = state.movimentos.length > 0 ? Math.max(...state.movimentos.map((m) => m.id)) + 1 : 1;
    const now = new Date().toISOString();
    state.movimentos.push({
      id: newId,
      item_tipo: tipo,
      item_id: itemId,
      delta: round2(delta),
      motivo,
      ref_tipo: refTipo,
      ref_id: refId,
      obs,
      em: now,
      valor: valor !== null ? round2(valor) : null,
      data: dataCompra,
      fornecedor,
    });
  });
}

export function baixarRolo(
  roloId: number,
  gramas: number,
  refTipo: string,
  refId: number,
  motivo: 'producao' | 'falha' | 'ajuste' = 'producao',
  obs = ''
): number {
  const data = db.get();
  const rolo = data.rolos.find((r) => r.id === roloId);
  if (!rolo) return gramas;

  let falta = Number(gramas);
  const sd = saldos('rolo');
  const outros = data.rolos.filter((r) => r.material_id === rolo.material_id && r.ativo && r.id !== rolo.id);
  const fila = [rolo, ...outros];

  for (const x of fila) {
    const disponivel = Math.max(sd[x.id] || 0, 0);
    const take = Math.min(falta, disponivel);
    if (take > 0) {
      registrarMov('rolo', x.id, -take, motivo, refTipo, refId, obs);
      falta -= take;
    }
  }

  if (falta > 0) {
    registrarMov('rolo', rolo.id, -falta, motivo, refTipo, refId, obs || 'estoque insuficiente');
  }

  return round2(falta);
}

export function registrarProducao(produto: Produto, unidades: number, refTipo = 'produto', refId = 0, obs = 'produção registrada'): string[] {
  const data = db.get();
  const n = Number(unidades);
  const lote = produto.lote_qtd || 1;
  const sd = saldos('rolo');
  const resumo: string[] = [];

  for (const pm of produto.materiais) {
    const g = (pm.gramas * n) / lote;
    const rolos = data.rolos.filter((r) => r.material_id === pm.material_id && r.ativo);
    const mat = data.materiais.find((m) => m.id === pm.material_id);
    const nomeMat = mat ? `${mat.tipo} ${mat.cor} ${mat.marca}`.trim() : 'Material';

    if (rolos.length === 0) {
      resumo.push(`${nomeMat}: nenhum rolo cadastrado, nada abatido`);
      continue;
    }
    const roloComSaldo = rolos.find((r) => (sd[r.id] || 0) > 0) || rolos[0];
    const falta = baixarRolo(roloComSaldo.id, g, refTipo, refId, 'producao', obs);
    resumo.push(`${Math.round(g)} g de ${nomeMat}${falta > 0 ? ` (faltaram ${Math.round(falta)} g no estoque)` : ''}`);
  }

  for (const pi of produto.insumos) {
    const q = (pi.qtd * n) / lote;
    const insumo = data.insumos.find((i) => i.id === pi.insumo_id);
    registrarMov('insumo', pi.insumo_id, -q, 'producao', refTipo, refId, obs);
    if (insumo) {
      resumo.push(`${round2(q)} ${insumo.unidade} de ${insumo.nome}`);
    }
  }

  registrarMov('produto', produto.id, n, 'producao', refTipo, refId, obs);
  return resumo;
}

export function estoqueBaixo(): StockAlert[] {
  const data = db.get();
  const out: StockAlert[] = [];
  const sdRolos = saldos('rolo');
  const sdInsumos = saldos('insumo');
  const sdProdutos = saldos('produto');

  for (const m of data.materiais.filter((m) => m.ativo)) {
    const rolos = data.rolos.filter((r) => r.material_id === m.id && r.ativo);
    const saldoTotal = rolos.reduce((acc, r) => acc + (sdRolos[r.id] || 0), 0);
    const temOuTeve = rolos.length > 0 || m.minimo_g > 0;
    const nomeMat = `${m.tipo} ${m.cor} ${m.marca}`.trim();
    if (temOuTeve && saldoTotal <= 0) {
      out.push({ tipo: 'Filamento', nome: nomeMat, key: `material-${m.id}`, saldo: round2(saldoTotal), minimo: m.minimo_g, status: 'acabou' });
    } else if (temOuTeve && m.minimo_g > 0 && saldoTotal <= m.minimo_g) {
      out.push({ tipo: 'Filamento', nome: nomeMat, key: `material-${m.id}`, saldo: round2(saldoTotal), minimo: m.minimo_g, status: 'acabando' });
    }
  }

  for (const i of data.insumos.filter((i) => i.ativo)) {
    const sl = sdInsumos[i.id] || 0;
    const teveEntrada = data.movimentos.some((m) => m.item_tipo === 'insumo' && m.item_id === i.id && m.delta > 0);
    const acompanhado = i.minimo > 0 || teveEntrada;
    if (acompanhado && sl <= 0) {
      out.push({ tipo: 'Insumo', nome: i.nome, key: `insumo-${i.id}`, saldo: round2(sl), minimo: i.minimo, status: 'acabou' });
    } else if (acompanhado && i.minimo > 0 && sl <= i.minimo) {
      out.push({ tipo: 'Insumo', nome: i.nome, key: `insumo-${i.id}`, saldo: round2(sl), minimo: i.minimo, status: 'acabando' });
    }
  }

  for (const p of data.produtos.filter((p) => p.ativo)) {
    const sl = sdProdutos[p.id] || 0;
    const teveEntrada = data.movimentos.some((m) => m.item_tipo === 'produto' && m.item_id === p.id && m.delta > 0);
    const acompanhado = p.minimo > 0 || teveEntrada;
    if (acompanhado && sl <= 0) {
      out.push({ tipo: 'Produto pronto', nome: p.nome, key: `produto-${p.id}`, saldo: round2(sl), minimo: p.minimo, status: 'acabou' });
    } else if (acompanhado && p.minimo > 0 && sl <= p.minimo) {
      out.push({ tipo: 'Produto pronto', nome: p.nome, key: `produto-${p.id}`, saldo: round2(sl), minimo: p.minimo, status: 'acabando' });
    }
  }

  return out.sort((a, b) => (a.status === 'acabou' ? -1 : 1));
}

export function custoProduto(
  p: Produto,
  cfg?: Config,
  canal?: Canal | null,
  sd?: Record<number, number>
) {
  const data = db.get();
  const config = cfg || data.config;
  const sdRolos = sd || saldos('rolo');

  let filTotal = 0;
  for (const pm of p.materiais) {
    const cg = custoGMaterial(pm.material_id, sdRolos);
    filTotal += pm.gramas * cg;
  }

  let insTotal = 0;
  for (const pi of p.insumos) {
    const insumo = data.insumos.find((i) => i.id === pi.insumo_id);
    if (insumo) {
      insTotal += pi.qtd * insumo.custo_unit;
    }
  }

  const imp = p.impressora_id ? data.impressoras.find((i) => i.id === p.impressora_id) || null : null;
  const horas = Number(p.tempo_min) / 60;

  return calcular(
    config,
    imp,
    filTotal,
    horas,
    p.embalagem,
    p.acessorios + insTotal,
    p.min_trabalho,
    p.margem_pct,
    canal ? canal.taxa_pct : 0,
    canal ? canal.taxa_fixa : 0,
    p.lote_qtd || 1
  );
}

export function atualizarPrecos() {
  db.update((state) => {
    const cfg = state.config;
    const sd = saldos('rolo');
    for (const p of state.produtos) {
      if (!p.preco_manual && p.ativo) {
        const novo = custoProduto(p, cfg, null, sd).preco;
        if (novo && novo > 0 && novo !== p.preco) {
          p.preco = novo;
        }
      }
    }
  });
}

export function criarPedidoDeOrcamento(orc: Orcamento, prazo: string | null, doEstoque = false): Pedido {
  let novoPedidoId = 1;
  db.update((state) => {
    const cfg = state.config;
    novoPedidoId = state.pedidos.length > 0 ? Math.max(...state.pedidos.map((p) => p.id)) + 1 : 1;
    const now = new Date().toISOString();

    const itens: PedidoItem[] = orc.itens.map((it, idx) => {
      let custo = it.custo_unit;
      if (it.produto_id) {
        const prod = state.produtos.find((p) => p.id === it.produto_id);
        if (prod) {
          custo = custoProduto(prod, cfg).custo;
        }
      }
      return {
        id: idx + 1,
        pedido_id: novoPedidoId,
        produto_id: it.produto_id,
        descricao: it.descricao,
        personalizacao: it.personalizacao,
        qtd: it.qtd,
        preco_unit: it.preco_unit,
        custo_unit: custo,
        qtd_pronta: 0,
      };
    });

    const ped: Pedido = {
      id: novoPedidoId,
      orcamento_id: orc.id,
      cliente_id: orc.cliente_id,
      canal_id: orc.canal_id,
      tipo: 'cliente',
      status: 'aguardando',
      prazo,
      observacoes: orc.observacoes,
      desconto: orc.desconto,
      frete: orc.frete,
      custo_extra: 0,
      do_estoque: doEstoque,
      criado_em: now,
      itens,
      historico: [{ id: 1, pedido_id: novoPedidoId, de: '', para: 'aguardando', em: now }],
    };

    state.pedidos.push(ped);
    const o = state.orcamentos.find((x) => x.id === orc.id);
    if (o) o.status = 'aprovado';
  });

  return db.get().pedidos.find((p) => p.id === novoPedidoId)!;
}

export function planoConsumo(ped: Pedido): Array<{ material: Material; gramas: number; rolos: Array<{ rolo: Rolo; saldo: number }> }> {
  const data = db.get();
  const sd = saldos('rolo');
  const need: Record<number, number> = {};

  const sim = ped.do_estoque && ped.tipo !== 'estoque';
  for (const it of ped.itens) {
    const qtdPronta = ped.status !== 'aguardando' ? it.qtd_pronta : (sim && it.produto_id ? it.qtd : 0);
    const qtdImprimir = it.qtd - qtdPronta;
    if (it.produto_id && qtdImprimir > 0) {
      const prod = data.produtos.find((p) => p.id === it.produto_id);
      if (prod) {
        const lote = prod.lote_qtd || 1;
        for (const pm of prod.materiais) {
          need[pm.material_id] = (need[pm.material_id] || 0) + (pm.gramas * qtdImprimir) / lote;
        }
      }
    }
  }

  const out = [];
  for (const [mIdStr, g] of Object.entries(need)) {
    const mid = Number(mIdStr);
    const mat = data.materiais.find((m) => m.id === mid);
    if (mat) {
      const rolos = data.rolos
        .filter((r) => r.material_id === mid && r.ativo && (sd[r.id] || 0) > 0)
        .map((r) => ({ rolo: r, saldo: sd[r.id] || 0 }));
      out.push({ material: mat, gramas: round2(g), rolos });
    }
  }
  return out;
}

export function planoInsumos(ped: Pedido): Array<{ insumo: Insumo; qtd: number; saldo: number }> {
  const data = db.get();
  const sd = saldos('insumo');
  const need: Record<number, number> = {};

  const sim = ped.do_estoque && ped.tipo !== 'estoque';
  for (const it of ped.itens) {
    const qtdPronta = ped.status !== 'aguardando' ? it.qtd_pronta : (sim && it.produto_id ? it.qtd : 0);
    const qtdImprimir = it.qtd - qtdPronta;
    if (it.produto_id && qtdImprimir > 0) {
      const prod = data.produtos.find((p) => p.id === it.produto_id);
      if (prod) {
        const lote = prod.lote_qtd || 1;
        for (const pi of prod.insumos) {
          need[pi.insumo_id] = (need[pi.insumo_id] || 0) + (pi.qtd * qtdImprimir) / lote;
        }
      }
    }
  }

  const out = [];
  for (const [insIdStr, q] of Object.entries(need)) {
    const iid = Number(insIdStr);
    const ins = data.insumos.find((i) => i.id === iid);
    if (ins) {
      out.push({ insumo: ins, qtd: round2(q), saldo: sd[iid] || 0 });
    }
  }
  return out;
}

export function moverPedido(
  pedId: number,
  para: Pedido['status'],
  consumos: Array<{ roloId: number; gramas: number }> = [],
  insumos: Array<{ insumoId: number; qtd: number }> = []
): string | null {
  let erroRetorno: string | null = null;

  db.update((state) => {
    const ped = state.pedidos.find((p) => p.id === pedId);
    if (!ped) {
      erroRetorno = 'Pedido não encontrado.';
      return;
    }

    const de = ped.status;
    const ordem = ped.tipo === 'estoque' ? ORDEM_STATUS.slice(0, 4) : ORDEM_STATUS;

    if (para === 'cancelado') {
      if (de === 'entregue' || de === 'cancelado' || (ped.tipo === 'estoque' && de === 'pronto')) {
        erroRetorno = 'Este pedido não pode mais ser cancelado.';
        return;
      }
    } else if (de === 'cancelado') {
      if (para !== 'aguardando') {
        erroRetorno = 'Pedido cancelado só pode ser reaberto.';
        return;
      }
    } else if (de === 'entregue' || !ordem.includes(de) || !ordem.includes(para)) {
      erroRetorno = 'Movimento inválido.';
      return;
    }

    const now = new Date().toISOString();

    if (de === 'aguardando' && para === 'imprimindo') {
      const sim = ped.do_estoque && ped.tipo !== 'estoque';
      for (const it of ped.itens) {
        it.qtd_pronta = sim && it.produto_id ? it.qtd : 0;
      }
      for (const c of consumos) {
        if (c.gramas > 0) {
          baixarRolo(c.roloId, c.gramas, 'pedido', ped.id, 'producao', `Pedido #${ped.id}`);
        }
      }
      for (const i of insumos) {
        if (i.qtd > 0) {
          registrarMov('insumo', i.insumoId, -i.qtd, 'producao', 'pedido', ped.id, `Pedido #${ped.id}`);
        }
      }
    }

    if (de === 'acabamento' && para === 'pronto') {
      for (const it of ped.itens) {
        if (!it.produto_id) continue;
        const prod = state.produtos.find((p) => p.id === it.produto_id);
        if (!prod) continue;
        if (ped.tipo === 'estoque') {
          registrarMov('produto', prod.id, it.qtd, 'producao', 'pedido', ped.id, 'Reposição de estoque');
        }
        if (prod.impressora_id && it.qtd - it.qtd_pronta > 0) {
          const imp = state.impressoras.find((i) => i.id === prod.impressora_id);
          if (imp) {
            const horasGastas = (prod.tempo_min * (it.qtd - it.qtd_pronta)) / (60 * (prod.lote_qtd || 1));
            imp.horas_acumuladas = round2(imp.horas_acumuladas + horasGastas);
          }
        }
      }
    }

    if (para === 'entregue') {
      criarVendaDePedido(ped.id);
    }

    ped.historico.push({
      id: ped.historico.length + 1,
      pedido_id: ped.id,
      de,
      para,
      em: now,
    });
    ped.status = para;
  });

  return erroRetorno;
}

export function registrarFalha(pedId: number, roloId: number, gramas: number, obs = '') {
  db.update((state) => {
    const ped = state.pedidos.find((p) => p.id === pedId);
    const rolo = state.rolos.find((r) => r.id === roloId);
    if (!ped || !rolo) return;

    registrarMov('rolo', roloId, -gramas, 'falha', 'pedido', ped.id, obs);
    const custoG = rolo.peso_inicial > 0 ? rolo.preco / rolo.peso_inicial : 0;
    ped.custo_extra = round2(ped.custo_extra + gramas * custoG);
  });
}

export function criarVendaDePedido(pedId: number): Venda | null {
  const data = db.get();
  const jaExiste = data.vendas.some((v) => v.pedido_id === pedId && v.status === 'ativa');
  if (jaExiste) return null;

  const ped = data.pedidos.find((p) => p.id === pedId);
  if (!ped) return null;

  const canal = ped.canal_id ? data.canais.find((c) => c.id === ped.canal_id) : null;
  const total = ped.itens.reduce((acc, it) => acc + it.qtd * it.preco_unit, 0) - ped.desconto + ped.frete;
  const custo = ped.itens.reduce((acc, it) => acc + it.qtd * it.custo_unit, 0) + ped.custo_extra;
  const taxa = canal ? (total * canal.taxa_pct) / 100 + canal.taxa_fixa : 0;
  const lucro = total - taxa - custo;
  const hoje = new Date().toISOString().split('T')[0];

  let novaVendaId = 1;
  db.update((state) => {
    novaVendaId = state.vendas.length > 0 ? Math.max(...state.vendas.map((v) => v.id)) + 1 : 1;
    const vItens: VendaItem[] = ped.itens.map((it, idx) => ({
      id: idx + 1,
      venda_id: novaVendaId,
      produto_id: it.produto_id,
      descricao: it.descricao,
      qtd: it.qtd,
      preco_unit: it.preco_unit,
      custo_unit: it.custo_unit,
    }));

    const venda: Venda = {
      id: novaVendaId,
      pedido_id: ped.id,
      cliente_id: ped.cliente_id,
      canal_id: ped.canal_id,
      forma_pagamento: 'PIX',
      data: hoje,
      total: round2(total),
      custo: round2(custo),
      taxa: round2(taxa),
      lucro: round2(lucro),
      status: 'ativa',
      itens: vItens,
    };

    state.vendas.push(venda);

    // Baixa do produto pronto para o que saiu do estoque pronto
    for (const it of ped.itens) {
      if (it.produto_id && it.qtd_pronta > 0) {
        registrarMov('produto', it.produto_id, -it.qtd_pronta, 'venda', 'venda', novaVendaId, `Entrega pedido #${ped.id}`);
      }
    }

    // Lançamento financeiro de receita
    const novoLancamentoId = state.lancamentos.length > 0 ? Math.max(...state.lancamentos.map((l) => l.id)) + 1 : 1;
    state.lancamentos.push({
      id: novoLancamentoId,
      tipo: 'receita',
      categoria: 'Vendas',
      natureza: 'variavel',
      descricao: `Venda #${novaVendaId} (Pedido #${ped.id})`,
      valor: round2(total - taxa),
      vencimento: hoje,
      pago_em: hoje,
      venda_id: novaVendaId,
      recorrencia: '',
      gerou_proximo: false,
      cancelado: false,
    });
  });

  return db.get().vendas.find((v) => v.id === novaVendaId) || null;
}

export function vendaAvulsa(
  clienteId: number | null,
  canalId: number | null,
  forma: string,
  dataStr: string,
  linhas: Array<{ produtoId: number | null; descricao: string; qtd: number; precoUnit: number }>
): Venda {
  let novaVendaId = 1;

  db.update((state) => {
    novaVendaId = state.vendas.length > 0 ? Math.max(...state.vendas.map((v) => v.id)) + 1 : 1;
    const cfg = state.config;
    const canal = canalId ? state.canais.find((c) => c.id === canalId) : null;

    let total = 0;
    let custo = 0;
    const vItens: VendaItem[] = [];

    for (let idx = 0; idx < linhas.length; idx++) {
      const l = linhas[idx];
      let c = 0;
      let desc = l.descricao;
      if (l.produtoId) {
        const p = state.produtos.find((x) => x.id === l.produtoId);
        if (p) {
          c = custoProduto(p, cfg).custo;
          desc = desc || p.nome;
          registrarMov('produto', l.produtoId, -l.qtd, 'venda', 'venda', novaVendaId, `Venda #${novaVendaId}`);
        }
      }
      vItens.push({
        id: idx + 1,
        venda_id: novaVendaId,
        produto_id: l.produtoId,
        descricao: desc,
        qtd: l.qtd,
        preco_unit: l.precoUnit,
        custo_unit: c,
      });
      total += l.qtd * l.precoUnit;
      custo += l.qtd * c;
    }

    const taxa = canal ? (total * canal.taxa_pct) / 100 + canal.taxa_fixa : 0;
    const lucro = total - taxa - custo;

    const venda: Venda = {
      id: novaVendaId,
      pedido_id: null,
      cliente_id: clienteId,
      canal_id: canalId,
      forma_pagamento: forma || 'PIX',
      data: dataStr,
      total: round2(total),
      custo: round2(custo),
      taxa: round2(taxa),
      lucro: round2(lucro),
      status: 'ativa',
      itens: vItens,
    };

    state.vendas.push(venda);

    // Lançamento de receita
    const novoLancamentoId = state.lancamentos.length > 0 ? Math.max(...state.lancamentos.map((l) => l.id)) + 1 : 1;
    state.lancamentos.push({
      id: novoLancamentoId,
      tipo: 'receita',
      categoria: 'Vendas',
      natureza: 'variavel',
      descricao: `Venda #${novaVendaId}`,
      valor: round2(total - taxa),
      vencimento: dataStr,
      pago_em: dataStr,
      venda_id: novaVendaId,
      recorrencia: '',
      gerou_proximo: false,
      cancelado: false,
    });
  });

  return db.get().vendas.find((v) => v.id === novaVendaId)!;
}

export function estornarVenda(vendaId: number) {
  db.update((state) => {
    const v = state.vendas.find((x) => x.id === vendaId);
    if (!v || v.status === 'estornada') return;

    v.status = 'estornada';

    // Cancela lançamentos financeiros vinculados
    for (const l of state.lancamentos) {
      if (l.venda_id === v.id) {
        l.cancelado = true;
      }
    }

    // Estorna devolução de produtos que foram baixados na venda
    for (const it of v.itens) {
      if (it.produto_id) {
        registrarMov('produto', it.produto_id, it.qtd, 'ajuste', 'venda', v.id, `Estorno de venda #${v.id}`);
      }
    }
  });
}

export function pagarLancamento(id: number, quando: string) {
  db.update((state) => {
    const l = state.lancamentos.find((x) => x.id === id);
    if (!l) return;
    l.pago_em = quando;

    if (l.recorrencia === 'mensal' && !l.gerou_proximo) {
      const nextId = state.lancamentos.length > 0 ? Math.max(...state.lancamentos.map((x) => x.id)) + 1 : 1;
      state.lancamentos.push({
        id: nextId,
        tipo: l.tipo,
        categoria: l.categoria,
        natureza: l.natureza,
        descricao: l.descricao,
        valor: l.valor,
        vencimento: addMonths(l.vencimento, 1),
        pago_em: null,
        venda_id: null,
        recorrencia: 'mensal',
        gerou_proximo: false,
        cancelado: false,
      });
      l.gerou_proximo = true;
    }
  });
}

export function concluirTarefa(id: number) {
  db.update((state) => {
    const t = state.tarefas.find((x) => x.id === id);
    if (!t) return;
    t.feita = !t.feita;

    if (t.recorrencia) {
      const proxData = new Date(t.data);
      proxData.setDate(proxData.getDate() + (t.recorrencia === 'diaria' ? 1 : 7));
      const proxDataStr = proxData.toISOString().split('T')[0];

      const existente = state.tarefas.find(
        (x) => x.titulo === t.titulo && x.recorrencia === t.recorrencia && x.data === proxDataStr && x.hora === t.hora && x.id !== t.id
      );

      if (t.feita && !existente) {
        const nextId = state.tarefas.length > 0 ? Math.max(...state.tarefas.map((x) => x.id)) + 1 : 1;
        state.tarefas.push({
          id: nextId,
          titulo: t.titulo,
          hora: t.hora,
          recorrencia: t.recorrencia,
          data: proxDataStr,
          feita: false,
        });
      } else if (!t.feita && existente && !existente.feita) {
        state.tarefas = state.tarefas.filter((x) => x.id !== existente.id);
      }
    }
  });
}

export function totaisMes(ini: string, fim: string) {
  const data = db.get();
  const vs = data.vendas.filter((v) => v.status === 'ativa' && v.data >= ini && v.data < fim);
  const despesasPagas = data.lancamentos
    .filter((l) => l.tipo === 'despesa' && !l.cancelado && l.pago_em && l.pago_em >= ini && l.pago_em < fim)
    .reduce((acc, l) => acc + l.valor, 0);

  const faturamento = vs.reduce((acc, v) => acc + v.total, 0);
  const cmv = vs.reduce((acc, v) => acc + v.custo, 0);
  const taxas = vs.reduce((acc, v) => acc + v.taxa, 0);
  const custosTotais = cmv + despesasPagas;
  const lucro = faturamento - taxas - custosTotais;

  return {
    vendas: vs,
    n: vs.length,
    faturamento: round2(faturamento),
    cmv: round2(cmv),
    taxas: round2(taxas),
    despesas: round2(despesasPagas),
    custos: round2(custosTotais),
    lucro: round2(lucro),
  };
}

export function getDashboardData(hoje: string) {
  const data = db.get();
  const iniMes = hoje.slice(0, 7) + '-01';
  const fimMes = addMonths(iniMes, 1);
  const totais = totaisMes(iniMes, fimMes);

  const topMap: Record<string, number> = {};
  for (const v of totais.vendas) {
    for (const it of v.itens) {
      topMap[it.descricao] = (topMap[it.descricao] || 0) + it.qtd;
    }
  }
  const maisVendidos = Object.entries(topMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nome, qtd]) => ({ nome, qtd }));

  const ativos = data.pedidos.filter((p) => ['aguardando', 'imprimindo', 'acabamento', 'pronto', 'enviado'].includes(p.status));
  const emProducao = ativos.filter((p) => ['imprimindo', 'acabamento'].includes(p.status));
  const atrasados = ativos.filter(
    (p) => p.prazo && p.prazo < hoje && !['entregue', 'cancelado'].includes(p.status) && !(p.tipo === 'estoque' && p.status === 'pronto')
  );

  const limite7Dias = new Date(hoje);
  limite7Dias.setDate(limite7Dias.getDate() + 7);
  const limite7DiasStr = limite7Dias.toISOString().split('T')[0];

  const prazos = ativos.filter((p) => p.prazo && p.prazo <= limite7DiasStr && !(p.tipo === 'estoque' && p.status === 'pronto'));

  const orcamentosAbertos = data.orcamentos.filter((o) => o.status === 'aberto');
  const vAbertos = orcamentosAbertos.reduce(
    (acc, o) => acc + o.itens.reduce((iAcc, it) => iAcc + it.qtd * it.preco_unit, 0) - o.desconto + o.frete,
    0
  );

  const tarefasHoje = data.tarefas.filter((t) => t.data === hoje);
  const tarefasAtrasadas = data.tarefas.filter((t) => t.data < hoje && !t.feita);
  const agendaTarefas = data.tarefas.filter((t) => t.data > hoje && t.data <= limite7DiasStr);

  return {
    ...totais,
    emProducao,
    atrasados,
    baixo: estoqueBaixo(),
    maisVendidos,
    prazos: prazos.sort((a, b) => (a.prazo || '').localeCompare(b.prazo || '')),
    nAbertos: orcamentosAbertos.length,
    vAbertos: round2(vAbertos),
    tarefasHoje,
    tarefasAtrasadas,
    agendaTarefas,
  };
}
