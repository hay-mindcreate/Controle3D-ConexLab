import React, { useState } from 'react';
import { formatBrl, formatDec } from '../calc';
import { db } from '../db';
import { custoProduto, saldos } from '../services';
import { NavTab } from './Navigation';

interface RelatoriosViewProps {
  onNavigate: (tab: NavTab, extra?: any) => void;
}

type TipoRelatorio = 'vendas' | 'custos' | 'lucratividade' | 'estoque' | 'produtos' | 'clientes' | 'producao';

export const RelatoriosView: React.FC<RelatoriosViewProps> = ({ onNavigate }) => {
  const data = db.get();
  const hoje = new Date().toISOString().split('T')[0];
  const iniMes = hoje.slice(0, 7) + '-01';

  const [relatorioAtivo, setRelatorioAtivo] = useState<TipoRelatorio>('vendas');
  const [dataIni, setDataIni] = useState(iniMes);
  const [dataFim, setDataFim] = useState(hoje);
  const [agruparLucratividade, setAgruparLucratividade] = useState<'produto' | 'canal'>('produto');

  const nomes: Record<TipoRelatorio, string> = {
    vendas: 'Relatório de Vendas',
    custos: 'Relatório de Custos e Despesas',
    lucratividade: 'Relatório de Lucratividade',
    estoque: 'Posição e Valor do Estoque',
    produtos: 'Desempenho dos Produtos',
    clientes: 'Histórico de Compras por Cliente',
    producao: 'Relatório de Produção e Perdas',
  };

  // Geradores de dados para cada relatório
  const gerarDados = () => {
    if (relatorioAtivo === 'vendas') {
      const vs = data.vendas
        .filter((v) => v.status === 'ativa' && v.data >= dataIni && v.data <= dataFim)
        .sort((a, b) => a.data.localeCompare(b.data));

      const cabecalho = ['Data', 'Venda', 'Cliente', 'Canal', 'Pagamento', 'Total', 'Custo', 'Taxa', 'Lucro Líquido'];
      const linhas = vs.map((v) => {
        const cli = v.cliente_id ? data.clientes.find((c) => c.id === v.cliente_id)?.nome : 'Balcão';
        const canal = v.canal_id ? data.canais.find((c) => c.id === v.canal_id)?.nome : 'Balcão';
        return [
          new Date(v.data + 'T00:00:00').toLocaleDateString('pt-BR'),
          `#${v.id}`,
          cli || 'Balcão',
          canal || 'Balcão',
          v.forma_pagamento,
          formatBrl(v.total),
          formatBrl(v.custo),
          formatBrl(v.taxa),
          formatBrl(v.lucro),
        ];
      });
      return { cabecalho, linhas };
    }

    if (relatorioAtivo === 'custos') {
      const vs = data.vendas.filter((v) => v.status === 'ativa' && v.data >= dataIni && v.data <= dataFim);
      const totalCmv = vs.reduce((acc, v) => acc + v.custo, 0);
      const totalTaxas = vs.reduce((acc, v) => acc + v.taxa, 0);

      const cabecalho = ['Tipo de Custo', 'Natureza', 'Total'];
      const linhas: string[][] = [
        ['Custo das Peças Vendidas (CMV: filamento, energia, mão de obra)', 'Variável', formatBrl(totalCmv)],
        ['Taxas de Plataformas / Canais', 'Variável', formatBrl(totalTaxas)],
      ];

      const despesas = data.lancamentos.filter(
        (l) => !l.cancelado && l.tipo === 'despesa' && l.pago_em && l.pago_em >= dataIni && l.pago_em <= dataFim
      );

      const agruparDespesas: Record<string, { natureza: string; total: number }> = {};
      for (const d of despesas) {
        const cat = d.categoria || 'Geral';
        if (!agruparDespesas[cat]) agruparDespesas[cat] = { natureza: d.natureza, total: 0 };
        agruparDespesas[cat].total += d.valor;
      }

      for (const [cat, info] of Object.entries(agruparDespesas)) {
        linhas.push([cat, info.natureza === 'fixa' ? 'Fixa' : 'Variável', formatBrl(info.total)]);
      }

      return { cabecalho, linhas };
    }

    if (relatorioAtivo === 'lucratividade') {
      const vs = data.vendas.filter((v) => v.status === 'ativa' && v.data >= dataIni && v.data <= dataFim);
      const acc: Record<string, { qtd: number; receita: number; custo: number; taxa: number }> = {};

      for (const v of vs) {
        if (agruparLucratividade === 'canal') {
          const k = v.canal_id ? (data.canais.find((c) => c.id === v.canal_id)?.nome || 'Balcão') : 'Balcão';
          if (!acc[k]) acc[k] = { qtd: 0, receita: 0, custo: 0, taxa: 0 };
          acc[k].qtd += v.itens.reduce((iAcc, it) => iAcc + it.qtd, 0);
          acc[k].receita += v.total;
          acc[k].custo += v.custo;
          acc[k].taxa += v.taxa;
        } else {
          for (const it of v.itens) {
            const k = it.descricao;
            if (!acc[k]) acc[k] = { qtd: 0, receita: 0, custo: 0, taxa: 0 };
            acc[k].qtd += it.qtd;
            acc[k].receita += it.qtd * it.preco_unit;
            acc[k].custo += it.qtd * it.custo_unit;
          }
        }
      }

      const cabecalho = [
        agruparLucratividade === 'canal' ? 'Canal de Venda' : 'Produto',
        'Quantidade',
        'Receita Bruta',
        'Custo (CMV)',
        'Taxas',
        'Lucro Líquido',
        'Margem Real (%)',
      ];

      const linhas = Object.entries(acc)
        .sort((a, b) => b[1].receita - a[1].receita)
        .map(([nome, info]) => {
          const lucro = info.receita - info.custo - info.taxa;
          const margem = info.receita > 0 ? (lucro / info.receita) * 100 : 0;
          return [
            nome,
            String(info.qtd),
            formatBrl(info.receita),
            formatBrl(info.custo),
            formatBrl(info.taxa),
            formatBrl(lucro),
            `${formatDec(margem, 1)}%`,
          ];
        });

      return { cabecalho, linhas };
    }

    if (relatorioAtivo === 'estoque') {
      const sdRolos = saldos('rolo');
      const sdInsumos = saldos('insumo');
      const sdProdutos = saldos('produto');

      const cabecalho = ['Tipo de Item', 'Item', 'Saldo em Estoque', 'Un.', 'Estoque Mínimo', 'Valor Imobilizado (Custo)'];
      const linhas: string[][] = [];

      for (const r of data.rolos.filter((r) => r.ativo)) {
        const mat = data.materiais.find((m) => m.id === r.material_id);
        const sl = sdRolos[r.id] || 0;
        const cg = r.peso_inicial > 0 ? r.preco / r.peso_inicial : 0;
        linhas.push([
          'Filamento',
          `Rolo #${r.id} ${mat ? `${mat.tipo} ${mat.cor}` : ''}`,
          `${sl}`,
          'g',
          `${mat?.minimo_g || 0}`,
          formatBrl(sl * cg),
        ]);
      }

      for (const i of data.insumos.filter((i) => i.ativo)) {
        const sl = sdInsumos[i.id] || 0;
        linhas.push(['Insumo', i.nome, `${sl}`, i.unidade, `${i.minimo}`, formatBrl(sl * i.custo_unit)]);
      }

      for (const p of data.produtos.filter((p) => p.ativo)) {
        const sl = sdProdutos[p.id] || 0;
        const c = custoProduto(p, data.config).custo;
        linhas.push(['Produto Pronto', p.nome, `${sl}`, 'un', `${p.minimo}`, formatBrl(sl * c)]);
      }

      return { cabecalho, linhas };
    }

    if (relatorioAtivo === 'produtos') {
      const cabecalho = ['SKU', 'Produto', 'Categoria', 'Custo Unit.', 'Preço Venda', 'Margem Real', 'Meta de Margem'];
      const linhas = data.produtos.filter((p) => p.ativo).map((p) => {
        const c = custoProduto(p, data.config).custo;
        const margemReal = p.preco > 0 ? ((p.preco - c) / p.preco) * 100 : 0;
        return [
          p.sku,
          p.nome,
          p.categoria || '-',
          formatBrl(c),
          formatBrl(p.preco),
          `${formatDec(margemReal, 1)}%`,
          `${p.margem_pct}%`,
        ];
      });
      return { cabecalho, linhas };
    }

    if (relatorioAtivo === 'clientes') {
      const vs = data.vendas.filter((v) => v.status === 'ativa' && v.data >= dataIni && v.data <= dataFim);
      const acc: Record<string, { compras: number; total: number; ultima: string }> = {};

      for (const v of vs) {
        const cliNome = v.cliente_id ? (data.clientes.find((c) => c.id === v.cliente_id)?.nome || 'Balcão') : 'Balcão';
        if (!acc[cliNome]) acc[cliNome] = { compras: 0, total: 0, ultima: v.data };
        acc[cliNome].compras += 1;
        acc[cliNome].total += v.total;
        if (v.data > acc[cliNome].ultima) acc[cliNome].ultima = v.data;
      }

      const cabecalho = ['Cliente', 'Nº de Vendas', 'Total Comprado', 'Última Compra'];
      const linhas = Object.entries(acc)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([nome, info]) => [
          nome,
          String(info.compras),
          formatBrl(info.total),
          new Date(info.ultima + 'T00:00:00').toLocaleDateString('pt-BR'),
        ]);

      return { cabecalho, linhas };
    }

    // Produção e falhas
    const peds = data.pedidos.filter((p) => p.criado_em.slice(0, 10) >= dataIni && p.criado_em.slice(0, 10) <= dataFim);
    const cabecalho = ['Pedido', 'Tipo', 'Cliente', 'Status', 'Data', 'Prazo', 'Qtd Peças', 'Custo Falhas'];
    const linhas = peds.map((p) => {
      const cli = p.cliente_id ? data.clientes.find((c) => c.id === p.cliente_id)?.nome : (p.tipo === 'estoque' ? 'Reposição Estoque' : 'Balcão');
      const totalQtd = p.itens.reduce((acc, it) => acc + it.qtd, 0);
      return [
        `#${String(p.id).padStart(4, '0')}`,
        p.tipo,
        cli || 'Estoque',
        p.status,
        new Date(p.criado_em).toLocaleDateString('pt-BR'),
        p.prazo ? new Date(p.prazo + 'T00:00:00').toLocaleDateString('pt-BR') : '-',
        String(totalQtd),
        formatBrl(p.custo_extra),
      ];
    });

    return { cabecalho, linhas };
  };

  const { cabecalho, linhas } = gerarDados();

  const handleExportarCsv = () => {
    let csvContent = '\uFEFF'; // BOM para o Excel ler UTF-8 sem corromper acentos
    csvContent += cabecalho.join(';') + '\n';
    for (const r of linhas) {
      csvContent += r.map((c) => `"${c}"`).join(';') + '\n';
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${relatorioAtivo}-${hoje}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Relatórios Gerenciais</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleExportarCsv}>📥 Exportar CSV (Excel)</button>
          <button className="sec" onClick={() => window.print()}>🖨 Imprimir</button>
        </div>
      </div>

      {/* Menu de seleção do relatório */}
      <div className="no-print" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {(Object.keys(nomes) as TipoRelatorio[]).map((key) => (
          <button
            key={key}
            className={relatorioAtivo === key ? '' : 'sec'}
            style={{ fontSize: 13, padding: '6px 12px' }}
            onClick={() => setRelatorioAtivo(key)}
          >
            {nomes[key]}
          </button>
        ))}
      </div>

      {/* Filtros de data */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ margin: 0 }}>De:</label>
          <input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} style={{ width: 150 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ margin: 0 }}>Até:</label>
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} style={{ width: 150 }} />
        </div>

        {relatorioAtivo === 'lucratividade' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 10 }}>
            <label style={{ margin: 0 }}>Agrupar por:</label>
            <select
              value={agruparLucratividade}
              onChange={(e) => setAgruparLucratividade(e.target.value as any)}
              style={{ width: 140 }}
            >
              <option value="produto">Por Produto</option>
              <option value="canal">Por Canal</option>
            </select>
          </div>
        )}
      </div>

      {/* Tabela do Relatório */}
      <div className="card wrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>{nomes[relatorioAtivo]}</h3>
          <small className="muted">
            Período: {new Date(dataIni + 'T00:00:00').toLocaleDateString('pt-BR')} até{' '}
            {new Date(dataFim + 'T00:00:00').toLocaleDateString('pt-BR')} ({linhas.length} registro(s))
          </small>
        </div>

        {linhas.length === 0 ? (
          <p className="muted" style={{ padding: 12 }}>
            Nenhum dado encontrado para os filtros selecionados.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                {cabecalho.map((c, idx) => (
                  <th key={idx}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
