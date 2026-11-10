import * as XLSX from 'xlsx';
import { db } from './db';
import { custoGMaterial, custoProduto, saldos } from './services';
import { Cliente, Insumo, Material, MovEstoque, Produto, Rolo } from './types';

export function gerarSku(categoria: string, produtos: Produto[]): string {
  const limpo = (categoria || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase();
  const prefixo = limpo.length >= 2 ? limpo.slice(0, 2) : limpo.length === 1 ? limpo + 'X' : 'PR';

  const regex = new RegExp(`^${prefixo}(\\d+)`, 'i');
  let maxNum = 0;
  for (const p of produtos) {
    const match = p.sku.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }
  return `${prefixo}${String(maxNum + 1).padStart(4, '0')}`;
}

export function exportarBackupExcel() {
  const data = db.get();
  const hoje = new Date().toISOString().split('T')[0];
  const sdRolos = saldos('rolo');
  const sdInsumos = saldos('insumo');
  const sdProdutos = saldos('produto');

  const wb = XLSX.utils.book_new();

  // 1. Clientes
  const clientesData = data.clientes.map((c) => ({
    ID: c.id,
    Nome: c.nome,
    Telefone: c.telefone,
    Email: c.email,
    Documento: c.documento,
    Endereco: c.endereco,
    Observacoes: c.observacoes,
    Ativo: c.ativo ? 'Sim' : 'Não',
  }));
  const wsClientes = XLSX.utils.json_to_sheet(clientesData);
  XLSX.utils.book_append_sheet(wb, wsClientes, 'Clientes');

  // 2. Produtos
  const produtosData = data.produtos.map((p) => {
    const c = custoProduto(p, data.config).custo;
    const margem = p.preco > 0 ? ((p.preco - c) / p.preco) * 100 : 0;
    return {
      SKU: p.sku,
      Nome: p.nome,
      Categoria: p.categoria,
      PrecoVenda: p.preco,
      CustoCalculado: c,
      MargemRealPct: Number(margem.toFixed(1)),
      MargemAlvoPct: p.margem_pct,
      TempoMinutos: p.tempo_min,
      UnidadesPorLote: p.lote_qtd,
      EstoquePronto: sdProdutos[p.id] || 0,
      Ativo: p.ativo ? 'Sim' : 'Não',
    };
  });
  const wsProdutos = XLSX.utils.json_to_sheet(produtosData);
  XLSX.utils.book_append_sheet(wb, wsProdutos, 'Produtos');

  // 3. Filamentos
  const filamentosData = data.rolos.map((r) => {
    const mat = data.materiais.find((m) => m.id === r.material_id);
    const sl = sdRolos[r.id] || 0;
    const cg = r.peso_inicial > 0 ? r.preco / r.peso_inicial : 0;
    return {
      ID_Rolo: r.id,
      Material: mat?.tipo || 'PLA',
      Cor: mat?.cor || '',
      Marca: mat?.marca || '',
      PesoInicial_g: r.peso_inicial,
      SaldoAtual_g: sl,
      PrecoPago_R$: r.preco,
      CustoPorGrama_R$: Number(cg.toFixed(4)),
      CompradoEm: r.comprado_em,
      Fornecedor: r.fornecedor,
      Ativo: r.ativo ? 'Sim' : 'Não',
    };
  });
  const wsFilamentos = XLSX.utils.json_to_sheet(filamentosData);
  XLSX.utils.book_append_sheet(wb, wsFilamentos, 'Filamentos');

  // 4. Insumos
  const insumosData = data.insumos.map((i) => ({
    ID: i.id,
    Nome: i.nome,
    Unidade: i.unidade,
    CustoUnitario_R$: i.custo_unit,
    SaldoAtual: sdInsumos[i.id] || 0,
    EstoqueMinimo: i.minimo,
    Fornecedor: i.fornecedor,
    Ativo: i.ativo ? 'Sim' : 'Não',
  }));
  const wsInsumos = XLSX.utils.json_to_sheet(insumosData);
  XLSX.utils.book_append_sheet(wb, wsInsumos, 'Insumos');

  // 5. Vendas
  const vendasData = data.vendas.map((v) => {
    const cli = v.cliente_id ? data.clientes.find((c) => c.id === v.cliente_id)?.nome : 'Balcão';
    const canal = v.canal_id ? data.canais.find((c) => c.id === v.canal_id)?.nome : 'Balcão';
    return {
      ID_Venda: v.id,
      Data: v.data,
      Cliente: cli || 'Balcão',
      Canal: canal || 'Balcão',
      FormaPagamento: v.forma_pagamento,
      Total_R$: v.total,
      Custo_R$: v.custo,
      Taxa_R$: v.taxa,
      Lucro_R$: v.lucro,
      MaoDeObra15Pct_R$: Number((Math.max(0, v.lucro) * 0.15).toFixed(2)),
      Status: v.status,
      Itens: v.itens.map((it) => `${it.qtd}x ${it.descricao}`).join(', '),
    };
  });
  const wsVendas = XLSX.utils.json_to_sheet(vendasData);
  XLSX.utils.book_append_sheet(wb, wsVendas, 'Vendas');

  // 6. Pedidos
  const pedidosData = data.pedidos.map((p) => {
    const cli = p.cliente_id ? data.clientes.find((c) => c.id === p.cliente_id)?.nome : (p.tipo === 'estoque' ? 'Reposição Estoque' : 'Balcão');
    const canal = p.canal_id ? data.canais.find((c) => c.id === p.canal_id)?.nome : 'Balcão';
    const total = p.itens.reduce((acc, it) => acc + it.qtd * it.preco_unit, 0) - p.desconto + p.frete;
    return {
      ID_Pedido: p.id,
      CriadoEm: p.criado_em.split('T')[0],
      Prazo: p.prazo || '',
      Tipo: p.tipo,
      Cliente: cli,
      Canal: canal,
      Status: p.status,
      Total_R$: total,
      CustoExtraFalhas_R$: p.custo_extra,
      Observacoes: p.observacoes,
      Itens: p.itens.map((it) => `${it.qtd}x ${it.descricao}`).join(', '),
    };
  });
  const wsPedidos = XLSX.utils.json_to_sheet(pedidosData);
  XLSX.utils.book_append_sheet(wb, wsPedidos, 'Pedidos');

  // 7. Orçamentos
  const orcamentosData = data.orcamentos.map((o) => {
    const cli = data.clientes.find((c) => c.id === o.cliente_id)?.nome || 'Balcão';
    const canal = o.canal_id ? data.canais.find((c) => c.id === o.canal_id)?.nome : 'Balcão';
    const subtotal = o.itens.reduce((acc, it) => acc + it.qtd * it.preco_unit, 0);
    const total = subtotal - o.desconto + o.frete;
    return {
      ID_Orcamento: o.id,
      Data: o.data,
      ValidadeDias: o.validade_dias,
      Cliente: cli,
      Canal: canal,
      Subtotal_R$: subtotal,
      Desconto_R$: o.desconto,
      Frete_R$: o.frete,
      Total_R$: total,
      Status: o.status,
      Prazo: o.prazo,
      Pagamento: o.pagamento,
      Itens: o.itens.map((it) => `${it.qtd}x ${it.descricao}`).join(', '),
    };
  });
  const wsOrcamentos = XLSX.utils.json_to_sheet(orcamentosData);
  XLSX.utils.book_append_sheet(wb, wsOrcamentos, 'Orcamentos');

  // 8. Financeiro
  const financeiroData = data.lancamentos.map((l) => ({
    ID: l.id,
    Tipo: l.tipo,
    Categoria: l.categoria,
    Natureza: l.natureza,
    Descricao: l.descricao,
    Valor_R$: l.valor,
    Vencimento: l.vencimento,
    PagoEm: l.pago_em || '',
    Recorrencia: l.recorrencia || 'Não',
    Cancelado: l.cancelado ? 'Sim' : 'Não',
  }));
  const wsFinanceiro = XLSX.utils.json_to_sheet(financeiroData);
  XLSX.utils.book_append_sheet(wb, wsFinanceiro, 'Financeiro');

  // 9. Impressoras e Canais
  const impsData = data.impressoras.map((i) => ({
    ID: i.id,
    Nome: i.nome,
    Watts: i.watts,
    Valor_R$: i.valor,
    VidaUtil_h: i.vida_h,
    HorasAcumuladas: i.horas_acumuladas,
    Manutencao_h_R$: i.manutencao_h,
    Ativo: i.ativo ? 'Sim' : 'Não',
  }));
  const wsImps = XLSX.utils.json_to_sheet(impsData);
  XLSX.utils.book_append_sheet(wb, wsImps, 'Impressoras');

  // Gera download do arquivo .xlsx
  XLSX.writeFile(wb, `backup-conex-3d-${hoje}.xlsx`);
}

export function baixarModeloCsv() {
  const csvHeaders = 'tipo;nome;categoria;material;cor;marca;preco;qtd;unidade;custo_unit;telefone;fornecedor\n';
  const csvLinhas = [
    'filamento;;;PLA;Preto;Voolt3D;95.00;1;;;Loja 3D',
    'filamento;;;PETG;Cinza;3D Fila;110.00;2;;;Loja 3D',
    'insumo;Argola de Chaveiro;;;;;100;un;0.35;;Armarinhos',
    'insumo;Caixa de Envio P;;;;;20;un;2.20;;Embalagens Brasil',
    'produto;Chaveiro Spotify;Chaveiros;;;;15.00;5;;;',
    'produto;Suporte de Celular;Utilidades;;;;32.00;2;;;',
    'cliente;Joao Santos;;;;;;;;(62) 99999-8888;',
  ].join('\n');

  const content = '\uFEFF' + csvHeaders + csvLinhas;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modelo-importacao-conex3d.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  sucesso: boolean;
  filamentos: number;
  insumos: number;
  produtos: number;
  clientes: number;
  erros: string[];
}

export async function processarArquivoImportacao(file: File): Promise<ImportResult> {
  const result: ImportResult = {
    sucesso: true,
    filamentos: 0,
    insumos: 0,
    produtos: 0,
    clientes: 0,
    erros: [],
  };

  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const hoje = new Date().toISOString().split('T')[0];

    db.update((state) => {
      // Itera por todas as abas (se for .xlsx multi-aba) ou pela primeira aba (se for CSV)
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        for (let idx = 0; idx < rows.length; idx++) {
          const row = rows[idx];
          // Normaliza chaves para minúsculo sem acentos
          const r: Record<string, any> = {};
          for (const [k, v] of Object.entries(row)) {
            const keyNorm = k
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase()
              .trim();
            r[keyNorm] = typeof v === 'string' ? v.trim() : v;
          }

          // Dica de tipo por nome da aba ou coluna 'tipo'
          const sheetLower = sheetName.toLowerCase();
          const tipoCol = String(r['tipo'] || '').toLowerCase();
          const tipo =
            tipoCol.startsWith('fil') || sheetLower.includes('fil')
              ? 'filamento'
              : tipoCol.startsWith('ins') || sheetLower.includes('ins')
              ? 'insumo'
              : tipoCol.startsWith('prod') || sheetLower.includes('prod')
              ? 'produto'
              : tipoCol.startsWith('cli') || sheetLower.includes('cli')
              ? 'cliente'
              : '';

          try {
            if (tipo === 'filamento') {
              const materialTipo = (r['material'] || r['tipo_material'] || 'PLA').toUpperCase();
              const cor = r['cor'] || '';
              const marca = r['marca'] || '';
              const pesoG = Number(r['peso_g'] || r['peso'] || 1000);
              const preco = Number(r['preco'] || r['preco_pago'] || 95);
              const qtd = Math.max(1, Number(r['qtd'] || 1));
              const fornecedor = r['fornecedor'] || '';

              // Procura se material já existe
              let mat = state.materiais.find(
                (m) => m.tipo.toUpperCase() === materialTipo && m.cor.toLowerCase() === cor.toLowerCase() && m.marca.toLowerCase() === marca.toLowerCase()
              );
              if (!mat) {
                const nextMatId = state.materiais.length > 0 ? Math.max(...state.materiais.map((m) => m.id)) + 1 : 1;
                mat = {
                  id: nextMatId,
                  tipo: materialTipo,
                  cor,
                  marca,
                  minimo_g: 500,
                  ativo: true,
                };
                state.materiais.push(mat);
              }

              for (let k = 0; k < qtd; k++) {
                const nextRoloId = state.rolos.length > 0 ? Math.max(...state.rolos.map((x) => x.id)) + 1 : 1;
                state.rolos.push({
                  id: nextRoloId,
                  material_id: mat.id,
                  peso_inicial: pesoG,
                  preco,
                  fornecedor,
                  comprado_em: hoje,
                  ativo: true,
                });

                const nextMovId = state.movimentos.length > 0 ? Math.max(...state.movimentos.map((x) => x.id)) + 1 : 1;
                state.movimentos.unshift({
                  id: nextMovId,
                  item_tipo: 'rolo',
                  item_id: nextRoloId,
                  delta: pesoG,
                  motivo: 'compra',
                  ref_tipo: 'rolo',
                  ref_id: nextRoloId,
                  obs: 'Importação CSV/Excel',
                  em: new Date().toISOString(),
                  valor: preco,
                  data: hoje,
                  fornecedor,
                });
              }
              result.filamentos += qtd;
            } else if (tipo === 'insumo') {
              const nome = r['nome'] || r['insumo'];
              if (!nome) continue;
              const unidade = r['unidade'] || 'un';
              const custoUnit = Number(r['custo_unit'] || r['custo_unitario'] || 0.5);
              const qtd = Number(r['qtd'] || r['quantidade'] || 0);
              const fornecedor = r['fornecedor'] || '';

              let ins = state.insumos.find((i) => i.nome.toLowerCase() === nome.toLowerCase());
              if (!ins) {
                const nextId = state.insumos.length > 0 ? Math.max(...state.insumos.map((x) => x.id)) + 1 : 1;
                ins = {
                  id: nextId,
                  nome,
                  unidade,
                  custo_unit: custoUnit,
                  minimo: 10,
                  fornecedor,
                  ativo: true,
                };
                state.insumos.push(ins);
              }

              if (qtd > 0) {
                const nextMovId = state.movimentos.length > 0 ? Math.max(...state.movimentos.map((x) => x.id)) + 1 : 1;
                state.movimentos.unshift({
                  id: nextMovId,
                  item_tipo: 'insumo',
                  item_id: ins.id,
                  delta: qtd,
                  motivo: 'compra',
                  ref_tipo: 'insumo',
                  ref_id: ins.id,
                  obs: 'Importação CSV/Excel',
                  em: new Date().toISOString(),
                  valor: qtd * custoUnit,
                  data: hoje,
                  fornecedor,
                });
              }
              result.insumos += 1;
            } else if (tipo === 'produto') {
              const nome = r['nome'] || r['produto'];
              if (!nome) continue;
              const categoria = r['categoria'] || '';
              const preco = Number(r['preco'] || r['precovenda'] || 0);
              const tempoMin = Number(r['tempo_min'] || r['tempominutos'] || 30);
              const qtdEstoque = Number(r['qtd'] || r['qtd_estoque'] || r['estoquepronto'] || 0);

              let sku = r['sku'] || '';
              if (!sku) {
                sku = gerarSku(categoria, state.produtos);
              }

              let prod = state.produtos.find((p) => p.sku === sku || p.nome.toLowerCase() === nome.toLowerCase());
              if (!prod) {
                const nextId = state.produtos.length > 0 ? Math.max(...state.produtos.map((x) => x.id)) + 1 : 1;
                prod = {
                  id: nextId,
                  nome,
                  sku,
                  categoria,
                  foto: '',
                  modelo: '',
                  projeto_id: null,
                  tempo_min: tempoMin,
                  impressora_id: state.impressoras[0]?.id || null,
                  preco,
                  preco_manual: preco > 0,
                  margem_pct: 40,
                  lote_qtd: 1,
                  fornecedor: '',
                  minimo: 0,
                  embalagem: 0,
                  acessorios: 0,
                  min_trabalho: 5,
                  ativo: true,
                  materiais: [],
                  insumos: [],
                };
                state.produtos.push(prod);
              }

              if (qtdEstoque > 0) {
                const nextMovId = state.movimentos.length > 0 ? Math.max(...state.movimentos.map((x) => x.id)) + 1 : 1;
                state.movimentos.unshift({
                  id: nextMovId,
                  item_tipo: 'produto',
                  item_id: prod.id,
                  delta: qtdEstoque,
                  motivo: 'ajuste',
                  ref_tipo: 'produto',
                  ref_id: prod.id,
                  obs: 'Importação inicial',
                  em: new Date().toISOString(),
                  valor: 0,
                  data: hoje,
                  fornecedor: '',
                });
              }
              result.produtos += 1;
            } else if (tipo === 'cliente') {
              const nome = r['nome'] || r['cliente'];
              if (!nome) continue;
              const telefone = r['telefone'] || '';
              const email = r['email'] || '';
              const documento = r['documento'] || '';
              const endereco = r['endereco'] || '';

              const existe = state.clientes.find((c) => c.nome.toLowerCase() === nome.toLowerCase());
              if (!existe) {
                const nextId = state.clientes.length > 0 ? Math.max(...state.clientes.map((x) => x.id)) + 1 : 1;
                state.clientes.push({
                  id: nextId,
                  nome,
                  telefone,
                  email,
                  documento,
                  endereco,
                  observacoes: 'Importado via CSV',
                  ativo: true,
                });
                result.clientes += 1;
              }
            }
          } catch (lineErr: any) {
            result.erros.push(`Linha ${idx + 2} (${sheetName}): ${lineErr.message || lineErr}`);
          }
        }
      }
    });
  } catch (err: any) {
    result.sucesso = false;
    result.erros.push(err.message || 'Erro ao processar planilha.');
  }

  return result;
}
