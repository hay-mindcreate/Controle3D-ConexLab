import React, { useState } from 'react';
import { formatBrl, round2 } from '../calc';
import { db, EMPRESA } from '../db';
import { exportarTabelaParaCsv } from '../importExport';
import { criarPedidoDeOrcamento } from '../services';
import { ItemOrcamento, Orcamento } from '../types';
import { NavTab } from './Navigation';

interface OrcamentosViewProps {
  onNavigate: (tab: NavTab, extra?: any) => void;
  orcamentoId?: number | null;
  novo?: boolean;
  novoParaClienteId?: number | null;
}

export const OrcamentosView: React.FC<OrcamentosViewProps> = ({
  onNavigate,
  orcamentoId,
  novo,
  novoParaClienteId,
}) => {
  const data = db.get();
  const hoje = new Date().toISOString().split('T')[0];

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('');
  const [orcamentoSelecionadoId, setOrcamentoSelecionadoId] = useState<number | null>(orcamentoId || null);
  const [modoEdicao, setModoEdicao] = useState<boolean>(Boolean(novo || novoParaClienteId));

  // Form State
  const [formId, setFormId] = useState<number | null>(null);
  const [formClienteId, setFormClienteId] = useState<number>(novoParaClienteId || (data.clientes[0]?.id || 0));
  const [formCanalId, setFormCanalId] = useState<number | ''>(data.canais[0]?.id || '');
  const [formData, setFormData] = useState<string>(hoje);
  const [formValidadeDias, setFormValidadeDias] = useState<number>(7);
  const [formPrazo, setFormPrazo] = useState<string>('5 dias úteis após a confirmação');
  const [formPagamento, setFormPagamento] = useState<string>('50% de entrada e 50% na entrega (PIX)');
  const [formDesconto, setFormDesconto] = useState<number>(0);
  const [formFrete, setFormFrete] = useState<number>(0);
  const [formObs, setFormObs] = useState<string>('');
  const [formItens, setFormItens] = useState<Array<Partial<ItemOrcamento>>>([
    { produto_id: null, descricao: '', personalizacao: '', qtd: 1, preco_unit: 0, custo_unit: 0 },
  ]);

  // Modal Aprovar Pedido
  const [modalAprovar, setModalAprovar] = useState<Orcamento | null>(null);
  const [prazoPedido, setPrazoPedido] = useState<string>(hoje);
  const [doEstoque, setDoEstoque] = useState<boolean>(false);

  const orcamentosComCalculos = data.orcamentos.map((o) => {
    const subtotal = o.itens.reduce((acc, it) => acc + it.qtd * it.preco_unit, 0);
    const total = subtotal - o.desconto + o.frete;

    const dataObj = new Date(o.data + 'T00:00:00');
    dataObj.setDate(dataObj.getDate() + o.validade_dias);
    const validoAte = dataObj.toISOString().split('T')[0];
    const expirado = o.status === 'aberto' && validoAte < hoje;
    const statusExib = expirado ? 'expirado' : o.status;

    return { ...o, subtotal, total, validoAte, statusExib };
  });

  const filtrados = orcamentosComCalculos.filter((o) => {
    const cli = data.clientes.find((c) => c.id === o.cliente_id);
    const nomeCliente = cli ? cli.nome.toLowerCase() : '';
    const matchBusca = !busca.trim() || nomeCliente.includes(busca.toLowerCase()) || String(o.id).includes(busca);
    const matchStatus = !filtroStatus || o.statusExib === filtroStatus;
    return matchBusca && matchStatus;
  });

  const orcamentoAtual = orcamentoSelecionadoId
    ? orcamentosComCalculos.find((o) => o.id === orcamentoSelecionadoId)
    : null;

  const handleIniciarNovo = () => {
    setFormId(null);
    setFormClienteId(data.clientes[0]?.id || 0);
    setFormCanalId(data.canais[0]?.id || '');
    setFormData(hoje);
    setFormValidadeDias(7);
    setFormPrazo('5 dias úteis após a confirmação');
    setFormPagamento('50% de entrada e 50% na entrega (PIX)');
    setFormDesconto(0);
    setFormFrete(0);
    setFormObs('');
    setFormItens([{ produto_id: null, descricao: '', personalizacao: '', qtd: 1, preco_unit: 0, custo_unit: 0 }]);
    setModoEdicao(true);
    setOrcamentoSelecionadoId(null);
  };

  const handleEditarExistente = (orc: Orcamento) => {
    setFormId(orc.id);
    setFormClienteId(orc.cliente_id);
    setFormCanalId(orc.canal_id || '');
    setFormData(orc.data);
    setFormValidadeDias(orc.validade_dias);
    setFormPrazo(orc.prazo);
    setFormPagamento(orc.pagamento);
    setFormDesconto(orc.desconto);
    setFormFrete(orc.frete);
    setFormObs(orc.observacoes);
    setFormItens(
      orc.itens.map((it) => ({
        id: it.id,
        produto_id: it.produto_id,
        descricao: it.descricao,
        personalizacao: it.personalizacao,
        qtd: it.qtd,
        preco_unit: it.preco_unit,
        custo_unit: it.custo_unit,
      }))
    );
    setModoEdicao(true);
  };

  const handleSelectProduto = (idx: number, produtoIdStr: string) => {
    const pid = produtoIdStr ? Number(produtoIdStr) : null;
    const prod = pid ? data.produtos.find((p) => p.id === pid) : null;
    setFormItens((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        produto_id: pid,
        descricao: prod ? prod.nome : next[idx].descricao,
        preco_unit: prod ? prod.preco : (next[idx].preco_unit || 0),
      };
      return next;
    });
  };

  const handleAddItem = () => {
    setFormItens((prev) => [
      ...prev,
      { produto_id: null, descricao: '', personalizacao: '', qtd: 1, preco_unit: 0, custo_unit: 0 },
    ]);
  };

  const handleRemoveItem = (idx: number) => {
    setFormItens((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSalvarOrcamento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClienteId) {
      alert('Selecione um cliente.');
      return;
    }

    const itensValidos: ItemOrcamento[] = formItens
      .filter((it) => (it.descricao && it.descricao.trim()) || it.produto_id)
      .map((it, idx) => ({
        id: idx + 1,
        orcamento_id: formId || 0,
        produto_id: it.produto_id || null,
        descricao: it.descricao || '',
        personalizacao: it.personalizacao || '',
        qtd: Math.max(Number(it.qtd || 1), 1),
        preco_unit: Number(it.preco_unit || 0),
        custo_unit: Number(it.custo_unit || 0),
      }));

    if (itensValidos.length === 0) {
      alert('Adicione pelo menos um item ao orçamento.');
      return;
    }

    let savedId = formId;
    db.update((state) => {
      if (formId) {
        const o = state.orcamentos.find((x) => x.id === formId);
        if (o) {
          o.cliente_id = formClienteId;
          o.canal_id = formCanalId ? Number(formCanalId) : null;
          o.data = formData;
          o.validade_dias = Number(formValidadeDias);
          o.desconto = Number(formDesconto || 0);
          o.frete = Number(formFrete || 0);
          o.prazo = formPrazo;
          o.pagamento = formPagamento;
          o.observacoes = formObs;
          o.itens = itensValidos;
        }
      } else {
        savedId = state.orcamentos.length > 0 ? Math.max(...state.orcamentos.map((x) => x.id)) + 1 : 1;
        state.orcamentos.unshift({
          id: savedId,
          cliente_id: formClienteId,
          canal_id: formCanalId ? Number(formCanalId) : null,
          data: formData,
          validade_dias: Number(formValidadeDias),
          desconto: Number(formDesconto || 0),
          frete: Number(formFrete || 0),
          prazo: formPrazo,
          pagamento: formPagamento,
          observacoes: formObs,
          status: 'aberto',
          itens: itensValidos,
        });
      }
    });

    setModoEdicao(false);
    setOrcamentoSelecionadoId(savedId);
  };

  const handleDuplicar = (orc: Orcamento) => {
    let newId = 1;
    db.update((state) => {
      newId = state.orcamentos.length > 0 ? Math.max(...state.orcamentos.map((x) => x.id)) + 1 : 1;
      state.orcamentos.unshift({
        ...orc,
        id: newId,
        data: hoje,
        status: 'aberto',
        itens: orc.itens.map((it, idx) => ({ ...it, id: idx + 1, orcamento_id: newId })),
      });
    });
    setOrcamentoSelecionadoId(newId);
  };

  const handleExcluir = (id: number) => {
    if (!confirm('Deseja excluir este orçamento?')) return;
    db.update((state) => {
      state.orcamentos = state.orcamentos.filter((o) => o.id !== id);
    });
    setOrcamentoSelecionadoId(null);
  };

  const handleConfirmarAprovacao = () => {
    if (!modalAprovar) return;
    const novoPedido = criarPedidoDeOrcamento(modalAprovar, prazoPedido, doEstoque);
    setModalAprovar(null);
    onNavigate('pedidos', { pedidoId: novoPedido.id });
  };

  const handleExportarCsv = () => {
    const cabecalhos = [
      'ID Orçamento',
      'Data',
      'Cliente',
      'Canal',
      'Subtotal (R$)',
      'Desconto (R$)',
      'Frete (R$)',
      'Total (R$)',
      'Válido Até',
      'Status',
      'Prazo',
      'Pagamento',
      'Itens',
    ];
    const linhas = filtrados.map((o) => {
      const cli = data.clientes.find((c) => c.id === o.cliente_id)?.nome || 'Balcão';
      const canal = o.canal_id ? data.canais.find((c) => c.id === o.canal_id)?.nome : 'Balcão';
      const itensStr = o.itens.map((it) => `${it.qtd}x ${it.descricao}`).join(' | ');
      return [
        `#${String(o.id).padStart(4, '0')}`,
        o.data,
        cli,
        canal || 'Balcão',
        o.subtotal.toFixed(2),
        o.desconto.toFixed(2),
        o.frete.toFixed(2),
        o.total.toFixed(2),
        o.validoAte,
        o.statusExib,
        o.prazo || '',
        o.pagamento || '',
        itensStr,
      ];
    });
    exportarTabelaParaCsv('orcamentos', cabecalhos, linhas);
  };

  // Se modo de edição/novo aberto
  if (modoEdicao) {
    const calcSubtotal = formItens.reduce((acc, it) => acc + (Number(it.qtd) || 0) * (Number(it.preco_unit) || 0), 0);
    const calcTotal = calcSubtotal - (Number(formDesconto) || 0) + (Number(formFrete) || 0);

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2>{formId ? `Editar Orçamento #${String(formId).padStart(4, '0')}` : 'Novo Orçamento'}</h2>
          <button className="sec" onClick={() => setModoEdicao(false)}>
            Cancelar
          </button>
        </div>

        <form onSubmit={handleSalvarOrcamento} className="card">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <label>Cliente *</label>
              <select
                required
                value={formClienteId}
                onChange={(e) => setFormClienteId(Number(e.target.value))}
              >
                <option value="">Selecione o cliente...</option>
                {data.clientes
                  .filter((c) => c.ativo)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} {c.telefone ? `(${c.telefone})` : ''}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Canal de Venda</label>
                <button
                  type="button"
                  className="sec"
                  style={{ fontSize: 11, padding: '1px 6px', marginBottom: 2 }}
                  title="Cadastrar novo canal de venda"
                  onClick={() => {
                    const nome = prompt('Nome do novo canal de venda (ex: Mercado Livre, Shopee, WhatsApp):');
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
                <option value="">Sem canal / Balcão</option>
                {data.canais
                  .filter((c) => c.ativo)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} {c.taxa_pct > 0 ? `(${c.taxa_pct}%)` : ''}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label>Data de Emissão</label>
              <input type="date" value={formData} onChange={(e) => setFormData(e.target.value)} />
            </div>

            <div>
              <label>Validade (dias)</label>
              <input
                type="number"
                min="1"
                value={formValidadeDias}
                onChange={(e) => setFormValidadeDias(Number(e.target.value))}
              />
            </div>
          </div>

          <h3 style={{ margin: '20px 0 10px' }}>Itens do Orçamento</h3>
          <div style={{ overflowX: 'auto', marginBottom: 10 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Produto Cadastrado</th>
                  <th style={{ width: '25%' }}>Descrição</th>
                  <th style={{ width: '20%' }}>Personalização / Cor</th>
                  <th style={{ width: '10%' }}>Qtd</th>
                  <th style={{ width: '10%' }}>Preço Unit (R$)</th>
                  <th style={{ width: '10%' }}>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {formItens.map((it, idx) => {
                  const itTotal = (Number(it.qtd) || 0) * (Number(it.preco_unit) || 0);
                  return (
                    <tr key={idx}>
                      <td>
                        <select
                          value={it.produto_id || ''}
                          onChange={(e) => handleSelectProduto(idx, e.target.value)}
                        >
                          <option value="">Item avulso...</option>
                          {data.produtos
                            .filter((p) => p.ativo)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nome} ({formatBrl(p.preco)})
                              </option>
                            ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          required
                          placeholder="Ex: Chaveiro 3D"
                          value={it.descricao || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormItens((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], descricao: val };
                              return next;
                            });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          placeholder="Ex: Nome, cor..."
                          value={it.personalizacao || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormItens((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], personalizacao: val };
                              return next;
                            });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          value={it.qtd || 1}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setFormItens((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], qtd: val };
                              return next;
                            });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={it.preco_unit || 0}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setFormItens((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], preco_unit: val };
                              return next;
                            });
                          }}
                        />
                      </td>
                      <td>
                        <b>{formatBrl(itTotal)}</b>
                      </td>
                      <td>
                        {formItens.length > 1 && (
                          <button
                            type="button"
                            className="sec bad"
                            style={{ padding: '3px 8px' }}
                            onClick={() => handleRemoveItem(idx)}
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
          </div>

          <button type="button" className="sec" onClick={handleAddItem} style={{ marginBottom: 16 }}>
            + Adicionar Item
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <label>Prazo de Entrega Estimado</label>
              <input type="text" value={formPrazo} onChange={(e) => setFormPrazo(e.target.value)} />
            </div>
            <div>
              <label>Condição de Pagamento</label>
              <input type="text" value={formPagamento} onChange={(e) => setFormPagamento(e.target.value)} />
            </div>
            <div>
              <label>Desconto (R$)</label>
              <input
                type="number"
                step="0.01"
                value={formDesconto}
                onChange={(e) => setFormDesconto(Number(e.target.value))}
              />
            </div>
            <div>
              <label>Frete (R$)</label>
              <input
                type="number"
                step="0.01"
                value={formFrete}
                onChange={(e) => setFormFrete(Number(e.target.value))}
              />
            </div>
          </div>

          <label style={{ marginTop: 12 }}>Observações Gerais</label>
          <textarea
            rows={2}
            value={formObs}
            onChange={(e) => setFormObs(e.target.value)}
            placeholder="Informações adicionais para o cliente..."
          />

          <div
            style={{
              marginTop: 16,
              padding: '12px 16px',
              background: 'var(--col)',
              borderRadius: 8,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <span>Subtotal: <b>{formatBrl(calcSubtotal)}</b></span> ·{' '}
              <span>Desconto: <b>{formatBrl(formDesconto)}</b></span> ·{' '}
              <span>Frete: <b>{formatBrl(formFrete)}</b></span>
            </div>
            <div style={{ fontSize: 18 }}>
              Total Geral: <b className="ok">{formatBrl(calcTotal)}</b>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <button type="button" className="sec" onClick={() => setModoEdicao(false)}>
              Cancelar
            </button>
            <button type="submit">Salvar Orçamento</button>
          </div>
        </form>
      </div>
    );
  }

  // Visualização de um orçamento em formato de Documento Oficial
  if (orcamentoAtual) {
    const cli = data.clientes.find((c) => c.id === orcamentoAtual.cliente_id);
    const canal = orcamentoAtual.canal_id ? data.canais.find((c) => c.id === orcamentoAtual.canal_id) : null;
    const cfg = data.config;

    const textoWhatsApp = `Olá ${cli ? cli.nome.split(' ')[0] : 'Cliente'}! Segue o orçamento nº ${String(orcamentoAtual.id).padStart(4, '0')} da ${EMPRESA.nome}, no valor de ${formatBrl(orcamentoAtual.total)}, válido até ${new Date(orcamentoAtual.validoAte + 'T00:00:00').toLocaleDateString('pt-BR')}. Qualquer dúvida estamos à disposição!`;
    const linkWhatsApp = cli?.telefone
      ? `https://wa.me/55${cli.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(textoWhatsApp)}`
      : '';

    return (
      <div>
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <button className="sec" onClick={() => setOrcamentoSelecionadoId(null)} style={{ marginRight: 8 }}>
              ← Lista de Orçamentos
            </button>
            <h2 style={{ display: 'inline', verticalAlign: 'middle' }}>
              Orçamento #{String(orcamentoAtual.id).padStart(4, '0')}
            </h2>
            <span className={`tag ${orcamentoAtual.statusExib}`} style={{ marginLeft: 10 }}>
              {orcamentoAtual.statusExib}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {orcamentoAtual.status === 'aberto' && (
              <button
                onClick={() => {
                  setModalAprovar(orcamentoAtual);
                  setPrazoPedido(hoje);
                }}
              >
                ✓ Aprovar → Pedido
              </button>
            )}

            {linkWhatsApp && (
              <a className="btn sec" href={linkWhatsApp} target="_blank" rel="noreferrer">
                💬 WhatsApp
              </a>
            )}

            <button className="sec" onClick={() => window.print()}>
              🖨 Imprimir / PDF
            </button>

            <button className="sec" onClick={() => handleEditarExistente(orcamentoAtual)}>
              Editar
            </button>

            <button className="sec" onClick={() => handleDuplicar(orcamentoAtual)}>
              Duplicar
            </button>

            {orcamentoAtual.status !== 'aprovado' && (
              <button className="sec bad" onClick={() => handleExcluir(orcamentoAtual.id)}>
                Excluir
              </button>
            )}
          </div>
        </div>

        {/* Folha de Orçamento formatada (Visual e Impressão) */}
        <div
          className="card"
          style={{
            maxWidth: 800,
            margin: '0 auto',
            padding: 32,
            background: '#fff',
            color: '#111',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          {/* Cabeçalho */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #7b1a8c', paddingBottom: 16, marginBottom: 20 }}>
            <div>
              <img src="/static/logo.png" alt="3D Conex Lab" style={{ maxHeight: 60, marginBottom: 6 }} />
              <div style={{ fontSize: 13, color: '#555' }}>
                <div><b>{EMPRESA.nome}</b> — Impressão 3D e Modelagem</div>
                <div>Instagram: {EMPRESA.instagram} · WhatsApp: {EMPRESA.whatsapp}</div>
                {cfg.cnpj && <div>CNPJ: {cfg.cnpj}</div>}
                {cfg.endereco && <div>{cfg.endereco}</div>}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <h2 style={{ margin: 0, color: '#7b1a8c' }}>ORÇAMENTO</h2>
              <div style={{ fontSize: 18, fontWeight: 700, margin: '4px 0' }}>#{String(orcamentoAtual.id).padStart(4, '0')}</div>
              <div style={{ fontSize: 12, color: '#666' }}>
                Emissão: {new Date(orcamentoAtual.data + 'T00:00:00').toLocaleDateString('pt-BR')}<br />
                Válido até: <b>{new Date(orcamentoAtual.validoAte + 'T00:00:00').toLocaleDateString('pt-BR')}</b>
              </div>
            </div>
          </div>

          {/* Dados do Cliente */}
          <div style={{ background: '#fcfaff', border: '1px solid #ebdcf5', borderRadius: 6, padding: '10px 14px', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#7b1a8c', marginBottom: 4 }}>
              DADOS DO CLIENTE
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 6, fontSize: 13 }}>
              <div><b>Nome:</b> {cli?.nome || 'Balcão'}</div>
              <div><b>Telefone:</b> {cli?.telefone || 'Não informado'}</div>
              <div><b>E-mail:</b> {cli?.email || 'Não informado'}</div>
              {cli?.documento && <div><b>CPF/CNPJ:</b> {cli.documento}</div>}
            </div>
            {cli?.endereco && <div style={{ fontSize: 13, marginTop: 4 }}><b>Endereço:</b> {cli.endereco}</div>}
          </div>

          {/* Tabela de Itens */}
          <table style={{ width: '100%', marginBottom: 16, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5edf7', borderBottom: '2px solid #7b1a8c', color: '#333', textAlign: 'left', fontSize: 13 }}>
                <th style={{ padding: '8px 6px' }}>Item</th>
                <th style={{ padding: '8px 6px' }}>Descrição e Personalização</th>
                <th style={{ padding: '8px 6px', textAlign: 'center' }}>Qtd</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Preço Unit.</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {orcamentoAtual.itens.map((it, idx) => (
                <tr key={it.id} style={{ borderBottom: '1px solid #eee', fontSize: 13 }}>
                  <td style={{ padding: '8px 6px', color: '#666' }}>{idx + 1}</td>
                  <td style={{ padding: '8px 6px' }}>
                    <b>{it.descricao}</b>
                    {it.personalizacao && <div style={{ fontSize: 12, color: '#666' }}>{it.personalizacao}</div>}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'center' }}>{it.qtd}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right' }}>{formatBrl(it.preco_unit)}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right' }}><b>{formatBrl(it.qtd * it.preco_unit)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totais */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
            <div style={{ width: 260, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span style={{ color: '#666' }}>Subtotal:</span>
                <span>{formatBrl(orcamentoAtual.subtotal)}</span>
              </div>
              {orcamentoAtual.desconto > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#c62828' }}>
                  <span>Desconto:</span>
                  <span>- {formatBrl(orcamentoAtual.desconto)}</span>
                </div>
              )}
              {orcamentoAtual.frete > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                  <span style={{ color: '#666' }}>Frete:</span>
                  <span>{formatBrl(orcamentoAtual.frete)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #7b1a8c', paddingTop: 6, marginTop: 4, fontSize: 16 }}>
                <b>TOTAL:</b>
                <b style={{ color: '#7b1a8c' }}>{formatBrl(orcamentoAtual.total)}</b>
              </div>
            </div>
          </div>

          {/* Condições comerciais */}
          <div style={{ borderTop: '1px solid #eee', paddingTop: 14, fontSize: 12, color: '#444' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 8 }}>
              <div><b>Prazo de produção:</b> {orcamentoAtual.prazo}</div>
              <div><b>Forma de pagamento:</b> {orcamentoAtual.pagamento}</div>
              {canal && <div><b>Canal:</b> {canal.nome}</div>}
            </div>
            {orcamentoAtual.observacoes && (
              <div style={{ marginTop: 6, fontStyle: 'italic', color: '#666' }}>
                <b>Observações:</b> {orcamentoAtual.observacoes}
              </div>
            )}
            {cfg.pix && (
              <div style={{ marginTop: 8, padding: '6px 10px', background: '#eef8ee', borderRadius: 4, display: 'inline-block' }}>
                <b>Chave PIX:</b> {cfg.pix}
              </div>
            )}
          </div>
        </div>

        {/* Modal de Aprovar e Gerar Pedido */}
        {modalAprovar && (
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
              <h3>Aprovar Orçamento #{String(modalAprovar.id).padStart(4, '0')}</h3>
              <p>Ao aprovar, um novo pedido de produção será criado no Kanban.</p>

              <label>Prazo de Entrega do Pedido *</label>
              <input
                type="date"
                required
                value={prazoPedido}
                onChange={(e) => setPrazoPedido(e.target.value)}
              />

              <div style={{ marginTop: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={doEstoque}
                    onChange={(e) => setDoEstoque(e.target.checked)}
                    style={{ width: 'auto' }}
                  />
                  <span>Atender com produtos JÁ PRONTOS do estoque (não imprime)</span>
                </label>
                <small className="muted" style={{ display: 'block', marginTop: 4 }}>
                  Se marcado, os produtos prontos serão baixados na entrega e não consumirá filamento novo.
                </small>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                <button type="button" className="sec" onClick={() => setModalAprovar(null)}>
                  Cancelar
                </button>
                <button type="button" onClick={handleConfirmarAprovacao}>
                  Confirmar e Gerar Pedido
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Lista padrão de orçamentos
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0 }}>Orçamentos ({orcamentosComCalculos.length})</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="sec"
            onClick={handleExportarCsv}
            title="Exportar orçamentos para arquivo CSV"
            disabled={filtrados.length === 0}
          >
            📥 Exportar CSV
          </button>
          <button onClick={handleIniciarNovo}>+ Novo Orçamento</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Buscar por cliente ou número #..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />

        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          style={{ width: 160 }}
        >
          <option value="">Todos os status</option>
          <option value="aberto">Abertos</option>
          <option value="aprovado">Aprovados</option>
          <option value="recusado">Recusados</option>
          <option value="expirado">Expirados</option>
        </select>
      </div>

      <div className="card wrap">
        {filtrados.length === 0 ? (
          <p className="muted" style={{ padding: 12 }}>
            Nenhum orçamento encontrado.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Data</th>
                <th>Cliente</th>
                <th>Itens</th>
                <th>Total</th>
                <th>Válido até</th>
                <th>Status</th>
                <th className="r">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((o) => {
                const cli = data.clientes.find((c) => c.id === o.cliente_id);
                return (
                  <tr key={o.id}>
                    <td>
                      <a
                        href={`#orcamento-${o.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          setOrcamentoSelecionadoId(o.id);
                        }}
                        style={{ fontWeight: 700 }}
                      >
                        #{String(o.id).padStart(4, '0')}
                      </a>
                    </td>
                    <td>{new Date(o.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                    <td>{cli ? cli.nome : 'Balcão'}</td>
                    <td>{o.itens.map((it) => `${it.qtd}x ${it.descricao}`).join(', ')}</td>
                    <td>
                      <b>{formatBrl(o.total)}</b>
                    </td>
                    <td>{new Date(o.validoAte + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                    <td>
                      <span className={`tag ${o.statusExib}`}>{o.statusExib}</span>
                    </td>
                    <td className="r">
                      <button
                        className="sec"
                        style={{ padding: '3px 8px', fontSize: 13, marginRight: 6 }}
                        onClick={() => setOrcamentoSelecionadoId(o.id)}
                      >
                        Ver Documento
                      </button>
                      {o.status === 'aberto' && (
                        <button
                          style={{ padding: '3px 8px', fontSize: 13, marginRight: 6 }}
                          onClick={() => {
                            setModalAprovar(o);
                            setPrazoPedido(hoje);
                          }}
                        >
                          Aprovar
                        </button>
                      )}
                      <button
                        className="sec bad"
                        style={{ padding: '3px 8px', fontSize: 13 }}
                        onClick={() => handleExcluir(o.id)}
                        title="Excluir orçamento permanentemente"
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
    </div>
  );
};
