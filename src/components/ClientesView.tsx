import React, { useState } from 'react';
import { formatBrl } from '../calc';
import { db } from '../db';
import { Cliente, Orcamento, Pedido, Venda } from '../types';
import { NavTab } from './Navigation';

interface ClientesViewProps {
  onNavigate: (tab: NavTab, extra?: any) => void;
  clienteId?: number | null;
}

export const ClientesView: React.FC<ClientesViewProps> = ({ onNavigate, clienteId }) => {
  const [busca, setBusca] = useState('');
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<number | null>(clienteId || null);
  const [modalNovo, setModalNovo] = useState(false);
  const [clienteEdicao, setClienteEdicao] = useState<Partial<Cliente> | null>(null);

  const data = db.get();
  const clientesAtivos = data.clientes.filter((c) => c.ativo);

  const filtrados = clientesAtivos.filter((c) => {
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    return (
      c.nome.toLowerCase().includes(q) ||
      c.telefone.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.documento.toLowerCase().includes(q)
    );
  });

  const clienteAtual = clienteSelecionadoId ? data.clientes.find((c) => c.id === clienteSelecionadoId) : null;

  const vendasCliente = clienteAtual
    ? data.vendas.filter((v) => v.cliente_id === clienteAtual.id && v.status === 'ativa')
    : [];
  const orcamentosCliente = clienteAtual
    ? data.orcamentos.filter((o) => o.cliente_id === clienteAtual.id)
    : [];
  const pedidosCliente = clienteAtual
    ? data.pedidos.filter((p) => p.cliente_id === clienteAtual.id)
    : [];
  const totalComprado = vendasCliente.reduce((acc, v) => acc + v.total, 0);

  const handleSalvarCliente = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteEdicao || !clienteEdicao.nome) return;
    const nome = clienteEdicao.nome.trim();
    if (!nome) return;

    db.update((state) => {
      if (clienteEdicao.id) {
        const c = state.clientes.find((x) => x.id === clienteEdicao.id);
        if (c) {
          Object.assign(c, clienteEdicao, { nome });
        }
      } else {
        const nextId = state.clientes.length > 0 ? Math.max(...state.clientes.map((x) => x.id)) + 1 : 1;
        state.clientes.push({
          id: nextId,
          nome,
          telefone: clienteEdicao.telefone?.trim() || '',
          email: clienteEdicao.email?.trim() || '',
          documento: clienteEdicao.documento?.trim() || '',
          endereco: clienteEdicao.endereco?.trim() || '',
          observacoes: clienteEdicao.observacoes?.trim() || '',
          ativo: true,
        });
        setClienteSelecionadoId(nextId);
      }
    });

    setModalNovo(false);
    setClienteEdicao(null);
  };

  const handleArquivar = (id: number) => {
    if (!confirm('Deseja arquivar este cliente?')) return;
    db.update((state) => {
      const c = state.clientes.find((x) => x.id === id);
      if (c) c.ativo = false;
    });
    setClienteSelecionadoId(null);
  };

  // Se visualizando ficha detalhada
  if (clienteAtual) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <button className="sec" onClick={() => setClienteSelecionadoId(null)} style={{ marginRight: 10 }}>
              ← Voltar aos Clientes
            </button>
            <h2 style={{ display: 'inline', verticalAlign: 'middle' }}>{clienteAtual.nome}</h2>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {clienteAtual.telefone && (
              <a
                className="btn sec"
                href={`https://wa.me/55${clienteAtual.telefone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
              >
                💬 WhatsApp
              </a>
            )}
            <button
              className="sec"
              onClick={() => {
                setClienteEdicao(clienteAtual);
                setModalNovo(true);
              }}
            >
              Editar Ficha
            </button>
            <button className="sec bad" onClick={() => handleArquivar(clienteAtual.id)}>
              Arquivar
            </button>
          </div>
        </div>

        {/* Informações de contato e resumo */}
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 16 }}>
          <div className="card">
            <h4 style={{ margin: '0 0 8px' }}>Dados de Contato</h4>
            <p style={{ margin: '4px 0' }}>
              <b>Telefone:</b> {clienteAtual.telefone || 'Não informado'}
            </p>
            <p style={{ margin: '4px 0' }}>
              <b>E-mail:</b> {clienteAtual.email || 'Não informado'}
            </p>
            <p style={{ margin: '4px 0' }}>
              <b>CPF / CNPJ:</b> {clienteAtual.documento || 'Não informado'}
            </p>
            <p style={{ margin: '4px 0' }}>
              <b>Endereço:</b> {clienteAtual.endereco || 'Não informado'}
            </p>
            {clienteAtual.observacoes && (
              <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: 13, borderTop: '1px solid var(--line)', paddingTop: 6 }}>
                <b>Obs:</b> {clienteAtual.observacoes}
              </p>
            )}
          </div>

          <div className="card kpi" style={{ borderLeft: '4px solid var(--p)' }}>
            <small>Total Comprado (Vendas Ativas)</small>
            <h2>{formatBrl(totalComprado)}</h2>
            <small>
              {vendasCliente.length} venda(s) realizada(s) · {pedidosCliente.length} pedido(s)
            </small>
            <div style={{ marginTop: 12 }}>
              <button onClick={() => onNavigate('orcamentos', { novoParaClienteId: clienteAtual.id })}>
                + Novo Orçamento para {clienteAtual.nome.split(' ')[0]}
              </button>
            </div>
          </div>
        </div>

        {/* Abas de histórico do cliente */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {/* Pedidos */}
          <div className="card wrap">
            <h4 style={{ margin: '0 0 10px' }}>Pedidos de Produção ({pedidosCliente.length})</h4>
            {pedidosCliente.length === 0 ? (
              <p className="muted">Nenhum pedido registrado.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Status</th>
                    <th>Prazo</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosCliente.map((p) => {
                    const total = p.itens.reduce((acc, it) => acc + it.qtd * it.preco_unit, 0) - p.desconto + p.frete;
                    return (
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
                        <td>
                          <span className={`tag ${p.status}`}>{p.status}</span>
                        </td>
                        <td>{p.prazo ? new Date(p.prazo + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                        <td>{formatBrl(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Orçamentos */}
          <div className="card wrap">
            <h4 style={{ margin: '0 0 10px' }}>Orçamentos ({orcamentosCliente.length})</h4>
            {orcamentosCliente.length === 0 ? (
              <p className="muted">Nenhum orçamento emitido.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Data</th>
                    <th>Status</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orcamentosCliente.map((o) => {
                    const total = o.itens.reduce((acc, it) => acc + it.qtd * it.preco_unit, 0) - o.desconto + o.frete;
                    return (
                      <tr key={o.id}>
                        <td>
                          <a
                            href={`#orcamentos-${o.id}`}
                            onClick={(e) => {
                              e.preventDefault();
                              onNavigate('orcamentos', { orcamentoId: o.id });
                            }}
                          >
                            #{String(o.id).padStart(4, '0')}
                          </a>
                        </td>
                        <td>{new Date(o.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                        <td>
                          <span className={`tag ${o.status}`}>{o.status}</span>
                        </td>
                        <td>{formatBrl(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Lista geral de clientes
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Clientes ({clientesAtivos.length})</h2>
        <button
          onClick={() => {
            setClienteEdicao({ nome: '', telefone: '', email: '', documento: '', endereco: '', observacoes: '' });
            setModalNovo(true);
          }}
        >
          + Novo Cliente
        </button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <input
          type="text"
          placeholder="Buscar por nome, telefone, e-mail ou documento..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <div className="card wrap">
        {filtrados.length === 0 ? (
          <p className="muted" style={{ padding: 12 }}>
            Nenhum cliente encontrado.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Telefone</th>
                <th>E-mail</th>
                <th>Endereço</th>
                <th>Total Comprado</th>
                <th className="r">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => {
                const compras = data.vendas
                  .filter((v) => v.cliente_id === c.id && v.status === 'ativa')
                  .reduce((acc, v) => acc + v.total, 0);
                return (
                  <tr key={c.id}>
                    <td>
                      <a
                        href={`#cliente-${c.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          setClienteSelecionadoId(c.id);
                        }}
                        style={{ fontWeight: 600 }}
                      >
                        {c.nome}
                      </a>
                    </td>
                    <td>{c.telefone || '-'}</td>
                    <td>{c.email || '-'}</td>
                    <td>{c.endereco || '-'}</td>
                    <td>
                      <b>{formatBrl(compras)}</b>
                    </td>
                    <td className="r">
                      <button
                        className="sec"
                        style={{ padding: '3px 8px', fontSize: 13, marginRight: 6 }}
                        onClick={() => setClienteSelecionadoId(c.id)}
                      >
                        Ficha
                      </button>
                      <button
                        className="sec"
                        style={{ padding: '3px 8px', fontSize: 13 }}
                        onClick={() => {
                          setClienteEdicao(c);
                          setModalNovo(true);
                        }}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de cadastro/edição */}
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
          <div className="card" style={{ width: 500, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>{clienteEdicao?.id ? 'Editar Cliente' : 'Novo Cliente'}</h3>
            <form onSubmit={handleSalvarCliente}>
              <label>Nome Completo *</label>
              <input
                type="text"
                required
                value={clienteEdicao?.nome || ''}
                onChange={(e) => setClienteEdicao((prev) => ({ ...prev, nome: e.target.value }))}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label>Telefone / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="(00) 00000-0000"
                    value={clienteEdicao?.telefone || ''}
                    onChange={(e) => setClienteEdicao((prev) => ({ ...prev, telefone: e.target.value }))}
                  />
                </div>
                <div>
                  <label>E-mail</label>
                  <input
                    type="email"
                    value={clienteEdicao?.email || ''}
                    onChange={(e) => setClienteEdicao((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label>CPF / CNPJ</label>
                  <input
                    type="text"
                    value={clienteEdicao?.documento || ''}
                    onChange={(e) => setClienteEdicao((prev) => ({ ...prev, documento: e.target.value }))}
                  />
                </div>
                <div>
                  <label>Endereço / Cidade</label>
                  <input
                    type="text"
                    value={clienteEdicao?.endereco || ''}
                    onChange={(e) => setClienteEdicao((prev) => ({ ...prev, endereco: e.target.value }))}
                  />
                </div>
              </div>

              <label>Observações</label>
              <textarea
                rows={3}
                value={clienteEdicao?.observacoes || ''}
                onChange={(e) => setClienteEdicao((prev) => ({ ...prev, observacoes: e.target.value }))}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button
                  type="button"
                  className="sec"
                  onClick={() => {
                    setModalNovo(false);
                    setClienteEdicao(null);
                  }}
                >
                  Cancelar
                </button>
                <button type="submit">Salvar Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
