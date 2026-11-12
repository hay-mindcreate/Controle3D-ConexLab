import React, { useState } from 'react';
import { formatBrl, formatDec } from '../calc';
import { db } from '../db';
import { exportarTabelaParaCsv } from '../importExport';
import {
  moverPedido,
  ORDEM_STATUS,
  planoConsumo,
  planoInsumos,
  registrarFalha,
  saldos,
} from '../services';
import { Pedido, PedidoStatus } from '../types';
import { NavTab } from './Navigation';

interface PedidosViewProps {
  onNavigate: (tab: NavTab, extra?: any) => void;
  pedidoId?: number | null;
}

const COLUNAS_KANBAN: PedidoStatus[] = [
  'aguardando',
  'imprimindo',
  'acabamento',
  'pronto',
  'enviado',
  'entregue',
  'cancelado',
];

export const PedidosView: React.FC<PedidosViewProps> = ({ onNavigate, pedidoId }) => {
  const data = db.get();
  const hoje = new Date().toISOString().split('T')[0];

  const [filtroTipo, setFiltroTipo] = useState<string>('');
  const [pedidoSelecionadoId, setPedidoSelecionadoId] = useState<number | null>(pedidoId || null);

  // Modal para iniciar impressão e confirmar consumo de materiais
  const [modalImprimir, setModalImprimir] = useState<Pedido | null>(null);
  const [consumoRolos, setConsumoRolos] = useState<Array<{ roloId: number; gramas: number }>>([]);
  const [consumoInsumos, setConsumoInsumos] = useState<Array<{ insumoId: number; qtd: number }>>([]);

  // Modal de registrar falha de impressão
  const [modalFalha, setModalFalha] = useState<Pedido | null>(null);
  const [falhaRoloId, setFalhaRoloId] = useState<number>(data.rolos[0]?.id || 0);
  const [falhaGramas, setFalhaGramas] = useState<number>(10);
  const [falhaObs, setFalhaObs] = useState<string>('Bico entupido / descolamento de mesa');

  // Modal de novo pedido direto (sem orçamento)
  const [modalNovoPedido, setModalNovoPedido] = useState(false);
  const [novoClienteId, setNovoClienteId] = useState<number | ''>(data.clientes[0]?.id || '');
  const [novoCanalId, setNovoCanalId] = useState<number | ''>(data.canais[0]?.id || '');
  const [novoTipo, setNovoTipo] = useState<'cliente' | 'estoque'>('cliente');
  const [novoPrazo, setNovoPrazo] = useState<string>(hoje);
  const [novoObs, setNovoObs] = useState<string>('');
  const [novoItens, setNovoItens] = useState<Array<{ produtoId: number | null; descricao: string; qtd: number; precoUnit: number }>>([
    { produtoId: null, descricao: '', qtd: 1, precoUnit: 0 },
  ]);

  const pedidosFiltrados = data.pedidos.filter((p) => {
    if (filtroTipo && p.tipo !== filtroTipo) return false;
    return true;
  });

  const pedidoDetalhe = pedidoSelecionadoId ? data.pedidos.find((p) => p.id === pedidoSelecionadoId) : null;

  const handleAbrirMoverParaImprimindo = (ped: Pedido) => {
    const planoM = planoConsumo(ped);
    const planoI = planoInsumos(ped);

    const initRolos: Array<{ roloId: number; gramas: number }> = [];
    for (const pl of planoM) {
      const primeiroRolo = pl.rolos[0]?.rolo || data.rolos.find((r) => r.material_id === pl.material.id);
      if (primeiroRolo) {
        initRolos.push({ roloId: primeiroRolo.id, gramas: pl.gramas });
      }
    }

    const initInsumos = planoI.map((pi) => ({ insumoId: pi.insumo.id, qtd: pi.qtd }));

    setConsumoRolos(initRolos);
    setConsumoInsumos(initInsumos);
    setModalImprimir(ped);
  };

  const handleConfirmarInicioImpressao = () => {
    if (!modalImprimir) return;
    moverPedido(modalImprimir.id, 'imprimindo', consumoRolos, consumoInsumos);
    setModalImprimir(null);
  };

  const handleMoverStatus = (ped: Pedido, para: PedidoStatus) => {
    if (ped.status === 'aguardando' && para === 'imprimindo') {
      handleAbrirMoverParaImprimindo(ped);
      return;
    }
    const erro = moverPedido(ped.id, para);
    if (erro) {
      alert(erro);
    }
  };

  const handleSalvarFalha = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalFalha || !falhaRoloId || falhaGramas <= 0) return;
    registrarFalha(modalFalha.id, falhaRoloId, falhaGramas, falhaObs);
    setModalFalha(null);
  };

  const handleExcluirPedido = (id: number) => {
    if (!confirm(`Deseja realmente excluir permanentemente o pedido #${String(id).padStart(4, '0')}? Esta ação não pode ser desfeita.`)) {
      return;
    }
    db.update((state) => {
      state.pedidos = state.pedidos.filter((p) => p.id !== id);
    });
    if (pedidoSelecionadoId === id) {
      setPedidoSelecionadoId(null);
    }
  };

  const handleExportarCsv = () => {
    const cabecalhos = [
      'ID Pedido',
      'Criado Em',
      'Tipo',
      'Cliente',
      'Canal',
      'Prazo',
      'Status',
      'Total (R$)',
      'Custo Extra (R$)',
      'Observações',
      'Itens',
    ];
    const linhas = pedidosFiltrados.map((p) => {
      const cli = p.cliente_id ? data.clientes.find((c) => c.id === p.cliente_id)?.nome : (p.tipo === 'estoque' ? 'Reposição Estoque' : 'Balcão');
      const canal = p.canal_id ? data.canais.find((c) => c.id === p.canal_id)?.nome : 'Balcão';
      const total = p.itens.reduce((acc, it) => acc + it.qtd * it.preco_unit, 0) - p.desconto + p.frete;
      const itensStr = p.itens.map((it) => `${it.qtd}x ${it.descricao}`).join(' | ');
      return [
        `#${String(p.id).padStart(4, '0')}`,
        p.criado_em.split('T')[0],
        p.tipo,
        cli || 'Balcão',
        canal || 'Balcão',
        p.prazo || '',
        p.status,
        total.toFixed(2),
        p.custo_extra.toFixed(2),
        p.observacoes || '',
        itensStr,
      ];
    });
    exportarTabelaParaCsv('pedidos-producao', cabecalhos, linhas);
  };

  const handleSalvarNovoPedido = (e: React.FormEvent) => {
    e.preventDefault();
    const itensValidos = novoItens.filter((it) => it.descricao.trim() || it.produtoId);
    if (itensValidos.length === 0) {
      alert('Adicione pelo menos um item.');
      return;
    }

    let novoId = 1;
    db.update((state) => {
      novoId = state.pedidos.length > 0 ? Math.max(...state.pedidos.map((p) => p.id)) + 1 : 1;
      const now = new Date().toISOString();

      state.pedidos.push({
        id: novoId,
        orcamento_id: null,
        cliente_id: novoTipo === 'cliente' && novoClienteId ? Number(novoClienteId) : null,
        canal_id: novoCanalId ? Number(novoCanalId) : null,
        tipo: novoTipo,
        status: 'aguardando',
        prazo: novoPrazo || null,
        observacoes: novoObs,
        desconto: 0,
        frete: 0,
        custo_extra: 0,
        do_estoque: false,
        criado_em: now,
        itens: itensValidos.map((it, idx) => ({
          id: idx + 1,
          pedido_id: novoId,
          produto_id: it.produtoId,
          descricao: it.descricao,
          personalizacao: '',
          qtd: it.qtd,
          preco_unit: it.precoUnit,
          custo_unit: 0,
          qtd_pronta: 0,
        })),
        historico: [{ id: 1, pedido_id: novoId, de: '', para: 'aguardando', em: now }],
      });
    });

    setModalNovoPedido(false);
    setPedidoSelecionadoId(novoId);
  };

  // Se visualizando os detalhes de um pedido específico
  if (pedidoDetalhe) {
    const cli = pedidoDetalhe.cliente_id ? data.clientes.find((c) => c.id === pedidoDetalhe.cliente_id) : null;
    const canal = pedidoDetalhe.canal_id ? data.canais.find((c) => c.id === pedidoDetalhe.canal_id) : null;
    const total = pedidoDetalhe.itens.reduce((acc, it) => acc + it.qtd * it.preco_unit, 0) - pedidoDetalhe.desconto + pedidoDetalhe.frete;
    const custo = pedidoDetalhe.itens.reduce((acc, it) => acc + it.qtd * it.custo_unit, 0) + pedidoDetalhe.custo_extra;
    const atrasado = pedidoDetalhe.prazo && pedidoDetalhe.prazo < hoje && !['entregue', 'cancelado'].includes(pedidoDetalhe.status);
    const plano = planoConsumo(pedidoDetalhe);

    const statusOrdem = pedidoDetalhe.tipo === 'estoque' ? ORDEM_STATUS.slice(0, 4) : ORDEM_STATUS;
    const idxAtual = statusOrdem.indexOf(pedidoDetalhe.status as any);
    const statusAnterior = idxAtual > 0 ? statusOrdem[idxAtual - 1] : null;
    const statusProximo = idxAtual >= 0 && idxAtual < statusOrdem.length - 1 ? statusOrdem[idxAtual + 1] : null;

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <button className="sec" onClick={() => setPedidoSelecionadoId(null)} style={{ marginRight: 8 }}>
              ← Voltar ao Kanban
            </button>
            <h2 style={{ display: 'inline', verticalAlign: 'middle' }}>
              Pedido #{String(pedidoDetalhe.id).padStart(4, '0')}
            </h2>
            <span className={`tag ${pedidoDetalhe.status}`} style={{ marginLeft: 8, textTransform: 'capitalize' }}>
              {pedidoDetalhe.status}
            </span>
            {pedidoDetalhe.tipo === 'estoque' && (
              <span className="tag" style={{ marginLeft: 6, background: 'var(--amber-tag)' }}>
                Reposição de Estoque
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {statusAnterior && (
              <button className="sec" onClick={() => handleMoverStatus(pedidoDetalhe, statusAnterior)}>
                ◀ Voltar para {statusAnterior}
              </button>
            )}
            {statusProximo && (
              <button onClick={() => handleMoverStatus(pedidoDetalhe, statusProximo)}>
                Avançar para {statusProximo} ▶
              </button>
            )}
            {['aguardando', 'imprimindo', 'acabamento'].includes(pedidoDetalhe.status) && (
              <button className="sec" onClick={() => setModalFalha(pedidoDetalhe)}>
                Registrar Falha
              </button>
            )}
            {!['entregue', 'cancelado'].includes(pedidoDetalhe.status) && (
              <button className="sec bad" onClick={() => handleMoverStatus(pedidoDetalhe, 'cancelado')}>
                Cancelar Pedido
              </button>
            )}
            <button className="sec bad" onClick={() => handleExcluirPedido(pedidoDetalhe.id)} title="Excluir pedido permanentemente">
              Excluir Pedido
            </button>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 16 }}>
          <div className="card">
            <h4 style={{ margin: '0 0 8px' }}>Dados do Pedido</h4>
            <p style={{ margin: '4px 0' }}>
              <b>Cliente:</b> {cli ? cli.nome : 'Estoque / Sem cliente'}
            </p>
            {cli?.telefone && (
              <p style={{ margin: '4px 0' }}>
                <b>Telefone:</b> {cli.telefone}
              </p>
            )}
            {canal && (
              <p style={{ margin: '4px 0' }}>
                <b>Canal de Venda:</b> {canal.nome}
              </p>
            )}
            <p style={{ margin: '4px 0' }}>
              <b>Prazo de Entrega:</b>{' '}
              <b className={atrasado ? 'bad' : ''}>
                {pedidoDetalhe.prazo ? new Date(pedidoDetalhe.prazo + 'T00:00:00').toLocaleDateString('pt-BR') : 'Não definido'}
              </b>
              {atrasado && <span className="badge" style={{ marginLeft: 6 }}>Atrasado</span>}
            </p>
            {pedidoDetalhe.observacoes && (
              <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 13 }}>
                <b>Obs:</b> {pedidoDetalhe.observacoes}
              </p>
            )}
          </div>

          <div className="card kpi">
            <small>Valor Total do Pedido</small>
            <h2>{formatBrl(total)}</h2>
            <small>
              Custo Estimado: <b>{formatBrl(custo)}</b> {pedidoDetalhe.custo_extra > 0 && `(inclui ${formatBrl(pedidoDetalhe.custo_extra)} de falhas)`}
            </small>
            <div style={{ marginTop: 8 }}>
              <span className="tag ok">Lucro Estimado: {formatBrl(total - custo)}</span>
            </div>
          </div>
        </div>

        {/* Itens e Consumo de Material */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <div className="card wrap">
            <h4 style={{ margin: '0 0 10px' }}>Itens a Produzir</h4>
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Personalização</th>
                  <th>Qtd</th>
                  <th>Preço Unit</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {pedidoDetalhe.itens.map((it) => (
                  <tr key={it.id}>
                    <td><b>{it.descricao}</b></td>
                    <td>{it.personalizacao || '-'}</td>
                    <td>{it.qtd}</td>
                    <td>{formatBrl(it.preco_unit)}</td>
                    <td><b>{formatBrl(it.qtd * it.preco_unit)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Histórico de Movimentações do Pedido */}
          <div className="card wrap">
            <h4 style={{ margin: '0 0 10px' }}>Histórico do Pedido</h4>
            <table>
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pedidoDetalhe.historico.map((h) => (
                  <tr key={h.id}>
                    <td>{new Date(h.em).toLocaleString('pt-BR')}</td>
                    <td>
                      {h.de ? `${h.de} → ` : 'Criado em: '}
                      <b>{h.para}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Visualização Kanban principal
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Kanban de Pedidos</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            style={{ width: 180 }}
          >
            <option value="">Todos os tipos</option>
            <option value="cliente">Pedidos de Cliente</option>
            <option value="estoque">Reposição de Estoque</option>
          </select>
          <button
            type="button"
            className="sec"
            onClick={handleExportarCsv}
            title="Exportar pedidos para arquivo CSV"
            disabled={pedidosFiltrados.length === 0}
          >
            📥 Exportar CSV
          </button>
          <button onClick={() => setModalNovoPedido(true)}>+ Novo Pedido Direto</button>
        </div>
      </div>

      {/* Grid do Kanban */}
      <div className="kanban">
        {COLUNAS_KANBAN.map((colunaKey) => {
          const itensColuna = pedidosFiltrados.filter((p) => p.status === colunaKey);
          return (
            <div key={colunaKey} className="col">
              <h4>
                {colunaKey} <span className="badge" style={{ background: 'var(--p)' }}>{itensColuna.length}</span>
              </h4>

              {itensColuna.length === 0 ? (
                <div style={{ padding: '16px 8px', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
                  Vazio
                </div>
              ) : (
                itensColuna.map((ped) => {
                  const cli = ped.cliente_id ? data.clientes.find((c) => c.id === ped.cliente_id) : null;
                  const total = ped.itens.reduce((acc, it) => acc + it.qtd * it.preco_unit, 0) - ped.desconto + ped.frete;
                  const atrasado = ped.prazo && ped.prazo < hoje && !['entregue', 'cancelado'].includes(ped.status);

                  const statusOrdem = ped.tipo === 'estoque' ? ORDEM_STATUS.slice(0, 4) : ORDEM_STATUS;
                  const idxAtual = statusOrdem.indexOf(ped.status as any);
                  const anterior = idxAtual > 0 ? statusOrdem[idxAtual - 1] : null;
                  const proximo = idxAtual >= 0 && idxAtual < statusOrdem.length - 1 ? statusOrdem[idxAtual + 1] : null;

                  return (
                    <div key={ped.id} className={`pc ${atrasado ? 'late' : ''}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <a
                          href={`#pedido-${ped.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            setPedidoSelecionadoId(ped.id);
                          }}
                          style={{ fontWeight: 700 }}
                        >
                          #{String(ped.id).padStart(4, '0')}
                        </a>
                        <b style={{ fontSize: 13 }}>{formatBrl(total)}</b>
                      </div>

                      <div style={{ margin: '4px 0', fontSize: 12 }}>
                        {ped.tipo === 'estoque' ? (
                          <span className="tag" style={{ background: 'var(--amber-tag)', fontSize: 11 }}>
                            Reposição Estoque
                          </span>
                        ) : (
                          <b>{cli ? cli.nome : 'Sem cliente'}</b>
                        )}
                      </div>

                      <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 6 }}>
                        {ped.itens.map((i) => `${i.qtd}x ${i.descricao}`).join(', ')}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                        <span className={atrasado ? 'bad' : 'muted'}>
                          📅 {ped.prazo ? new Date(ped.prazo + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                        </span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {anterior && (
                            <button
                              type="button"
                              className="sec"
                              style={{ padding: '2px 6px', fontSize: 11 }}
                              title={`Voltar para ${anterior}`}
                              onClick={() => handleMoverStatus(ped, anterior)}
                            >
                              ◀
                            </button>
                          )}
                          {proximo && (
                            <button
                              type="button"
                              style={{ padding: '2px 6px', fontSize: 11 }}
                              title={`Avançar para ${proximo}`}
                              onClick={() => handleMoverStatus(ped, proximo)}
                            >
                              ▶
                            </button>
                          )}
                          <button
                            type="button"
                            className="sec bad"
                            style={{ padding: '2px 6px', fontSize: 11 }}
                            title="Excluir este pedido"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExcluirPedido(ped.id);
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>

      {/* Modal de confirmação ao iniciar impressão */}
      {modalImprimir && (
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
          <div className="card" style={{ width: 520, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>Iniciar Impressão — Pedido #{String(modalImprimir.id).padStart(4, '0')}</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>
              Confirme os rolos de filamento e insumos que serão utilizados. Os valores abaixo serão abatidos do saldo em estoque.
            </p>

            {consumoRolos.length > 0 && (
              <div>
                <h4 style={{ margin: '10px 0 6px' }}>Filamentos Necessários</h4>
                {consumoRolos.map((cr, idx) => {
                  const rolo = data.rolos.find((r) => r.id === cr.roloId);
                  const mat = rolo ? data.materiais.find((m) => m.id === rolo.material_id) : null;
                  const sdRolos = saldos('rolo');
                  return (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <select
                        value={cr.roloId}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setConsumoRolos((prev) => {
                            const next = [...prev];
                            next[idx].roloId = val;
                            return next;
                          });
                        }}
                        style={{ flex: 1 }}
                      >
                        {data.rolos
                          .filter((r) => r.ativo)
                          .map((r) => {
                            const m = data.materiais.find((x) => x.id === r.material_id);
                            return (
                              <option key={r.id} value={r.id}>
                                Rolo #{r.id} {m ? `${m.tipo} ${m.cor}` : ''} ({sdRolos[r.id] || 0}g disp)
                              </option>
                            );
                          })}
                      </select>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="number"
                          value={cr.gramas}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setConsumoRolos((prev) => {
                              const next = [...prev];
                              next[idx].gramas = val;
                              return next;
                            });
                          }}
                          style={{ width: 90 }}
                        />
                        <span>g</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {consumoInsumos.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <h4 style={{ margin: '10px 0 6px' }}>Insumos da Receita</h4>
                {consumoInsumos.map((ci, idx) => {
                  const ins = data.insumos.find((i) => i.id === ci.insumoId);
                  return (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ flex: 1 }}>{ins?.nome}</span>
                      <input
                        type="number"
                        step="0.1"
                        value={ci.qtd}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setConsumoInsumos((prev) => {
                            const next = [...prev];
                            next[idx].qtd = val;
                            return next;
                          });
                        }}
                        style={{ width: 90 }}
                      />
                      <span>{ins?.unidade || 'un'}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button type="button" className="sec" onClick={() => setModalImprimir(null)}>
                Cancelar
              </button>
              <button type="button" onClick={handleConfirmarInicioImpressao}>
                Confirmar e Iniciar Impressão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Falha */}
      {modalFalha && (
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
          <div className="card" style={{ width: 440, maxWidth: '100%' }}>
            <h3>Registrar Falha — Pedido #{String(modalFalha.id).padStart(4, '0')}</h3>
            <form onSubmit={handleSalvarFalha}>
              <label>Rolo Utilizado na Falha *</label>
              <select
                value={falhaRoloId}
                onChange={(e) => setFalhaRoloId(Number(e.target.value))}
                required
              >
                {data.rolos.filter((r) => r.ativo).map((r) => {
                  const m = data.materiais.find((x) => x.id === r.material_id);
                  return (
                    <option key={r.id} value={r.id}>
                      Rolo #{r.id} {m ? `${m.tipo} ${m.cor}` : ''}
                    </option>
                  );
                })}
              </select>

              <label>Gramas Desperdiçadas (g) *</label>
              <input
                type="number"
                min="1"
                required
                value={falhaGramas}
                onChange={(e) => setFalhaGramas(Number(e.target.value))}
              />

              <label>Motivo da Falha</label>
              <input
                type="text"
                value={falhaObs}
                onChange={(e) => setFalhaObs(e.target.value)}
                placeholder="Ex: warping, entupimento, queda de energia..."
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" className="sec" onClick={() => setModalFalha(null)}>
                  Cancelar
                </button>
                <button type="submit" className="bad">
                  Lançar Falha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Novo Pedido Direto */}
      {modalNovoPedido && (
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
          <div className="card" style={{ width: 540, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>Novo Pedido de Produção</h3>
            <form onSubmit={handleSalvarNovoPedido}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label>Tipo do Pedido</label>
                  <select
                    value={novoTipo}
                    onChange={(e) => setNovoTipo(e.target.value as any)}
                  >
                    <option value="cliente">Para Cliente</option>
                    <option value="estoque">Reposição de Estoque</option>
                  </select>
                </div>

                <div>
                  <label>Prazo de Entrega</label>
                  <input type="date" value={novoPrazo} onChange={(e) => setNovoPrazo(e.target.value)} />
                </div>
              </div>

              {novoTipo === 'cliente' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                  <div>
                    <label>Cliente</label>
                    <select
                      value={novoClienteId}
                      onChange={(e) => setNovoClienteId(e.target.value ? Number(e.target.value) : '')}
                    >
                      <option value="">Selecione...</option>
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
                            setNovoCanalId(nextId);
                          });
                        }}
                      >
                        + Novo Canal
                      </button>
                    </div>
                    <select
                      value={novoCanalId}
                      onChange={(e) => setNovoCanalId(e.target.value ? Number(e.target.value) : '')}
                    >
                      <option value="">Balcão / Sem canal</option>
                      {data.canais.filter((c) => c.ativo).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome} {c.taxa_pct > 0 ? `(${c.taxa_pct}%)` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <h4 style={{ margin: '14px 0 6px' }}>Itens</h4>
              {novoItens.map((it, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <select
                    value={it.produtoId || ''}
                    onChange={(e) => {
                      const pid = e.target.value ? Number(e.target.value) : null;
                      const prod = pid ? data.produtos.find((p) => p.id === pid) : null;
                      setNovoItens((prev) => {
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
                    <option value="">Produto...</option>
                    {data.produtos.filter((p) => p.ativo).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    value={it.qtd}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setNovoItens((prev) => {
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
                      setNovoItens((prev) => {
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
                onClick={() => setNovoItens((prev) => [...prev, { produtoId: null, descricao: '', qtd: 1, precoUnit: 0 }])}
              >
                + Item
              </button>

              <label style={{ marginTop: 10 }}>Observações</label>
              <textarea rows={2} value={novoObs} onChange={(e) => setNovoObs(e.target.value)} />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" className="sec" onClick={() => setModalNovoPedido(false)}>
                  Cancelar
                </button>
                <button type="submit">Criar Pedido</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
