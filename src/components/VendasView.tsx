import React, { useState } from 'react';
import { formatBrl } from '../calc';
import { db } from '../db';
import { exportarTabelaParaCsv } from '../importExport';
import { estornarVenda, vendaAvulsa } from '../services';
import { Venda } from '../types';
import { NavTab } from './Navigation';

interface VendasViewProps {
  onNavigate: (tab: NavTab, extra?: any) => void;
  vendaId?: number | null;
}

export const VendasView: React.FC<VendasViewProps> = ({ onNavigate, vendaId }) => {
  const data = db.get();
  const hoje = new Date().toISOString().split('T')[0];
  const mesAtual = hoje.slice(0, 7);

  const [filtroMes, setFiltroMes] = useState<string>(mesAtual);
  const [vendaSelecionadaId, setVendaSelecionadaId] = useState<number | null>(vendaId || null);
  const [modalNovaVenda, setModalNovaVenda] = useState(false);

  // Form de nova venda avulsa
  const [formClienteId, setFormClienteId] = useState<number | ''>('');
  const [formCanalId, setFormCanalId] = useState<number | ''>(data.canais[0]?.id || '');
  const [formPagamento, setFormPagamento] = useState<string>('PIX');
  const [formData, setFormData] = useState<string>(hoje);
  const [formItens, setFormItens] = useState<Array<{ produtoId: number | null; descricao: string; qtd: number; precoUnit: number }>>([
    { produtoId: null, descricao: '', qtd: 1, precoUnit: 0 },
  ]);

  const vendasFiltradas = data.vendas
    .filter((v) => {
      if (filtroMes && !v.data.startsWith(filtroMes)) return false;
      return true;
    })
    .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);

  const totalPeriodo = vendasFiltradas
    .filter((v) => v.status === 'ativa')
    .reduce((acc, v) => acc + v.total, 0);

  const lucroPeriodo = vendasFiltradas
    .filter((v) => v.status === 'ativa')
    .reduce((acc, v) => acc + v.lucro, 0);

  const vendaAtual = vendaSelecionadaId ? data.vendas.find((v) => v.id === vendaSelecionadaId) : null;

  const handleSalvarVenda = (e: React.FormEvent) => {
    e.preventDefault();
    const itensValidos = formItens.filter((it) => it.descricao.trim() || it.produtoId);
    if (itensValidos.length === 0) {
      alert('Adicione pelo menos um item à venda.');
      return;
    }

    const v = vendaAvulsa(
      formClienteId ? Number(formClienteId) : null,
      formCanalId ? Number(formCanalId) : null,
      formPagamento,
      formData,
      itensValidos
    );

    setModalNovaVenda(false);
    setVendaSelecionadaId(v.id);
  };

  const handleEstornar = (v: Venda) => {
    if (!confirm(`Tem certeza que deseja estornar a venda #${v.id}? Isso cancelará o lançamento financeiro e devolverá as peças ao estoque pronto.`)) {
      return;
    }
    estornarVenda(v.id);
  };

  const handleExcluirVenda = (id: number) => {
    if (!confirm(`Deseja realmente excluir permanentemente a venda #${id}? Esta ação não pode ser desfeita.`)) {
      return;
    }
    db.update((state) => {
      state.lancamentos = state.lancamentos.filter((l) => l.venda_id !== id);
      state.movimentos = state.movimentos.filter((m) => !(m.ref_tipo === 'venda' && m.ref_id === id));
      state.vendas = state.vendas.filter((v) => v.id !== id);
    });
    if (vendaSelecionadaId === id) {
      setVendaSelecionadaId(null);
    }
  };

  const handleExportarCsv = () => {
    const cabecalhos = [
      'ID Venda',
      'Data',
      'Cliente',
      'Canal',
      'Forma de Pagamento',
      'Total (R$)',
      'Custo (R$)',
      'Taxas (R$)',
      'Lucro Líquido (R$)',
      'Status',
      'Itens',
    ];
    const linhas = vendasFiltradas.map((v) => {
      const cli = v.cliente_id ? data.clientes.find((c) => c.id === v.cliente_id)?.nome : 'Balcão';
      const canal = v.canal_id ? data.canais.find((c) => c.id === v.canal_id)?.nome : 'Balcão';
      const itensStr = v.itens.map((it) => `${it.qtd}x ${it.descricao}`).join(' | ');
      return [
        `#${String(v.id).padStart(4, '0')}`,
        v.data,
        cli || 'Balcão',
        canal || 'Balcão',
        v.forma_pagamento,
        v.total.toFixed(2),
        v.custo.toFixed(2),
        v.taxa.toFixed(2),
        v.lucro.toFixed(2),
        v.status,
        itensStr,
      ];
    });
    exportarTabelaParaCsv(`vendas-${filtroMes || 'todas'}`, cabecalhos, linhas);
  };

  // Se vendo detalhe de uma venda
  if (vendaAtual) {
    const cli = vendaAtual.cliente_id ? data.clientes.find((c) => c.id === vendaAtual.cliente_id) : null;
    const canal = vendaAtual.canal_id ? data.canais.find((c) => c.id === vendaAtual.canal_id) : null;

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <button className="sec" onClick={() => setVendaSelecionadaId(null)} style={{ marginRight: 8 }}>
              ← Voltar às Vendas
            </button>
            <h2 style={{ display: 'inline', verticalAlign: 'middle' }}>Venda #{vendaAtual.id}</h2>
            <span className={`tag ${vendaAtual.status}`} style={{ marginLeft: 8 }}>
              {vendaAtual.status}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {vendaAtual.status === 'ativa' && (
              <button className="sec" onClick={() => handleEstornar(vendaAtual)}>
                Estornar
              </button>
            )}
            <button className="sec bad" onClick={() => handleExcluirVenda(vendaAtual.id)} title="Excluir venda permanentemente">
              Excluir Venda
            </button>
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 16 }}>
          <div className="card">
            <h4 style={{ margin: '0 0 8px' }}>Dados da Venda</h4>
            <p style={{ margin: '4px 0' }}><b>Data:</b> {new Date(vendaAtual.data + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
            <p style={{ margin: '4px 0' }}><b>Cliente:</b> {cli ? cli.nome : 'Balcão / Sem cadastro'}</p>
            <p style={{ margin: '4px 0' }}><b>Canal:</b> {canal ? canal.nome : 'Balcão'}</p>
            <p style={{ margin: '4px 0' }}><b>Pagamento:</b> {vendaAtual.forma_pagamento}</p>
            {vendaAtual.pedido_id && (
              <p style={{ margin: '4px 0' }}>
                <b>Originada do Pedido:</b>{' '}
                <a
                  href={`#pedido-${vendaAtual.pedido_id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('pedidos', { pedidoId: vendaAtual.pedido_id });
                  }}
                >
                  #{String(vendaAtual.pedido_id).padStart(4, '0')}
                </a>
              </p>
            )}
          </div>

          <div className="card kpi">
            <small>Total da Venda</small>
            <h2>{formatBrl(vendaAtual.total)}</h2>
            <small>Custo dos Produtos (CMV): {formatBrl(vendaAtual.custo)}</small>
            {vendaAtual.taxa > 0 && <small style={{ display: 'block' }}>Taxa do Canal: {formatBrl(vendaAtual.taxa)}</small>}
            <div style={{ marginTop: 8 }}>
              <span className={`tag ${vendaAtual.lucro >= 0 ? 'ok' : 'bad'}`}>
                Lucro Líquido: <b>{formatBrl(vendaAtual.lucro)}</b>
              </span>
            </div>
          </div>
        </div>

        <div className="card wrap">
          <h4 style={{ margin: '0 0 10px' }}>Itens da Venda</h4>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qtd</th>
                <th>Preço Unit.</th>
                <th>Custo Unit.</th>
                <th>Total</th>
                <th>Lucro</th>
              </tr>
            </thead>
            <tbody>
              {vendaAtual.itens.map((it) => {
                const totalItem = it.qtd * it.preco_unit;
                const lucroItem = totalItem - it.qtd * it.custo_unit;
                return (
                  <tr key={it.id}>
                    <td><b>{it.descricao}</b></td>
                    <td>{it.qtd}</td>
                    <td>{formatBrl(it.preco_unit)}</td>
                    <td>{formatBrl(it.custo_unit)}</td>
                    <td><b>{formatBrl(totalItem)}</b></td>
                    <td className="ok">{formatBrl(lucroItem)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Lista de vendas
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0 }}>Vendas ({vendasFiltradas.length})</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="sec"
            onClick={handleExportarCsv}
            title="Exportar vendas exibidas para arquivo CSV"
            disabled={vendasFiltradas.length === 0}
          >
            📥 Exportar CSV
          </button>
          <button onClick={() => setModalNovaVenda(true)}>+ Nova Venda de Balcão</button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ margin: 0 }}>Mês:</label>
          <input
            type="month"
            value={filtroMes}
            onChange={(e) => setFiltroMes(e.target.value)}
            style={{ width: 170 }}
          />
          {filtroMes && (
            <button className="sec" style={{ padding: '6px 10px' }} onClick={() => setFiltroMes('')}>
              Ver Todas
            </button>
          )}
        </div>

        <div style={{ fontSize: 14 }}>
          <span>Faturamento: <b className="ok">{formatBrl(totalPeriodo)}</b></span> ·{' '}
          <span>Lucro Líquido: <b style={{ color: 'var(--p)' }}>{formatBrl(lucroPeriodo)}</b></span>
        </div>
      </div>

      <div className="card wrap">
        {vendasFiltradas.length === 0 ? (
          <p className="muted" style={{ padding: 12 }}>
            Nenhuma venda encontrada para o período selecionado.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Data</th>
                <th>Cliente</th>
                <th>Canal</th>
                <th>Pagamento</th>
                <th>Total</th>
                <th>Custo</th>
                <th>Lucro</th>
                <th>Status</th>
                <th className="r">Ações</th>
              </tr>
            </thead>
            <tbody>
              {vendasFiltradas.map((v) => {
                const cli = v.cliente_id ? data.clientes.find((c) => c.id === v.cliente_id) : null;
                const canal = v.canal_id ? data.canais.find((c) => c.id === v.canal_id) : null;
                return (
                  <tr key={v.id}>
                    <td>
                      <a
                        href={`#venda-${v.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          setVendaSelecionadaId(v.id);
                        }}
                        style={{ fontWeight: 700 }}
                      >
                        #{v.id}
                      </a>
                    </td>
                    <td>{new Date(v.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                    <td>{cli ? cli.nome : 'Balcão'}</td>
                    <td>{canal ? canal.nome : 'Balcão'}</td>
                    <td>{v.forma_pagamento}</td>
                    <td><b>{formatBrl(v.total)}</b></td>
                    <td>{formatBrl(v.custo)}</td>
                    <td className="ok"><b>{formatBrl(v.lucro)}</b></td>
                    <td>
                      <span className={`tag ${v.status}`}>{v.status}</span>
                    </td>
                    <td className="r">
                      <button
                        className="sec"
                        style={{ padding: '3px 8px', fontSize: 13, marginRight: 6 }}
                        onClick={() => setVendaSelecionadaId(v.id)}
                      >
                        Detalhes
                      </button>
                      <button
                        className="sec bad"
                        style={{ padding: '3px 8px', fontSize: 13 }}
                        onClick={() => handleExcluirVenda(v.id)}
                        title="Excluir venda permanentemente"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de Nova Venda Avulsa */}
      {modalNovaVenda && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
        >
          <div className="card" style={{ width: 560, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>Registrar Venda Avulsa / Balcão</h3>
            <form onSubmit={handleSalvarVenda}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                <div>
                  <label>Cliente (opcional)</label>
                  <select
                    value={formClienteId}
                    onChange={(e) => setFormClienteId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">Balcão / Cliente não cadastrado</option>
                    {data.clientes.filter((c) => c.ativo).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label>Canal</label>
                    <button
                      type="button"
                      className="sec"
                      style={{ fontSize: 11, padding: '1px 6px', marginBottom: 2 }}
                      title="Cadastrar novo canal de venda"
                      onClick={() => {
                        const nome = prompt('Nome do novo canal (ex: Mercado Livre, Shopee, WhatsApp):');
                        if (!nome || !nome.trim()) return;
                        const taxa = parseFloat(prompt('Taxa percentual (%) deste canal:', '0') || '0');
                        const fixa = parseFloat(prompt('Taxa fixa (R$) por venda neste canal:', '0') || '0');
                        db.update((state) => {
                          const nextId = state.canais.length > 0 ? Math.max(...state.canais.map((c) => c.id)) + 1 : 1;
                          state.canais.push({
                            id: nextId,
                            nome: nome.trim(),
                            taxa_pct: isNaN(taxa) ? 0 : taxa,
                            taxa_fixa: isNaN(fixa) ? 0 : fixa,
                            ativo: true,
                          });
                          setFormCanalId(nextId);
                        });
                      }}
                    >
                      + Novo Canal
                    </button>
                  </div>
                  <select
                    value={formCanalId}
                    onChange={(e) => setFormCanalId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">Balcão</option>
                    {data.canais.filter((c) => c.ativo).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} {c.taxa_pct > 0 ? `(${c.taxa_pct}%)` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>Forma de Pagamento</label>
                  <select value={formPagamento} onChange={(e) => setFormPagamento(e.target.value)}>
                    <option value="PIX">PIX</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                  </select>
                </div>

                <div>
                  <label>Data</label>
                  <input type="date" value={formData} onChange={(e) => setFormData(e.target.value)} />
                </div>
              </div>

              <h4 style={{ margin: '14px 0 6px' }}>Produtos Prontos Vendidos</h4>
              {formItens.map((it, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <select
                    value={it.produtoId || ''}
                    onChange={(e) => {
                      const pid = e.target.value ? Number(e.target.value) : null;
                      const prod = pid ? data.produtos.find((p) => p.id === pid) : null;
                      setFormItens((prev) => {
                        const next = [...prev];
                        next[idx] = {
                          ...next[idx],
                          produtoId: pid,
                          descricao: prod ? prod.nome : next[idx].descricao,
                          precoUnit: prod ? prod.preco : next[idx].precoUnit,
                        };
                        return next;
                      });
                    }}
                    style={{ flex: 1 }}
                  >
                    <option value="">Produto pronto...</option>
                    {data.produtos.filter((p) => p.ativo).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} ({formatBrl(p.preco)})
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    value={it.qtd}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFormItens((prev) => {
                        const next = [...prev];
                        next[idx].qtd = val;
                        return next;
                      });
                    }}
                    style={{ width: 70 }}
                  />

                  <input
                    type="number"
                    step="0.01"
                    value={it.precoUnit}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFormItens((prev) => {
                        const next = [...prev];
                        next[idx].precoUnit = val;
                        return next;
                      });
                    }}
                    placeholder="R$"
                    style={{ width: 90 }}
                  />
                </div>
              ))}

              <button
                type="button"
                className="sec"
                style={{ fontSize: 12, padding: '4px 8px', marginTop: 4 }}
                onClick={() => setFormItens((prev) => [...prev, { produtoId: null, descricao: '', qtd: 1, precoUnit: 0 }])}
              >
                + Item
              </button>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" className="sec" onClick={() => setModalNovaVenda(false)}>
                  Cancelar
                </button>
                <button type="submit">Concluir Venda</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
