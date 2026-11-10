import React, { useState } from 'react';
import { formatBrl, formatDec } from '../calc';
import { db } from '../db';
import {
  baixarModeloCsv,
  exportarBackupExcel,
  ImportResult,
  processarArquivoImportacao,
} from '../importExport';
import {
  estoqueBaixo,
  registrarMov,
  registrarProducao,
  saldos,
} from '../services';
import { Insumo, Material, Produto, Rolo } from '../types';
import { NavTab } from './Navigation';

interface EstoqueViewProps {
  onNavigate: (tab: NavTab, extra?: any) => void;
  abaInicial?: string;
}

export const EstoqueView: React.FC<EstoqueViewProps> = ({ onNavigate, abaInicial = 'filamentos' }) => {
  const data = db.get();
  const hoje = new Date().toISOString().split('T')[0];
  const sdRolos = saldos('rolo');
  const sdInsumos = saldos('insumo');
  const sdProdutos = saldos('produto');
  const baixo = estoqueBaixo();

  const [aba, setAba] = useState<string>(abaInicial);

  // Modais
  const [modalCompraFilamento, setModalCompraFilamento] = useState(false);
  const [modalAjusteRolo, setModalAjusteRolo] = useState<Rolo | null>(null);
  const [ajusteNovoPeso, setAjusteNovoPeso] = useState<number>(0);

  const [modalNovoInsumo, setModalNovoInsumo] = useState(false);
  const [modalProducaoDireta, setModalProducaoDireta] = useState(false);
  const [producaoProdutoId, setProducaoProdutoId] = useState<number>(data.produtos[0]?.id || 0);
  const [producaoQtd, setProducaoQtd] = useState<number>(1);
  const [resumoProducao, setResumoProducao] = useState<string[] | null>(null);

  // Modal Importação CSV / Excel
  const [modalImportar, setModalImportar] = useState(false);
  const [arquivoImportar, setArquivoImportar] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const [resultadoImportacao, setResultadoImportacao] = useState<ImportResult | null>(null);

  // Form Compra Filamento
  const [compraMaterialId, setCompraMaterialId] = useState<number | ''>(data.materiais[0]?.id || '');
  const [compraNovoTipo, setCompraNovoTipo] = useState('PLA');
  const [compraNovaCor, setCompraNovaCor] = useState('');
  const [compraNovaMarca, setCompraNovaMarca] = useState('');
  const [compraMinimoG, setCompraMinimoG] = useState(500);
  const [compraPesoG, setCompraPesoG] = useState(1000);
  const [compraPreco, setCompraPreco] = useState(95);
  const [compraQtdRolos, setCompraQtdRolos] = useState(1);
  const [compraFornecedor, setCompraFornecedor] = useState('');

  // Form Novo Insumo
  const [insumoNome, setInsumoNome] = useState('');
  const [insumoUnidade, setInsumoUnidade] = useState('un');
  const [insumoCustoUnit, setInsumoCustoUnit] = useState(0.5);
  const [insumoMinimo, setInsumoMinimo] = useState(20);
  const [insumoQtdInicial, setInsumoQtdInicial] = useState(50);
  const [insumoFornecedor, setInsumoFornecedor] = useState('');

  // Filtros da aba de Movimentos
  const [filtroTipoMov, setFiltroTipoMov] = useState('');
  const [filtroMotivoMov, setFiltroMotivoMov] = useState('');

  const handleSalvarCompraFilamento = (e: React.FormEvent) => {
    e.preventDefault();
    db.update((state) => {
      let matId = compraMaterialId;
      if (!matId) {
        const nextMatId = state.materiais.length > 0 ? Math.max(...state.materiais.map((m) => m.id)) + 1 : 1;
        state.materiais.push({
          id: nextMatId,
          tipo: compraNovoTipo.trim().toUpperCase(),
          cor: compraNovaCor.trim(),
          marca: compraNovaMarca.trim(),
          minimo_g: Number(compraMinimoG),
          ativo: true,
        });
        matId = nextMatId;
      }

      for (let i = 0; i < Math.max(1, compraQtdRolos); i++) {
        const nextRoloId = state.rolos.length > 0 ? Math.max(...state.rolos.map((r) => r.id)) + 1 : 1;
        state.rolos.push({
          id: nextRoloId,
          material_id: Number(matId),
          peso_inicial: Number(compraPesoG),
          preco: Number(compraPreco),
          fornecedor: compraFornecedor.trim(),
          comprado_em: hoje,
          ativo: true,
        });

        const nextMovId = state.movimentos.length > 0 ? Math.max(...state.movimentos.map((m) => m.id)) + 1 : 1;
        state.movimentos.unshift({
          id: nextMovId,
          item_tipo: 'rolo',
          item_id: nextRoloId,
          delta: Number(compraPesoG),
          motivo: 'compra',
          ref_tipo: 'rolo',
          ref_id: nextRoloId,
          obs: 'Compra de filamento',
          em: new Date().toISOString(),
          valor: Number(compraPreco),
          data: hoje,
          fornecedor: compraFornecedor.trim(),
        });
      }
    });

    setModalCompraFilamento(false);
  };

  const handleSalvarAjusteRolo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalAjusteRolo) return;
    const saldoAtual = sdRolos[modalAjusteRolo.id] || 0;
    const delta = ajusteNovoPeso - saldoAtual;
    if (delta !== 0) {
      registrarMov('rolo', modalAjusteRolo.id, delta, 'ajuste', 'rolo', modalAjusteRolo.id, 'Pesagem física do rolo');
    }
    setModalAjusteRolo(null);
  };

  const handleSalvarNovoInsumo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!insumoNome.trim()) return;

    db.update((state) => {
      const nextId = state.insumos.length > 0 ? Math.max(...state.insumos.map((i) => i.id)) + 1 : 1;
      state.insumos.push({
        id: nextId,
        nome: insumoNome.trim(),
        unidade: insumoUnidade.trim() || 'un',
        custo_unit: Number(insumoCustoUnit),
        minimo: Number(insumoMinimo),
        fornecedor: insumoFornecedor.trim(),
        ativo: true,
      });

      if (insumoQtdInicial > 0) {
        const nextMovId = state.movimentos.length > 0 ? Math.max(...state.movimentos.map((m) => m.id)) + 1 : 1;
        state.movimentos.unshift({
          id: nextMovId,
          item_tipo: 'insumo',
          item_id: nextId,
          delta: Number(insumoQtdInicial),
          motivo: 'compra',
          ref_tipo: 'insumo',
          ref_id: nextId,
          obs: 'Estoque inicial',
          em: new Date().toISOString(),
          valor: Number(insumoQtdInicial) * Number(insumoCustoUnit),
          data: hoje,
          fornecedor: insumoFornecedor.trim(),
        });
      }
    });

    setModalNovoInsumo(false);
    setInsumoNome('');
  };

  const handleRegistrarProducaoDireta = (e: React.FormEvent) => {
    e.preventDefault();
    const prod = data.produtos.find((p) => p.id === Number(producaoProdutoId));
    if (!prod || producaoQtd <= 0) return;

    const resumo = registrarProducao(prod, producaoQtd, 'produto', prod.id, 'Produção direta para estoque');
    setResumoProducao(resumo);
  };

  const handleExecutarImportacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!arquivoImportar) return;
    setImportando(true);
    try {
      const res = await processarArquivoImportacao(arquivoImportar);
      setResultadoImportacao(res);
      if (res.sucesso) {
        setArquivoImportar(null);
      }
    } catch (err: any) {
      setResultadoImportacao({
        sucesso: false,
        filamentos: 0,
        insumos: 0,
        produtos: 0,
        clientes: 0,
        erros: ['Falha ao processar arquivo: ' + (err?.message || String(err))],
      });
    } finally {
      setImportando(false);
    }
  };

  const movimentosFiltrados = data.movimentos.filter((m) => {
    if (filtroTipoMov && m.item_tipo !== filtroTipoMov) return false;
    if (filtroMotivoMov && m.motivo !== filtroMotivoMov) return false;
    return true;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0 }}>Gerenciamento de Estoque</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setModalCompraFilamento(true)}>+ Comprar Filamento</button>
          <button className="sec" onClick={() => setModalNovoInsumo(true)}>+ Novo Insumo</button>
          <button className="sec" onClick={() => setModalProducaoDireta(true)}>⚙ Registrar Produção</button>
          <button className="sec" onClick={() => setModalImportar(true)} title="Importar filamentos, insumos, produtos e clientes via CSV ou Excel">📥 Importar CSV / Excel</button>
          <button className="sec" onClick={() => exportarBackupExcel()} title="Baixar todas as planilhas do estoque e sistema em formato Excel (.xlsx)">📊 Backup Excel (.xlsx)</button>
        </div>
      </div>

      {/* Abas */}
      <div className="tabs" style={{ marginBottom: 14, borderBottom: '1px solid var(--border)' }}>
        <a
          href="#filamentos"
          className={aba === 'filamentos' ? 'on' : ''}
          onClick={(e) => {
            e.preventDefault();
            setAba('filamentos');
          }}
        >
          Filamentos ({data.rolos.filter((r) => r.ativo).length})
        </a>
        <a
          href="#insumos"
          className={aba === 'insumos' ? 'on' : ''}
          onClick={(e) => {
            e.preventDefault();
            setAba('insumos');
          }}
        >
          Insumos ({data.insumos.filter((i) => i.ativo).length})
        </a>
        <a
          href="#produtos"
          className={aba === 'produtos' ? 'on' : ''}
          onClick={(e) => {
            e.preventDefault();
            setAba('produtos');
          }}
        >
          Produtos Prontos ({data.produtos.filter((p) => p.ativo).length})
        </a>
        <a
          href="#movimentos"
          className={aba === 'movimentos' ? 'on' : ''}
          onClick={(e) => {
            e.preventDefault();
            setAba('movimentos');
          }}
        >
          Livro-Razão ({data.movimentos.length})
        </a>
        <a
          href="#alertas"
          className={aba === 'alertas' ? 'on' : ''}
          onClick={(e) => {
            e.preventDefault();
            setAba('alertas');
          }}
        >
          Alertas ({baixo.length})
          {baixo.length > 0 && (
            <span
              className="badge"
              style={{ background: baixo.some((b) => b.status === 'acabou') ? 'var(--bad)' : 'var(--warn)' }}
            >
              {baixo.length}
            </span>
          )}
        </a>
      </div>

      {/* ABA FILAMENTOS */}
      {aba === 'filamentos' && (
        <div className="card wrap">
          <table>
            <thead>
              <tr>
                <th>Rolo</th>
                <th>Material</th>
                <th>Cor</th>
                <th>Marca</th>
                <th style={{ width: 220 }}>Peso Restante (g)</th>
                <th>Custo/g</th>
                <th>Comprado em</th>
                <th className="r">Ajuste</th>
              </tr>
            </thead>
            <tbody>
              {data.rolos.filter((r) => r.ativo).map((r) => {
                const mat = data.materiais.find((m) => m.id === r.material_id);
                const saldoAtual = sdRolos[r.id] || 0;
                const pct = Math.max(0, Math.min(100, (saldoAtual / (r.peso_inicial || 1000)) * 100));
                const custoG = r.peso_inicial > 0 ? r.preco / r.peso_inicial : 0;
                const status = saldoAtual <= 0 ? 'acabou' : (mat && saldoAtual <= mat.minimo_g ? 'acabando' : 'ok');

                return (
                  <tr key={r.id}>
                    <td><b>#{r.id}</b></td>
                    <td>{mat?.tipo || 'PLA'}</td>
                    <td>{mat?.cor || '-'}</td>
                    <td>{mat?.marca || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                        <span>
                          <b className={status === 'acabou' ? 'bad' : status === 'acabando' ? 'warn' : ''}>
                            {saldoAtual} g
                          </b>{' '}
                          / {r.peso_inicial} g
                        </span>
                        <span>{pct.toFixed(0)}%</span>
                      </div>
                      <div className="bar">
                        <i
                          style={{
                            width: `${pct}%`,
                            background: status === 'acabou' ? 'var(--bad)' : status === 'acabando' ? 'var(--warn)' : 'var(--btn)',
                          }}
                        />
                      </div>
                    </td>
                    <td>{formatBrl(custoG)}/g</td>
                    <td>{new Date(r.comprado_em + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="r">
                      <button
                        className="sec"
                        style={{ padding: '3px 8px', fontSize: 13 }}
                        onClick={() => {
                          setModalAjusteRolo(r);
                          setAjusteNovoPeso(saldoAtual);
                        }}
                      >
                        Pesar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ABA INSUMOS */}
      {aba === 'insumos' && (
        <div className="card wrap">
          <table>
            <thead>
              <tr>
                <th>Insumo</th>
                <th>Unidade</th>
                <th>Custo Unitário</th>
                <th>Saldo Atual</th>
                <th>Mínimo</th>
                <th>Fornecedor</th>
                <th className="r">Ajustar Saldo</th>
              </tr>
            </thead>
            <tbody>
              {data.insumos.filter((i) => i.ativo).map((i) => {
                const sl = sdInsumos[i.id] || 0;
                const status = sl <= 0 ? 'acabou' : (sl <= i.minimo ? 'acabando' : 'ok');
                return (
                  <tr key={i.id}>
                    <td><b>{i.nome}</b></td>
                    <td>{i.unidade}</td>
                    <td>{formatBrl(i.custo_unit)}</td>
                    <td>
                      <span className={`tag ${status}`}>{sl} {i.unidade}</span>
                    </td>
                    <td>{i.minimo} {i.unidade}</td>
                    <td>{i.fornecedor || '-'}</td>
                    <td className="r">
                      <button
                        className="sec"
                        style={{ padding: '3px 8px', fontSize: 13 }}
                        onClick={() => {
                          const novo = prompt(`Novo saldo para ${i.nome}:`, String(sl));
                          if (novo !== null) {
                            const val = Number(novo);
                            if (!isNaN(val)) {
                              registrarMov('insumo', i.id, val - sl, 'ajuste', 'insumo', i.id, 'Ajuste manual');
                            }
                          }
                        }}
                      >
                        Ajustar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ABA PRODUTOS PRONTOS */}
      {aba === 'produtos' && (
        <div className="card wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Preço de Venda</th>
                <th>Saldo Pronto</th>
                <th>Mínimo</th>
                <th className="r">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.produtos.filter((p) => p.ativo).map((p) => {
                const sl = sdProdutos[p.id] || 0;
                return (
                  <tr key={p.id}>
                    <td><code>{p.sku}</code></td>
                    <td><b>{p.nome}</b></td>
                    <td>{p.categoria || '-'}</td>
                    <td>{formatBrl(p.preco)}</td>
                    <td>
                      <span className={`tag ${sl <= p.minimo ? (sl <= 0 ? 'acabou' : 'acabando') : 'ativa'}`}>
                        {sl} un
                      </span>
                    </td>
                    <td>{p.minimo} un</td>
                    <td className="r">
                      <button
                        className="sec"
                        style={{ padding: '3px 8px', fontSize: 13 }}
                        onClick={() => {
                          setProducaoProdutoId(p.id);
                          setModalProducaoDireta(true);
                        }}
                      >
                        + Produzir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ABA LIVRO-RAZÃO / MOVIMENTOS */}
      {aba === 'movimentos' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <select
              value={filtroTipoMov}
              onChange={(e) => setFiltroTipoMov(e.target.value)}
              style={{ width: 160 }}
            >
              <option value="">Todos os tipos</option>
              <option value="rolo">Rolos (Filamento)</option>
              <option value="insumo">Insumos</option>
              <option value="produto">Produtos Prontos</option>
            </select>

            <select
              value={filtroMotivoMov}
              onChange={(e) => setFiltroMotivoMov(e.target.value)}
              style={{ width: 160 }}
            >
              <option value="">Todos os motivos</option>
              <option value="compra">Compra</option>
              <option value="producao">Produção</option>
              <option value="falha">Falha</option>
              <option value="venda">Venda</option>
              <option value="ajuste">Ajuste</option>
            </select>
          </div>

          <div className="card wrap">
            <table>
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Tipo</th>
                  <th>Item</th>
                  <th>Delta (Movimento)</th>
                  <th>Motivo</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {movimentosFiltrados.slice(0, 100).map((m) => {
                  let nomeItem = `Item #${m.item_id}`;
                  if (m.item_tipo === 'rolo') {
                    const r = data.rolos.find((x) => x.id === m.item_id);
                    const mat = r ? data.materiais.find((x) => x.id === r.material_id) : null;
                    nomeItem = `Rolo #${m.item_id} (${mat ? `${mat.tipo} ${mat.cor}` : ''})`;
                  } else if (m.item_tipo === 'insumo') {
                    nomeItem = data.insumos.find((x) => x.id === m.item_id)?.nome || nomeItem;
                  } else if (m.item_tipo === 'produto') {
                    nomeItem = data.produtos.find((x) => x.id === m.item_id)?.nome || nomeItem;
                  }

                  const un = m.item_tipo === 'rolo' ? 'g' : 'un';

                  return (
                    <tr key={m.id}>
                      <td>{new Date(m.em).toLocaleString('pt-BR')}</td>
                      <td><span className="tag">{m.item_tipo}</span></td>
                      <td><b>{nomeItem}</b></td>
                      <td>
                        <b className={m.delta > 0 ? 'ok' : 'bad'}>
                          {m.delta > 0 ? `+${m.delta}` : m.delta} {un}
                        </b>
                      </td>
                      <td><span className="tag">{m.motivo}</span></td>
                      <td style={{ color: 'var(--muted)', fontSize: 13 }}>{m.obs || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA ALERTAS */}
      {aba === 'alertas' && (
        <div className="card wrap">
          {baixo.length === 0 ? (
            <p className="ok" style={{ padding: 12 }}>
              ✓ Todos os itens acompanhados estão com níveis normais de estoque!
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Item</th>
                  <th>Saldo Atual</th>
                  <th>Estoque Mínimo</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {baixo.map((a, idx) => (
                  <tr key={idx} className={a.status === 'acabou' ? 'row-bad' : 'row-warn'}>
                    <td>{a.tipo}</td>
                    <td><b>{a.nome}</b></td>
                    <td><b>{a.saldo}</b></td>
                    <td>{a.minimo}</td>
                    <td>
                      <span className={`tag ${a.status}`}>{a.status.toUpperCase()}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal Compra de Filamento */}
      {modalCompraFilamento && (
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
            <h3>Registrar Compra de Filamento</h3>
            <form onSubmit={handleSalvarCompraFilamento}>
              <label>Material Existente</label>
              <select
                value={compraMaterialId}
                onChange={(e) => setCompraMaterialId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">+ Cadastrar Novo Material...</option>
                {data.materiais.filter((m) => m.ativo).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.tipo} {m.cor} ({m.marca})
                  </option>
                ))}
              </select>

              {!compraMaterialId && (
                <div style={{ background: 'var(--col)', padding: 10, borderRadius: 6, marginTop: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div>
                      <label>Tipo (PLA, etc.)</label>
                      <input type="text" value={compraNovoTipo} onChange={(e) => setCompraNovoTipo(e.target.value)} />
                    </div>
                    <div>
                      <label>Cor</label>
                      <input type="text" value={compraNovaCor} onChange={(e) => setCompraNovaCor(e.target.value)} />
                    </div>
                    <div>
                      <label>Marca</label>
                      <input type="text" value={compraNovaMarca} onChange={(e) => setCompraNovaMarca(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                <div>
                  <label>Peso do Rolo (g) *</label>
                  <input
                    type="number"
                    required
                    value={compraPesoG}
                    onChange={(e) => setCompraPesoG(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label>Preço Pago por Rolo (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={compraPreco}
                    onChange={(e) => setCompraPreco(Number(e.target.value))}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label>Quantidade de Rolos</label>
                  <input
                    type="number"
                    min="1"
                    value={compraQtdRolos}
                    onChange={(e) => setCompraQtdRolos(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label>Fornecedor / Loja</label>
                  <input
                    type="text"
                    value={compraFornecedor}
                    onChange={(e) => setCompraFornecedor(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" className="sec" onClick={() => setModalCompraFilamento(false)}>
                  Cancelar
                </button>
                <button type="submit">Confirmar Compra</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ajustar Peso do Rolo */}
      {modalAjusteRolo && (
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
          <div className="card" style={{ width: 380, maxWidth: '100%' }}>
            <h3>Pesar Rolo #{modalAjusteRolo.id}</h3>
            <form onSubmit={handleSalvarAjusteRolo}>
              <label>Peso Atual na Balança (g) *</label>
              <input
                type="number"
                min="0"
                required
                value={ajusteNovoPeso}
                onChange={(e) => setAjusteNovoPeso(Number(e.target.value))}
              />
              <small className="muted">
                Saldo no sistema: {sdRolos[modalAjusteRolo.id] || 0} g
              </small>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" className="sec" onClick={() => setModalAjusteRolo(null)}>
                  Cancelar
                </button>
                <button type="submit">Salvar Pesagem</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Novo Insumo */}
      {modalNovoInsumo && (
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
            <h3>Novo Insumo / Embalagem</h3>
            <form onSubmit={handleSalvarNovoInsumo}>
              <label>Nome do Insumo *</label>
              <input type="text" required value={insumoNome} onChange={(e) => setInsumoNome(e.target.value)} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label>Unidade de Medida</label>
                  <input type="text" value={insumoUnidade} onChange={(e) => setInsumoUnidade(e.target.value)} />
                </div>
                <div>
                  <label>Custo Unitário (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={insumoCustoUnit}
                    onChange={(e) => setInsumoCustoUnit(Number(e.target.value))}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label>Quantidade Inicial</label>
                  <input
                    type="number"
                    value={insumoQtdInicial}
                    onChange={(e) => setInsumoQtdInicial(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label>Estoque Mínimo</label>
                  <input
                    type="number"
                    value={insumoMinimo}
                    onChange={(e) => setInsumoMinimo(Number(e.target.value))}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" className="sec" onClick={() => setModalNovoInsumo(false)}>
                  Cancelar
                </button>
                <button type="submit">Cadastrar Insumo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Registrar Produção Direta */}
      {modalProducaoDireta && (
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
            <h3>Registrar Produção Direta</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>
              Produção para abastecer produtos prontos em estoque. Abate filamento e insumos automaticamente da receita.
            </p>
            <form onSubmit={handleRegistrarProducaoDireta}>
              <label>Produto *</label>
              <select
                value={producaoProdutoId}
                onChange={(e) => setProducaoProdutoId(Number(e.target.value))}
              >
                {data.produtos.filter((p) => p.ativo).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} ({sdProdutos[p.id] || 0} prontas em estoque)
                  </option>
                ))}
              </select>

              <label>Quantidade Produzida *</label>
              <input
                type="number"
                min="1"
                required
                value={producaoQtd}
                onChange={(e) => setProducaoQtd(Number(e.target.value))}
              />

              {resumoProducao && (
                <div style={{ background: 'var(--ok-bg)', padding: '10px 12px', borderRadius: 6, marginTop: 12, fontSize: 13 }}>
                  <b className="ok">✓ Produção registrada com sucesso!</b>
                  <div style={{ marginTop: 4 }}>Abatido do estoque: {resumoProducao.join(', ')}</div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button
                  type="button"
                  className="sec"
                  onClick={() => {
                    setModalProducaoDireta(false);
                    setResumoProducao(null);
                  }}
                >
                  Fechar
                </button>
                <button type="submit">Registrar Produção</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Importar CSV / Excel */}
      {modalImportar && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
        >
          <div className="card" style={{ width: 540, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>📥 Importar Planilha CSV / Excel</h3>
              <button
                type="button"
                className="sec"
                style={{ padding: '2px 8px' }}
                onClick={() => {
                  setModalImportar(false);
                  setResultadoImportacao(null);
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 0, lineHeight: 1.4 }}>
              Faça upload de sua planilha de estoque ou catálogo (.csv ou .xlsx). O sistema identificará se os registros correspondem a <b>filamentos</b>, <b>insumos</b>, <b>produtos prontos</b> ou <b>clientes</b>, cadastrando-os e alimentando o livro-razão de estoque automaticamente.
            </p>

            <form onSubmit={handleExecutarImportacao}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
                  Arquivo (.csv, .xlsx, .xls) *
                </label>
                <input
                  type="file"
                  accept=".csv, .xlsx, .xls, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  required
                  onChange={(e) => {
                    setArquivoImportar(e.target.files?.[0] || null);
                    setResultadoImportacao(null);
                  }}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <button
                  type="button"
                  className="sec"
                  style={{ fontSize: 12, padding: '4px 8px' }}
                  onClick={() => baixarModeloCsv()}
                >
                  📄 Baixar Modelo CSV de Exemplo
                </button>
                <small className="muted">Codificação recomendada: UTF-8</small>
              </div>

              {resultadoImportacao && (
                <div
                  style={{
                    background: resultadoImportacao.sucesso ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)',
                    border: `1px solid ${resultadoImportacao.sucesso ? 'var(--ok)' : 'var(--bad)'}`,
                    padding: '12px 14px',
                    borderRadius: 6,
                    marginBottom: 14,
                    fontSize: 13,
                  }}
                >
                  <b style={{ color: resultadoImportacao.sucesso ? 'var(--ok)' : 'var(--bad)' }}>
                    {resultadoImportacao.sucesso ? '✓ Importação concluída com sucesso!' : '✕ Falha na importação'}
                  </b>
                  <div style={{ marginTop: 6 }}>
                    Distribuído no sistema:
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                      <li><b>{resultadoImportacao.filamentos}</b> filamentos / rolos cadastrados</li>
                      <li><b>{resultadoImportacao.insumos}</b> insumos cadastrados</li>
                      <li><b>{resultadoImportacao.produtos}</b> produtos registrados</li>
                      <li><b>{resultadoImportacao.clientes}</b> clientes adicionados</li>
                    </ul>
                  </div>
                  {resultadoImportacao.erros.length > 0 && (
                    <div style={{ marginTop: 8, color: 'var(--bad)' }}>
                      <b>Avisos / Ocorrências:</b>
                      <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                        {resultadoImportacao.erros.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="sec"
                  onClick={() => {
                    setModalImportar(false);
                    setResultadoImportacao(null);
                  }}
                >
                  Fechar
                </button>
                <button type="submit" disabled={!arquivoImportar || importando}>
                  {importando ? 'Processando dados...' : 'Processar e Distribuir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
