import React, { useState } from 'react';
import { formatBrl } from '../calc';
import { db } from '../db';
import { addMonths, pagarLancamento } from '../services';
import { Lancamento } from '../types';
import { NavTab } from './Navigation';

interface FinanceiroViewProps {
  onNavigate: (tab: NavTab, extra?: any) => void;
}

export const FinanceiroView: React.FC<FinanceiroViewProps> = ({ onNavigate }) => {
  const data = db.get();
  const hoje = new Date().toISOString().split('T')[0];
  const mesAtual = hoje.slice(0, 7);

  const [mesSelecionado, setMesSelecionado] = useState<string>(mesAtual);
  const [modalNovo, setModalNovo] = useState(false);

  // Form State
  const [formTipo, setFormTipo] = useState<'receita' | 'despesa'>('despesa');
  const [formCategoria, setFormCategoria] = useState('Material');
  const [formNatureza, setFormNatureza] = useState<'fixa' | 'variavel'>('variavel');
  const [formDescricao, setFormDescricao] = useState('');
  const [formValor, setFormValor] = useState<number>(0);
  const [formVencimento, setFormVencimento] = useState(hoje);
  const [formPago, setFormPago] = useState(false);
  const [formRecorrencia, setFormRecorrencia] = useState<'' | 'mensal'>('');

  const iniMes = `${mesSelecionado}-01`;
  const fimMes = addMonths(iniMes, 1);

  const lancamentosMes = data.lancamentos.filter(
    (l) => !l.cancelado && l.vencimento >= iniMes && l.vencimento < fimMes
  );

  const recPagas = lancamentosMes
    .filter((l) => l.tipo === 'receita' && l.pago_em)
    .reduce((acc, l) => acc + l.valor, 0);

  const despPagas = lancamentosMes
    .filter((l) => l.tipo === 'despesa' && l.pago_em)
    .reduce((acc, l) => acc + l.valor, 0);

  const recAbertas = lancamentosMes
    .filter((l) => l.tipo === 'receita' && !l.pago_em)
    .reduce((acc, l) => acc + l.valor, 0);

  const despAbertas = lancamentosMes
    .filter((l) => l.tipo === 'despesa' && !l.pago_em)
    .reduce((acc, l) => acc + l.valor, 0);

  const despesasFixas = lancamentosMes
    .filter((l) => l.tipo === 'despesa' && l.natureza === 'fixa')
    .reduce((acc, l) => acc + l.valor, 0);

  const despesasVariaveis = lancamentosMes
    .filter((l) => l.tipo === 'despesa' && l.natureza === 'variavel')
    .reduce((acc, l) => acc + l.valor, 0);

  // Histórico dos últimos 6 meses para o gráfico
  const ultimos6Meses: Array<{ mes: string; receita: number; despesa: number }> = [];
  for (let k = 5; k >= 0; k--) {
    const dIni = addMonths(iniMes, -k);
    const dFim = addMonths(dIni, 1);
    const r = data.lancamentos
      .filter((l) => !l.cancelado && l.tipo === 'receita' && l.pago_em && l.pago_em >= dIni && l.pago_em < dFim)
      .reduce((acc, l) => acc + l.valor, 0);
    const d = data.lancamentos
      .filter((l) => !l.cancelado && l.tipo === 'despesa' && l.pago_em && l.pago_em >= dIni && l.pago_em < dFim)
      .reduce((acc, l) => acc + l.valor, 0);

    const [ano, mes] = dIni.split('-');
    ultimos6Meses.push({ mes: `${mes}/${ano.slice(2)}`, receita: r, despesa: d });
  }

  const topoGrafico = Math.max(
    ...ultimos6Meses.map((m) => Math.max(m.receita, m.despesa)),
    100
  );

  const handleSalvarLancamento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDescricao.trim() || formValor <= 0) return;

    db.update((state) => {
      const nextId = state.lancamentos.length > 0 ? Math.max(...state.lancamentos.map((l) => l.id)) + 1 : 1;
      state.lancamentos.push({
        id: nextId,
        tipo: formTipo,
        categoria: formCategoria.trim(),
        natureza: formNatureza,
        descricao: formDescricao.trim(),
        valor: Number(formValor),
        vencimento: formVencimento,
        pago_em: formPago ? formVencimento : null,
        venda_id: null,
        recorrencia: formRecorrencia,
        gerou_proximo: false,
        cancelado: false,
      });
    });

    setModalNovo(false);
    setFormDescricao('');
    setFormValor(0);
  };

  const handleDesfazerPagamento = (id: number) => {
    db.update((state) => {
      const l = state.lancamentos.find((x) => x.id === id);
      if (l && !l.venda_id) l.pago_em = null;
    });
  };

  const handleCancelarLancamento = (id: number) => {
    if (!confirm('Deseja cancelar este lançamento?')) return;
    db.update((state) => {
      const l = state.lancamentos.find((x) => x.id === id);
      if (l && !l.venda_id) l.cancelado = true;
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Controle Financeiro</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setModalNovo(true)}>+ Novo Lançamento</button>
        </div>
      </div>

      {/* Navegação de Mês */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button
          className="sec"
          style={{ padding: '4px 10px' }}
          onClick={() => {
            const ant = addMonths(iniMes, -1);
            setMesSelecionado(ant.slice(0, 7));
          }}
        >
          ◀ Mês Anterior
        </button>

        <input
          type="month"
          value={mesSelecionado}
          onChange={(e) => setMesSelecionado(e.target.value)}
          style={{ width: 170 }}
        />

        <button
          className="sec"
          style={{ padding: '4px 10px' }}
          onClick={() => {
            const prox = addMonths(iniMes, 1);
            setMesSelecionado(prox.slice(0, 7));
          }}
        >
          Próximo Mês ▶
        </button>

        {mesSelecionado !== mesAtual && (
          <button
            className="sec"
            style={{ padding: '4px 10px' }}
            onClick={() => setMesSelecionado(mesAtual)}
          >
            Mês Atual
          </button>
        )}
      </div>

      {/* KPIs Financeiros */}
      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <div className="card kpi">
          <small>Receitas Pagas</small>
          <h2 className="ok">{formatBrl(recPagas)}</h2>
          <small>A receber: {formatBrl(recAbertas)}</small>
        </div>

        <div className="card kpi">
          <small>Despesas Pagas</small>
          <h2 className="bad">{formatBrl(despPagas)}</h2>
          <small>A pagar: {formatBrl(despAbertas)}</small>
        </div>

        <div className="card kpi" style={{ borderLeft: '4px solid var(--p)' }}>
          <small>Saldo Realizado</small>
          <h2 className={recPagas - despPagas >= 0 ? 'ok' : 'bad'}>{formatBrl(recPagas - despPagas)}</h2>
          <small>Entradas − Saídas</small>
        </div>

        <div className="card kpi">
          <small>Despesas Fixas</small>
          <h2>{formatBrl(despesasFixas)}</h2>
          <small>Aluguel, softwares, etc.</small>
        </div>

        <div className="card kpi">
          <small>Despesas Variáveis</small>
          <h2>{formatBrl(despesasVariaveis)}</h2>
          <small>Filamentos, peças, etc.</small>
        </div>
      </div>

      {/* Gráfico de barras simples dos últimos 6 meses */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 12px' }}>Fluxo de Caixa (Últimos 6 Meses)</h4>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, height: 140, padding: '10px 0' }}>
          {ultimos6Meses.map((m, idx) => {
            const hRec = Math.max(4, (m.receita / topoGrafico) * 110);
            const hDesp = Math.max(4, (m.despesa / topoGrafico) * 110);
            return (
              <div key={idx} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 4, height: 110 }}>
                  <div
                    style={{
                      width: 16,
                      height: `${hRec}px`,
                      background: 'var(--ok)',
                      borderRadius: '3px 3px 0 0',
                    }}
                    title={`Receita: ${formatBrl(m.receita)}`}
                  />
                  <div
                    style={{
                      width: 16,
                      height: `${hDesp}px`,
                      background: 'var(--bad)',
                      borderRadius: '3px 3px 0 0',
                    }}
                    title={`Despesa: ${formatBrl(m.despesa)}`}
                  />
                </div>
                <div style={{ fontSize: 11, marginTop: 6, color: 'var(--muted)' }}>{m.mes}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, fontSize: 12, marginTop: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, background: 'var(--ok)', borderRadius: 2 }} /> Receitas
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, background: 'var(--bad)', borderRadius: 2 }} /> Despesas
          </span>
        </div>
      </div>

      {/* Tabela de Lançamentos do Mês */}
      <div className="card wrap">
        <h4 style={{ margin: '0 0 10px' }}>Lançamentos de {mesSelecionado}</h4>
        {lancamentosMes.length === 0 ? (
          <p className="muted" style={{ padding: 8 }}>
            Nenhum lançamento para este mês.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Vencimento</th>
                <th>Tipo</th>
                <th>Categoria</th>
                <th>Natureza</th>
                <th>Descrição</th>
                <th>Valor</th>
                <th>Situação</th>
                <th className="r">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lancamentosMes.map((l) => {
                const pago = Boolean(l.pago_em);
                return (
                  <tr key={l.id}>
                    <td>{new Date(l.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                    <td>
                      <span className={`tag ${l.tipo === 'receita' ? 'ativa' : 'recusado'}`}>{l.tipo}</span>
                    </td>
                    <td>{l.categoria || '-'}</td>
                    <td><small>{l.natureza}</small></td>
                    <td>
                      <b>{l.descricao}</b>
                      {l.recorrencia && <small className="muted"> 🔁 mensal</small>}
                    </td>
                    <td>
                      <b className={l.tipo === 'receita' ? 'ok' : 'bad'}>
                        {l.tipo === 'receita' ? '+' : '-'} {formatBrl(l.valor)}
                      </b>
                    </td>
                    <td>
                      {pago ? (
                        <span className="tag ok">Pago em {new Date(l.pago_em! + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                      ) : (
                        <span className="tag warn">Em aberto</span>
                      )}
                    </td>
                    <td className="r">
                      {!pago ? (
                        <button
                          style={{ padding: '3px 8px', fontSize: 13 }}
                          onClick={() => pagarLancamento(l.id, hoje)}
                        >
                          Marcar Pago
                        </button>
                      ) : (
                        !l.venda_id && (
                          <button
                            className="sec"
                            style={{ padding: '3px 8px', fontSize: 13 }}
                            onClick={() => handleDesfazerPagamento(l.id)}
                          >
                            Desfazer
                          </button>
                        )
                      )}
                      {!l.venda_id && !pago && (
                        <button
                          className="sec bad"
                          style={{ padding: '3px 8px', fontSize: 13, marginLeft: 4 }}
                          onClick={() => handleCancelarLancamento(l.id)}
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de Novo Lançamento */}
      {modalNovo && (
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
          <div className="card" style={{ width: 480, maxWidth: '100%' }}>
            <h3>Novo Lançamento Financeiro</h3>
            <form onSubmit={handleSalvarLancamento}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label>Tipo</label>
                  <select value={formTipo} onChange={(e) => setFormTipo(e.target.value as any)}>
                    <option value="despesa">Despesa (Saída)</option>
                    <option value="receita">Receita (Entrada)</option>
                  </select>
                </div>

                <div>
                  <label>Natureza</label>
                  <select value={formNatureza} onChange={(e) => setFormNatureza(e.target.value as any)}>
                    <option value="variavel">Variável (Materiais, Fretes)</option>
                    <option value="fixa">Fixa (Aluguel, Luz, Internet)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label>Categoria</label>
                  <input
                    type="text"
                    value={formCategoria}
                    onChange={(e) => setFormCategoria(e.target.value)}
                    placeholder="Material, Energia, Software..."
                  />
                </div>
                <div>
                  <label>Valor (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formValor}
                    onChange={(e) => setFormValor(Number(e.target.value))}
                  />
                </div>
              </div>

              <label>Descrição *</label>
              <input
                type="text"
                required
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                placeholder="Ex: Conta de luz da oficina"
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label>Data de Vencimento</label>
                  <input
                    type="date"
                    required
                    value={formVencimento}
                    onChange={(e) => setFormVencimento(e.target.value)}
                  />
                </div>
                <div>
                  <label>Recorrência</label>
                  <select
                    value={formRecorrencia}
                    onChange={(e) => setFormRecorrencia(e.target.value as any)}
                  >
                    <option value="">Apenas uma vez</option>
                    <option value="mensal">Mensal (repete todo mês)</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formPago}
                    onChange={(e) => setFormPago(e.target.checked)}
                    style={{ width: 'auto' }}
                  />
                  <span>Já foi pago na data de vencimento</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" className="sec" onClick={() => setModalNovo(false)}>
                  Cancelar
                </button>
                <button type="submit">Salvar Lançamento</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
