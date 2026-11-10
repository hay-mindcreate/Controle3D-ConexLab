import * as XLSX from 'xlsx';
import { db } from './db';
import { custoProduto, saldos } from './services';
import { BackupAgendamento, BackupSnapshot, Config } from './types';

const SNAPSHOTS_STORAGE_KEY = 'conexlab_backup_snapshots_v1';

export function obterConfigBackup(config?: Config): BackupAgendamento {
  const current = config?.backup_agendamento || db.get().config.backup_agendamento;
  return {
    ativo: current?.ativo ?? true,
    frequencia_horas: current?.frequencia_horas || 24,
    formato: current?.formato || 'json',
    ultimo_backup_em: current?.ultimo_backup_em || null,
    ultimo_backup_formato: current?.ultimo_backup_formato || null,
    ultimo_backup_tamanho: current?.ultimo_backup_tamanho || null,
    ultimo_backup_status: current?.ultimo_backup_status || 'pendente',
    baixar_automaticamente: current?.baixar_automaticamente ?? false,
  };
}

export function obterSnapshotsBackup(): BackupSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Erro ao ler snapshots de backup:', err);
  }
  return [];
}

export function salvarSnapshot(snapshot: BackupSnapshot) {
  try {
    const lista = obterSnapshotsBackup();
    // Manter no máximo os 10 backups automáticos mais recentes
    const novaLista = [snapshot, ...lista.filter((s) => s.id !== snapshot.id)].slice(0, 10);
    localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(novaLista));
  } catch (err) {
    console.warn('Erro ao salvar snapshot de backup:', err);
  }
}

export function excluirSnapshot(id: string) {
  try {
    const lista = obterSnapshotsBackup();
    const filtrada = lista.filter((s) => s.id !== id);
    localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(filtrada));
  } catch (err) {
    console.warn('Erro ao excluir snapshot:', err);
  }
}

export function gerarConteudoCsvConsolidado(): string {
  const data = db.get();
  const sdRolos = saldos('rolo');
  const sdInsumos = saldos('insumo');
  const sdProdutos = saldos('produto');

  const linhas: string[] = [];

  // 1. Clientes
  linhas.push('### CLIENTES');
  linhas.push('ID;Nome;Telefone;Email;Documento;Endereco;Observacoes;Ativo');
  for (const c of data.clientes) {
    linhas.push(
      [
        c.id,
        `"${(c.nome || '').replace(/"/g, '""')}"`,
        `"${(c.telefone || '').replace(/"/g, '""')}"`,
        `"${(c.email || '').replace(/"/g, '""')}"`,
        `"${(c.documento || '').replace(/"/g, '""')}"`,
        `"${(c.endereco || '').replace(/"/g, '""')}"`,
        `"${(c.observacoes || '').replace(/"/g, '""')}"`,
        c.ativo ? 'Sim' : 'Nao',
      ].join(';')
    );
  }

  linhas.push('');

  // 2. Produtos
  linhas.push('### PRODUTOS');
  linhas.push('ID;SKU;Nome;Categoria;Preco;Custo;Margem;EstoquePronto;Ativo');
  for (const p of data.produtos) {
    const c = custoProduto(p, data.config).custo;
    const m = p.preco > 0 ? ((p.preco - c) / p.preco) * 100 : 0;
    linhas.push(
      [
        p.id,
        p.sku,
        `"${(p.nome || '').replace(/"/g, '""')}"`,
        `"${(p.categoria || '').replace(/"/g, '""')}"`,
        p.preco.toFixed(2),
        c.toFixed(2),
        m.toFixed(1),
        sdProdutos[p.id] || 0,
        p.ativo ? 'Sim' : 'Nao',
      ].join(';')
    );
  }

  linhas.push('');

  // 3. Filamentos
  linhas.push('### FILAMENTOS_E_ROLOS');
  linhas.push('ID;Material;Cor;Marca;PesoInicial;SaldoAtual;Preco;Fornecedor;CompradoEm;Ativo');
  for (const r of data.rolos) {
    const mat = data.materiais.find((m) => m.id === r.material_id);
    linhas.push(
      [
        r.id,
        mat?.tipo || 'PLA',
        mat?.cor || 'Geral',
        mat?.marca || 'Generico',
        r.peso_inicial,
        sdRolos[r.id] || 0,
        r.preco.toFixed(2),
        `"${(r.fornecedor || '').replace(/"/g, '""')}"`,
        r.comprado_em,
        r.ativo ? 'Sim' : 'Nao',
      ].join(';')
    );
  }

  linhas.push('');

  // 4. Insumos
  linhas.push('### INSUMOS');
  linhas.push('ID;Nome;Unidade;CustoUnitario;SaldoAtual;Minimo;Fornecedor;Ativo');
  for (const i of data.insumos) {
    linhas.push(
      [
        i.id,
        `"${(i.nome || '').replace(/"/g, '""')}"`,
        i.unidade,
        i.custo_unit.toFixed(2),
        sdInsumos[i.id] || 0,
        i.minimo,
        `"${(i.fornecedor || '').replace(/"/g, '""')}"`,
        i.ativo ? 'Sim' : 'Nao',
      ].join(';')
    );
  }

  linhas.push('');

  // 5. Vendas
  linhas.push('### VENDAS');
  linhas.push('ID;Data;Cliente;Canal;FormaPagamento;ValorTotal;Custo;TaxaCanal;Lucro;Status');
  for (const v of data.vendas) {
    const cli = v.cliente_id ? data.clientes.find((c) => c.id === v.cliente_id)?.nome : 'Balcao';
    const can = v.canal_id ? data.canais.find((c) => c.id === v.canal_id)?.nome : 'Balcao';
    linhas.push(
      [
        v.id,
        v.data,
        `"${(cli || '').replace(/"/g, '""')}"`,
        `"${(can || '').replace(/"/g, '""')}"`,
        `"${(v.forma_pagamento || '').replace(/"/g, '""')}"`,
        v.total.toFixed(2),
        v.custo.toFixed(2),
        v.taxa.toFixed(2),
        v.lucro.toFixed(2),
        v.status,
      ].join(';')
    );
  }

  return '\uFEFF' + linhas.join('\n');
}

export function gerarConteudoExcelArrayBuffer(): ArrayBuffer {
  const data = db.get();
  const sdRolos = saldos('rolo');
  const sdInsumos = saldos('insumo');
  const sdProdutos = saldos('produto');

  const wb = XLSX.utils.book_new();

  // 1. Clientes
  const wsClientes = XLSX.utils.json_to_sheet(
    data.clientes.map((c) => ({
      ID: c.id,
      Nome: c.nome,
      Telefone: c.telefone,
      Email: c.email,
      Documento: c.documento,
      Endereco: c.endereco,
      Observacoes: c.observacoes,
      Ativo: c.ativo ? 'Sim' : 'Nao',
    }))
  );
  XLSX.utils.book_append_sheet(wb, wsClientes, 'Clientes');

  // 2. Produtos
  const wsProdutos = XLSX.utils.json_to_sheet(
    data.produtos.map((p) => {
      const c = custoProduto(p, data.config).custo;
      const margem = p.preco > 0 ? ((p.preco - c) / p.preco) * 100 : 0;
      return {
        SKU: p.sku,
        Nome: p.nome,
        Categoria: p.categoria,
        PrecoVenda: p.preco,
        CustoCalculado: c,
        MargemPercentual: Number(margem.toFixed(1)),
        EstoquePronto: sdProdutos[p.id] || 0,
        TempoImpressaoMin: p.tempo_min,
        Ativo: p.ativo ? 'Sim' : 'Nao',
      };
    })
  );
  XLSX.utils.book_append_sheet(wb, wsProdutos, 'Produtos');

  // 3. Filamentos
  const wsFilamentos = XLSX.utils.json_to_sheet(
    data.rolos.map((r) => {
      const m = data.materiais.find((mat) => mat.id === r.material_id);
      return {
        ID_Rolo: r.id,
        Tipo: m?.tipo || 'PLA',
        Cor: m?.cor || 'Padrao',
        Marca: m?.marca || 'Generico',
        PesoInicial_g: r.peso_inicial,
        SaldoRestante_g: sdRolos[r.id] || 0,
        PrecoPago: r.preco,
        Fornecedor: r.fornecedor,
        DataCompra: r.comprado_em,
        Ativo: r.ativo ? 'Sim' : 'Nao',
      };
    })
  );
  XLSX.utils.book_append_sheet(wb, wsFilamentos, 'Filamentos');

  // 4. Insumos
  const wsInsumos = XLSX.utils.json_to_sheet(
    data.insumos.map((i) => ({
      ID: i.id,
      Nome: i.nome,
      Unidade: i.unidade,
      CustoUnitario: i.custo_unit,
      SaldoEstoque: sdInsumos[i.id] || 0,
      EstoqueMinimo: i.minimo,
      Fornecedor: i.fornecedor,
      Ativo: i.ativo ? 'Sim' : 'Nao',
    }))
  );
  XLSX.utils.book_append_sheet(wb, wsInsumos, 'Insumos');

  // 5. Vendas
  const wsVendas = XLSX.utils.json_to_sheet(
    data.vendas.map((v) => {
      const cli = v.cliente_id ? data.clientes.find((c) => c.id === v.cliente_id)?.nome : 'Balcao';
      const canal = v.canal_id ? data.canais.find((c) => c.id === v.canal_id)?.nome : 'Balcao';
      return {
        ID: v.id,
        Data: v.data,
        Cliente: cli || 'Balcao',
        Canal: canal || 'Balcao',
        FormaPagamento: v.forma_pagamento,
        ValorTotal: v.total,
        CustoMateriais: v.custo,
        TaxaCanal: v.taxa,
        LucroLiquido: v.lucro,
        Status: v.status,
      };
    })
  );
  XLSX.utils.book_append_sheet(wb, wsVendas, 'Vendas');

  // 6. Pedidos
  const wsPedidos = XLSX.utils.json_to_sheet(
    data.pedidos.map((p) => {
      const cli = p.cliente_id ? data.clientes.find((c) => c.id === p.cliente_id)?.nome : 'Balcao';
      const totalItens = p.itens.reduce((sum, it) => sum + it.qtd * it.preco_unit, 0) - p.desconto + p.frete;
      return {
        ID: p.id,
        DataCriacao: p.criado_em,
        PrazoEntrega: p.prazo || 'Nao informado',
        Cliente: cli || 'Balcao',
        Status: p.status,
        ValorTotal: totalItens,
        Desconto: p.desconto,
        Frete: p.frete,
      };
    })
  );
  XLSX.utils.book_append_sheet(wb, wsPedidos, 'Pedidos');

  // 7. Financeiro
  const wsFinanceiro = XLSX.utils.json_to_sheet(
    data.lancamentos.map((l) => ({
      ID: l.id,
      Vencimento: l.vencimento,
      Tipo: l.tipo === 'receita' ? 'Receita' : 'Despesa',
      Categoria: l.categoria,
      Descricao: l.descricao,
      Valor: l.valor,
      PagoEm: l.pago_em || 'Pendente',
      Status: l.pago_em ? 'Pago' : 'Pendente',
    }))
  );
  XLSX.utils.book_append_sheet(wb, wsFinanceiro, 'Financeiro');

  // 8. Impressoras
  const wsImpressoras = XLSX.utils.json_to_sheet(
    data.impressoras.map((imp) => ({
      Nome: imp.nome,
      ConsumoWatts: imp.watts,
      ValorMaquina: imp.valor,
      HorasAcumuladas: imp.horas_acumuladas,
      VidaUtilHoras: imp.vida_h,
      ManutencaoHora: imp.manutencao_h,
      Ativa: imp.ativo ? 'Sim' : 'Nao',
    }))
  );
  XLSX.utils.book_append_sheet(wb, wsImpressoras, 'Impressoras');

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}

export function baixarArquivoSnapshot(snapshot: BackupSnapshot) {
  let blob: Blob;
  if (snapshot.formato === 'json') {
    blob = new Blob([snapshot.conteudo], { type: 'application/json' });
  } else if (snapshot.formato === 'csv') {
    blob = new Blob([snapshot.conteudo], { type: 'text/csv;charset=utf-8;' });
  } else {
    // xlsx dataURI/base64
    const byteCharacters = atob(snapshot.conteudo.split(',')[1] || snapshot.conteudo);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = snapshot.nome_arquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function restaurarSnapshot(id: string): boolean {
  const lista = obterSnapshotsBackup();
  const snap = lista.find((s) => s.id === id);
  if (!snap) return false;

  try {
    if (snap.formato === 'json') {
      db.importJson(snap.conteudo);
      return true;
    }
    alert('Apenas backups no formato JSON podem ser restaurados automaticamente de forma integral.');
    return false;
  } catch (err) {
    console.error('Erro ao restaurar snapshot:', err);
    alert('Erro ao restaurar dados do snapshot: ' + err);
    return false;
  }
}

export async function executarBackup(opcoes?: {
  formato?: 'json' | 'csv' | 'xlsx';
  baixar?: boolean;
  ehAgendado?: boolean;
}): Promise<{ sucesso: boolean; mensagem: string; snapshot: BackupSnapshot }> {
  const dbData = db.get();
  const agendamento = obterConfigBackup(dbData.config);
  const formato = opcoes?.formato || agendamento.formato || 'json';
  const baixar = opcoes?.baixar ?? agendamento.baixar_automaticamente;
  const agora = new Date();
  const dataIso = agora.toISOString();
  const timestampFormatado = agora.toISOString().replace(/[:.]/g, '-').slice(0, 16);

  let conteudo = '';
  let tamanho = 0;
  let nomeArquivo = '';

  const itensResumo = {
    clientes: dbData.clientes.filter((c) => c.ativo).length,
    produtos: dbData.produtos.filter((p) => p.ativo).length,
    rolos: dbData.rolos.filter((r) => r.ativo).length,
    insumos: dbData.insumos.filter((i) => i.ativo).length,
    pedidos: dbData.pedidos.length,
    vendas: dbData.vendas.length,
  };

  if (formato === 'json') {
    conteudo = JSON.stringify(dbData, null, 2);
    tamanho = new Blob([conteudo]).size;
    nomeArquivo = `backup-3dconex-${timestampFormatado}.json`;
  } else if (formato === 'csv') {
    conteudo = gerarConteudoCsvConsolidado();
    tamanho = new Blob([conteudo]).size;
    nomeArquivo = `backup-3dconex-${timestampFormatado}.csv`;
  } else {
    // xlsx
    const arrayBuf = gerarConteudoExcelArrayBuffer();
    tamanho = arrayBuf.byteLength;
    nomeArquivo = `backup-3dconex-${timestampFormatado}.xlsx`;
    // Converter para base64 para armazenar no snapshot
    const bytes = new Uint8Array(arrayBuf);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    conteudo = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + btoa(binary);
  }

  const snapshot: BackupSnapshot = {
    id: `snap-${Date.now()}`,
    data: dataIso,
    formato,
    nome_arquivo: nomeArquivo,
    tamanho,
    conteudo,
    itens: itensResumo,
  };

  // Salvar no histórico de snapshots locais
  salvarSnapshot(snapshot);

  // Atualizar estado de configuração no banco com a data do último backup
  db.update((state) => {
    state.config.backup_agendamento = {
      ...agendamento,
      ultimo_backup_em: dataIso,
      ultimo_backup_formato: formato,
      ultimo_backup_tamanho: tamanho,
      ultimo_backup_status: 'sucesso',
    };
  });

  // Se solicitado ou configurado para baixar automaticamente
  if (baixar) {
    baixarArquivoSnapshot(snapshot);
  }

  // Notificar outros componentes via CustomEvent
  window.dispatchEvent(
    new CustomEvent('conexlab:backup_realizado', {
      detail: {
        snapshot,
        ehAgendado: !!opcoes?.ehAgendado,
      },
    })
  );

  return {
    sucesso: true,
    mensagem: `Backup (${formato.toUpperCase()}) realizado com sucesso!`,
    snapshot,
  };
}

export async function verificarEExecutarBackupAgendado(): Promise<boolean> {
  const data = db.get();
  const agendamento = obterConfigBackup(data.config);

  if (!agendamento.ativo) {
    return false;
  }

  const agora = Date.now();
  let deveExecutar = false;

  if (!agendamento.ultimo_backup_em) {
    // Nunca foi feito backup
    deveExecutar = true;
  } else {
    const ultimoTimestamp = new Date(agendamento.ultimo_backup_em).getTime();
    const intervaloMs = agendamento.frequencia_horas * 3600 * 1000;
    if (agora - ultimoTimestamp >= intervaloMs) {
      deveExecutar = true;
    }
  }

  if (deveExecutar) {
    console.log('⏰ Executando backup automático agendado...');
    await executarBackup({
      formato: agendamento.formato,
      baixar: agendamento.baixar_automaticamente,
      ehAgendado: true,
    });
    return true;
  }

  return false;
}

export function iniciarAgendadorBackup(): () => void {
  // Verificação inicial na abertura do sistema com pequeno atraso para estabilizar carregamento
  const timerInicial = setTimeout(() => {
    verificarEExecutarBackupAgendado().catch((err) => {
      console.warn('Erro na verificação inicial de backup agendado:', err);
    });
  }, 2500);

  // Checagem periódica a cada 60 segundos
  const intervalId = setInterval(() => {
    verificarEExecutarBackupAgendado().catch((err) => {
      console.warn('Erro na verificação periódica de backup agendado:', err);
    });
  }, 60 * 1000);

  return () => {
    clearTimeout(timerInicial);
    clearInterval(intervalId);
  };
}
