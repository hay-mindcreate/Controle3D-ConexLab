import React, { useState } from 'react';
import { formatBrl } from '../calc';
import { db } from '../db';
import { concluirTarefa, getDashboardData } from '../services';
import { NavTab } from './Navigation';

interface DashboardViewProps {
  onNavigate: (tab: NavTab, extra?: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const hoje = new Date().toISOString().split('T')[0];
  const data = getDashboardData(hoje);
  const dbData = db.get();
  const maoDeObraPct = dbData.config.mao_de_obra_lucro_pct ?? 15;
  const valorMaoDeObra = Math.max(0, data.lucro) * (maoDeObraPct / 100);

  const [novaTarefa, setNovaTarefa] = useState('');
  const [horaTarefa, setHoraTarefa] = useState('');
  const [recorrenciaTarefa, setRecorrenciaTarefa] = useState<'' | 'diaria' | 'semanal'>('');

  const handleAddTarefa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaTarefa.trim()) return;
    db.update((state) => {
      const nextId = state.tarefas.length > 0 ? Math.max(...state.tarefas.map((t) => t.id)) + 1 : 1;
      state.tarefas.push({
        id: nextId,
        titulo: novaTarefa.trim(),
        data: hoje,
        hora: horaTarefa,
        feita: false,
        recorrencia: recorrenciaTarefa,
      });
    });
    setNovaTarefa('');
    setHoraTarefa('');
    setRecorrenciaTarefa('');
  };

  const handleExcluirTarefa = (id: number) => {
    db.update((state) => {
      state.tarefas = state.tarefas.filter((t) => t.id !== id);
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Dashboard — {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onNavigate('orcamentos', { novo: true })}>+ Novo Orçamento</button>
          <button className="sec" onClick={() => onNavigate('calculadora')}>Calculadora 3D</button>
        </div>
      </div>

      {/* Alerta de estoque baixo */}
      {data.baixo.length > 0 && (
        <a
          className={`alerta ${data.baixo.some((a) => a.status === 'acabou') ? 'bad' : ''}`}
          href="#estoque"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('estoque', { aba: 'alertas' });
          }}
        >
          ⚠ <b>Estoque:</b>{' '}
          {data.baixo.filter((a) => a.status === 'acabou').length > 0 && (
            <b className="bad">{data.baixo.filter((a) => a.status === 'acabou').length} acabou</b>
          )}
          {data.baixo.filter((a) => a.status === 'acabou').length > 0 &&
            data.baixo.filter((a) => a.status === 'acabando').length > 0 && ' · '}
          {data.baixo.filter((a) => a.status === 'acabando').length > 0 && (
            <b className="warn">{data.baixo.filter((a) => a.status === 'acabando').length} acabando</b>
          )}{' '}
          — clique para ver itens críticos
        </a>
      )}

      {/* Grid de KPIs principais */}
      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <div className="card kpi">
          <small>Faturamento</small>
          <h2>{formatBrl(data.faturamento)}</h2>
          <small>{data.n} venda(s) no mês</small>
        </div>

        <div className="card kpi">
          <small>CMV (Produtos)</small>
          <h2>{formatBrl(data.cmv)}</h2>
          <small>Materiais + energia</small>
        </div>

        <div className="card kpi">
          <small>Taxas de Canais</small>
          <h2>{formatBrl(data.taxas)}</h2>
          <small>Shopee, ML, etc.</small>
        </div>

        <div className="card kpi">
          <small>Despesas Pagas</small>
          <h2>{formatBrl(data.despesas)}</h2>
          <small>Fixas e operacionais</small>
        </div>

        <div className="card kpi">
          <small>Custos Totais</small>
          <h2>{formatBrl(data.custos)}</h2>
          <small>CMV + despesas</small>
        </div>

        <div className="card kpi" style={{ borderLeft: '4px solid var(--ok)' }}>
          <small>Lucro Líquido</small>
          <h2 className={data.lucro >= 0 ? 'ok' : 'bad'}>{formatBrl(data.lucro)}</h2>
          <small>{data.faturamento > 0 ? `${((data.lucro / data.faturamento) * 100).toFixed(1)}% de margem` : 'Mês atual'}</small>
        </div>

        <div className="card kpi" style={{ borderLeft: '4px solid var(--p)' }}>
          <small style={{ color: 'var(--p)', fontWeight: 600 }}>Mão de Obra ({maoDeObraPct}% do Lucro)</small>
          <h2 style={{ color: 'var(--p)' }}>{formatBrl(valorMaoDeObra)}</h2>
          <small>{maoDeObraPct}% sobre o lucro líquido do mês</small>
        </div>
      </div>

      {/* Linha com 3 Cartões: Produção, Prazos e Tarefas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {/* Em produção & orçamentos abertos */}
        <div className="card box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: '0 0 10px' }}>⚙ Em Produção ({data.emProducao.length})</h3>
            <a
              href="#pedidos"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('pedidos');
              }}
              style={{ fontSize: 13 }}
            >
              Ver Kanban →
            </a>
          </div>

          {data.emProducao.length === 0 ? (
            <p className="muted">Nenhum pedido imprimindo ou em acabamento no momento.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ fontSize: 13, minWidth: 260 }}>
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th>Itens</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.emProducao.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <a
                          href={`#pedidos-${p.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            onNavigate('pedidos', { pedidoId: p.id });
                          }}
                        >
                          #{String(p.id).padStart(4, '0')}
                        </a>
                      </td>
                      <td>{p.tipo === 'estoque' ? <i>Reposição Estoque</i> : (db.get().clientes.find((c) => c.id === p.cliente_id)?.nome || '-')}</td>
                      <td>{p.itens.map((i) => `${i.qtd}x ${i.descricao}`).join(', ')}</td>
                      <td>
                        <span className="tag" style={{ textTransform: 'capitalize' }}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13 }}>
                📋 <b>{data.nAbertos}</b> orçamento(s) em aberto ({formatBrl(data.vAbertos)})
              </span>
              <a
                href="#orcamentos"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('orcamentos', { status: 'aberto' });
                }}
                style={{ fontSize: 12 }}
              >
                Gerenciar
              </a>
            </div>
          </div>
        </div>

        {/* Prazos & Entregas */}
        <div className="card box">
          <h3 style={{ margin: '0 0 10px' }}>📅 Entregas Próximas</h3>
          {data.prazos.length === 0 ? (
            <p className="muted">Nenhuma entrega agendada para os próximos 7 dias.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ fontSize: 13, minWidth: 260 }}>
                <thead>
                  <tr>
                    <th>Prazo</th>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.prazos.map((p) => {
                    const atrasado = p.prazo && p.prazo < hoje;
                    const total = p.itens.reduce((acc, it) => acc + it.qtd * it.preco_unit, 0) - p.desconto + p.frete;
                    return (
                      <tr key={p.id} className={atrasado ? 'row-bad' : ''}>
                        <td>
                          <b className={atrasado ? 'bad' : ''}>
                            {p.prazo ? new Date(p.prazo + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                          </b>
                          {atrasado && <span className="badge" style={{ background: 'var(--bad)', marginLeft: 4 }}>Atrasado</span>}
                        </td>
                        <td>
                          <a
                            href={`#pedidos-${p.id}`}
                            onClick={(e) => {
                              e.preventDefault();
                              onNavigate('pedidos', { pedidoId: p.id });
                            }}
                          >
                            #{String(p.id).padStart(4, '0')}
                          </a>
                        </td>
                        <td>{db.get().clientes.find((c) => c.id === p.cliente_id)?.nome || 'Estoque'}</td>
                        <td>{formatBrl(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {data.maisVendidos.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
              <small className="muted" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                🔥 MAIS VENDIDOS NO MÊS
              </small>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {data.maisVendidos.map((mv) => (
                  <span key={mv.nome} className="tag">
                    {mv.nome} <b>({mv.qtd} un)</b>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tarefas e Lembretes */}
        <div className="card box">
          <h3 style={{ margin: '0 0 10px' }}>✓ Tarefas da Oficina</h3>

          <form onSubmit={handleAddTarefa} style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <input
              type="text"
              placeholder="Nova tarefa..."
              value={novaTarefa}
              onChange={(e) => setNovaTarefa(e.target.value)}
              style={{ flex: 1 }}
            />
            <input
              type="time"
              value={horaTarefa}
              onChange={(e) => setHoraTarefa(e.target.value)}
              style={{ width: 85 }}
            />
            <select
              value={recorrenciaTarefa}
              onChange={(e) => setRecorrenciaTarefa(e.target.value as any)}
              style={{ width: 95 }}
            >
              <option value="">Uma vez</option>
              <option value="diaria">Diária</option>
              <option value="semanal">Semanal</option>
            </select>
            <button type="submit" style={{ padding: '6px 12px' }}>
              +
            </button>
          </form>

          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {data.tarefasAtrasadas.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <small className="bad" style={{ fontWeight: 600 }}>
                  ATRASADAS
                </small>
                {data.tarefasAtrasadas.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 0',
                      borderBottom: '1px solid var(--line)',
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={t.feita}
                        onChange={() => concluirTarefa(t.id)}
                        style={{ width: 'auto' }}
                      />
                      <span className="bad">{t.titulo}</span>
                      <small className="muted">({new Date(t.data + 'T00:00:00').toLocaleDateString('pt-BR')})</small>
                    </label>
                    <button className="lnk" onClick={() => handleExcluirTarefa(t.id)} style={{ color: 'var(--muted)', fontSize: 12 }}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div>
              <small className="muted" style={{ fontWeight: 600 }}>
                HOJE ({data.tarefasHoje.length})
              </small>
              {data.tarefasHoje.length === 0 ? (
                <p className="muted" style={{ fontSize: 13, margin: '4px 0' }}>
                  Nenhuma tarefa pendente para hoje.
                </p>
              ) : (
                data.tarefasHoje.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 0',
                      borderBottom: '1px solid var(--line)',
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={t.feita}
                        onChange={() => concluirTarefa(t.id)}
                        style={{ width: 'auto' }}
                      />
                      <span style={{ textDecoration: t.feita ? 'line-through' : 'none', color: t.feita ? 'var(--muted)' : undefined }}>
                        {t.hora && <small className="muted">[{t.hora}] </small>}
                        {t.titulo}
                        {t.recorrencia && <small className="muted"> 🔁 {t.recorrencia}</small>}
                      </span>
                    </label>
                    <button className="lnk" onClick={() => handleExcluirTarefa(t.id)} style={{ color: 'var(--muted)', fontSize: 12 }}>
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
