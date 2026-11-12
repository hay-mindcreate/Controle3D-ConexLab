import React, { useState } from 'react';
import { formatBrl, formatDec } from '../calc';
import { db } from '../db';
import { exportarTabelaParaCsv, gerarSku } from '../importExport';
import { custoProduto, saldos } from '../services';
import { Produto, ProdutoInsumo, ProdutoMaterial } from '../types';
import { NavTab } from './Navigation';

interface ProdutosViewProps {
  onNavigate: (tab: NavTab, extra?: any) => void;
  produtoId?: number | null;
}

export const ProdutosView: React.FC<ProdutosViewProps> = ({ onNavigate, produtoId }) => {
  const data = db.get();
  const sdRolos = saldos('rolo');
  const sdProdutos = saldos('produto');

  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [produtoSelecionadoId, setProdutoSelecionadoId] = useState<number | null>(produtoId || null);
  const [modoEdicao, setModoEdicao] = useState(false);

  // Form State
  const [formId, setFormId] = useState<number | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formCategoria, setFormCategoria] = useState('');
  const [formProjetoId, setFormProjetoId] = useState<number | ''>('');
  const [formTempoMin, setFormTempoMin] = useState(30);
  const [formImpressoraId, setFormImpressoraId] = useState<number | ''>(data.impressoras[0]?.id || '');
  const [formPreco, setFormPreco] = useState(0);
  const [formPrecoManual, setFormPrecoManual] = useState(false);
  const [formMargemPct, setFormMargemPct] = useState(40);
  const [formLoteQtd, setFormLoteQtd] = useState(1);
  const [formMinimo, setFormMinimo] = useState(0);
  const [formEmbalagem, setFormEmbalagem] = useState(0);
  const [formAcessorios, setFormAcessorios] = useState(0);
  const [formMateriais, setFormMateriais] = useState<Array<{ material_id: number; gramas: number }>>([
    { material_id: data.materiais[0]?.id || 1, gramas: 20 },
  ]);
  const [formInsumos, setFormInsumos] = useState<Array<{ insumo_id: number; qtd: number }>>([]);

  const categorias = Array.from(new Set(data.produtos.map((p) => p.categoria).filter(Boolean)));

  const produtosAtivos = data.produtos.filter((p) => p.ativo);
  const filtrados = produtosAtivos.filter((p) => {
    const matchBusca = !busca.trim() || p.nome.toLowerCase().includes(busca.toLowerCase()) || p.sku.toLowerCase().includes(busca.toLowerCase());
    const matchCat = !filtroCategoria || p.categoria === filtroCategoria;
    return matchBusca && matchCat;
  });

  const produtoAtual = produtoSelecionadoId ? data.produtos.find((p) => p.id === produtoSelecionadoId) : null;

  const handleIniciarNovo = () => {
    const defaultCat = 'Geral';
    const nextSku = gerarSku(defaultCat, data.produtos);
    setFormId(null);
    setFormNome('');
    setFormSku(nextSku);
    setFormCategoria(defaultCat);
    setFormProjetoId('');
    setFormTempoMin(30);
    setFormImpressoraId(data.impressoras[0]?.id || '');
    setFormPreco(0);
    setFormPrecoManual(false);
    setFormMargemPct(Number(data.config.margem_pct || 40));
    setFormLoteQtd(1);
    setFormMinimo(0);
    setFormEmbalagem(0);
    setFormAcessorios(0);
    setFormMateriais([{ material_id: data.materiais[0]?.id || 1, gramas: 20 }]);
    setFormInsumos([]);
    setModoEdicao(true);
  };

  const handleCategoriaChange = (novaCat: string) => {
    setFormCategoria(novaCat);
    // Padronizar as 2 iniciais da categoria antes do número (ex: CH0001, DE0002)
    if (!formId) {
      setFormSku(gerarSku(novaCat, data.produtos));
    }
  };

  const handleEditar = (p: Produto) => {
    setFormId(p.id);
    setFormNome(p.nome);
    setFormSku(p.sku);
    setFormCategoria(p.categoria);
    setFormProjetoId(p.projeto_id || '');
    setFormTempoMin(p.tempo_min);
    setFormImpressoraId(p.impressora_id || '');
    setFormPreco(p.preco);
    setFormPrecoManual(p.preco_manual);
    setFormMargemPct(p.margem_pct);
    setFormLoteQtd(p.lote_qtd || 1);
    setFormMinimo(p.minimo);
    setFormEmbalagem(p.embalagem);
    setFormAcessorios(p.acessorios);
    setFormMateriais(p.materiais.map((m) => ({ material_id: m.material_id, gramas: m.gramas })));
    setFormInsumos(p.insumos.map((i) => ({ insumo_id: i.insumo_id, qtd: i.qtd })));
    setModoEdicao(true);
  };

  const handleSalvarProduto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNome.trim()) return;

    let savedId = formId;

    // Garantir SKU padronizado com 2 iniciais da categoria se vazio
    const finalSku = formSku.trim() || gerarSku(formCategoria.trim() || 'Geral', data.produtos);

    // Calcular produto temporário para preço sugerido se preço não manual
    const dummyProd: Produto = {
      id: formId || 0,
      nome: formNome.trim(),
      sku: finalSku,
      categoria: formCategoria.trim() || 'Geral',
      foto: '',
      modelo: '',
      projeto_id: formProjetoId ? Number(formProjetoId) : null,
      tempo_min: Number(formTempoMin),
      impressora_id: formImpressoraId ? Number(formImpressoraId) : null,
      preco: Number(formPreco),
      preco_manual: formPrecoManual,
      margem_pct: Number(formMargemPct),
      lote_qtd: Number(formLoteQtd || 1),
      fornecedor: '',
      minimo: 0,
      embalagem: Number(formEmbalagem),
      acessorios: Number(formAcessorios),
      min_trabalho: 0,
      ativo: true,
      materiais: formMateriais.map((m, idx) => ({ id: idx + 1, produto_id: formId || 0, material_id: m.material_id, gramas: m.gramas })),
      insumos: formInsumos.map((i, idx) => ({ id: idx + 1, produto_id: formId || 0, insumo_id: i.insumo_id, qtd: i.qtd })),
    };

    const calcResult = custoProduto(dummyProd, data.config, null, sdRolos);
    const precoFinal = formPrecoManual ? Number(formPreco) : (calcResult.preco || Number(formPreco) || 0);

    db.update((state) => {
      if (formId) {
        const p = state.produtos.find((x) => x.id === formId);
        if (p) {
          p.nome = formNome.trim();
          p.sku = finalSku;
          p.categoria = formCategoria.trim() || 'Geral';
          p.projeto_id = formProjetoId ? Number(formProjetoId) : null;
          p.tempo_min = Number(formTempoMin);
          p.impressora_id = formImpressoraId ? Number(formImpressoraId) : null;
          p.preco = precoFinal;
          p.preco_manual = formPrecoManual;
          p.margem_pct = Number(formMargemPct);
          p.lote_qtd = Number(formLoteQtd || 1);
          p.minimo = 0;
          p.embalagem = Number(formEmbalagem);
          p.acessorios = Number(formAcessorios);
          p.min_trabalho = 0;
          p.materiais = formMateriais.map((m, idx) => ({ id: idx + 1, produto_id: p.id, material_id: m.material_id, gramas: m.gramas }));
          p.insumos = formInsumos.map((i, idx) => ({ id: idx + 1, produto_id: p.id, insumo_id: i.insumo_id, qtd: i.qtd }));
        }
      } else {
        savedId = state.produtos.length > 0 ? Math.max(...state.produtos.map((x) => x.id)) + 1 : 1;
        state.produtos.push({
          ...dummyProd,
          id: savedId,
          preco: precoFinal,
          materiais: formMateriais.map((m, idx) => ({ id: idx + 1, produto_id: savedId!, material_id: m.material_id, gramas: m.gramas })),
          insumos: formInsumos.map((i, idx) => ({ id: idx + 1, produto_id: savedId!, insumo_id: i.insumo_id, qtd: i.qtd })),
        });
      }
    });

    setModoEdicao(false);
    setProdutoSelecionadoId(savedId);
  };

  const handleExcluirProduto = (id: number) => {
    const prod = data.produtos.find((x) => x.id === id);
    const nome = prod ? prod.nome : `Produto #${id}`;
    if (!confirm(`Deseja realmente excluir permanentemente o produto "${nome}"? Esta ação removerá o produto do catálogo e seu saldo de estoque.`)) {
      return;
    }
    db.update((state) => {
      state.produtos = state.produtos.filter((x) => x.id !== id);
      state.movimentos = state.movimentos.filter((m) => !(m.item_tipo === 'produto' && m.item_id === id));
    });
    setProdutoSelecionadoId(null);
  };

  const handleExportarCsv = () => {
    const cabecalhos = [
      'SKU',
      'Produto',
      'Categoria',
      'Tempo Impressão (min)',
      'Unidades por Lote',
      'Custo Produção (R$)',
      'Preço Venda (R$)',
      'Margem Real (%)',
      'Margem Alvo (%)',
      'Estoque Pronto (un)',
      'Estoque Mínimo (un)',
      'Impressora Padrão',
    ];
    const linhas = filtrados.map((p) => {
      const c = custoProduto(p, data.config, null, sdRolos).custo;
      const margemReal = p.preco > 0 ? ((p.preco - c) / p.preco) * 100 : 0;
      const slPronto = sdProdutos[p.id] || 0;
      const imp = p.impressora_id ? data.impressoras.find((i) => i.id === p.impressora_id)?.nome : 'Nenhuma';
      return [
        p.sku,
        p.nome,
        p.categoria || '',
        p.tempo_min,
        p.lote_qtd || 1,
        c.toFixed(2),
        p.preco.toFixed(2),
        margemReal.toFixed(1),
        p.margem_pct,
        slPronto,
        p.minimo || 0,
        imp || 'Nenhuma',
      ];
    });
    exportarTabelaParaCsv('produtos-catalogo', cabecalhos, linhas);
  };

  const handleExportarPrecosCanaisCsv = () => {
    if (!produtoAtual) return;
    const cabecalhos = ['Canal de Venda', 'Taxa (%)', 'Taxa Fixa (R$)', 'Preço Sugerido (R$)'];
    const linhas = data.canais.filter((c) => c.ativo).map((cn) => {
      const pCanal = custoProduto(produtoAtual, data.config, cn, sdRolos).preco;
      return [
        cn.nome,
        cn.taxa_pct,
        cn.taxa_fixa.toFixed(2),
        pCanal !== null && pCanal !== undefined ? pCanal.toFixed(2) : '0.00',
      ];
    });
    exportarTabelaParaCsv(`precos-canais-${produtoAtual.sku}`, cabecalhos, linhas);
  };

  // Live preview para o formulário
  const previewProd: Produto = {
    id: formId || 0,
    nome: formNome || 'Novo Produto',
    sku: formSku,
    categoria: formCategoria,
    foto: '',
    modelo: '',
    projeto_id: formProjetoId ? Number(formProjetoId) : null,
    tempo_min: Number(formTempoMin || 0),
    impressora_id: formImpressoraId ? Number(formImpressoraId) : null,
    preco: Number(formPreco || 0),
    preco_manual: formPrecoManual,
    margem_pct: Number(formMargemPct || 0),
    lote_qtd: Number(formLoteQtd || 1),
    fornecedor: '',
    minimo: Number(formMinimo || 0),
    embalagem: Number(formEmbalagem || 0),
    acessorios: Number(formAcessorios || 0),
    min_trabalho: 0,
    ativo: true,
    materiais: formMateriais.map((m, idx) => ({ id: idx, produto_id: 0, material_id: m.material_id, gramas: m.gramas })),
    insumos: formInsumos.map((i, idx) => ({ id: idx, produto_id: 0, insumo_id: i.insumo_id, qtd: i.qtd })),
  };

  const previewCalc = custoProduto(previewProd, data.config, null, sdRolos);

  // Se modo de edição
  if (modoEdicao) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2>{formId ? `Editar Produto: ${formNome}` : 'Novo Produto'}</h2>
          <button className="sec" onClick={() => setModoEdicao(false)}>
            Cancelar
          </button>
        </div>

        <form onSubmit={handleSalvarProduto}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {/* Lado esquerdo: Dados básicos e Receita */}
            <div className="card">
              <h4 style={{ margin: '0 0 10px' }}>Informações Básicas</h4>
              <label>Nome do Produto *</label>
              <input type="text" required value={formNome} onChange={(e) => setFormNome(e.target.value)} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label>Categoria</label>
                  <input
                    type="text"
                    list="cat-list"
                    value={formCategoria}
                    placeholder="Ex: Chaveiros, Decoração..."
                    onChange={(e) => handleCategoriaChange(e.target.value)}
                  />
                  <datalist id="cat-list">
                    {categorias.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label>SKU (2 iniciais da categoria)</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      value={formSku}
                      placeholder="Ex: CH0001"
                      onChange={(e) => setFormSku(e.target.value.toUpperCase())}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="sec"
                      style={{ padding: '0 8px', fontSize: 11 }}
                      title="Gerar código com as 2 iniciais da categoria"
                      onClick={() => setFormSku(gerarSku(formCategoria || 'Geral', data.produtos))}
                    >
                      ⚡ Gerar
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label>Tempo de Impressão (min)</label>
                  <input
                    type="number"
                    min="0"
                    value={formTempoMin}
                    onChange={(e) => setFormTempoMin(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label>Impressora Padrão</label>
                  <select
                    value={formImpressoraId}
                    onChange={(e) => setFormImpressoraId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">Nenhuma / Manual</option>
                    {data.impressoras.filter((i) => i.ativo).map((imp) => (
                      <option key={imp.id} value={imp.id}>
                        {imp.nome} ({imp.watts}W)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label>Unidades por Lote</label>
                <input
                  type="number"
                  min="1"
                  value={formLoteQtd}
                  onChange={(e) => setFormLoteQtd(Number(e.target.value))}
                />
              </div>

              <h4 style={{ margin: '16px 0 6px', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                Filamentos Utilizados (por lote)
              </h4>
              {formMateriais.map((mat, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <select
                    value={mat.material_id}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFormMateriais((prev) => {
                        const next = [...prev];
                        next[idx].material_id = val;
                        return next;
                      });
                    }}
                    style={{ flex: 1 }}
                  >
                    {data.materiais.filter((m) => m.ativo).length === 0 && (
                      <option value="0">Nenhum filamento cadastrado</option>
                    )}
                    {data.materiais.filter((m) => m.ativo).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.tipo} {m.cor} ({m.marca})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    value={mat.gramas}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFormMateriais((prev) => {
                        const next = [...prev];
                        next[idx].gramas = val;
                        return next;
                      });
                    }}
                    style={{ width: 80 }}
                  />
                  <span>g</span>
                  {formMateriais.length > 1 && (
                    <button
                      type="button"
                      className="sec bad"
                      style={{ padding: '2px 6px' }}
                      onClick={() => setFormMateriais((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                <button
                  type="button"
                  className="sec"
                  style={{ fontSize: 12, padding: '4px 8px' }}
                  onClick={() => setFormMateriais((prev) => [...prev, { material_id: data.materiais[0]?.id || 1, gramas: 10 }])}
                >
                  + Adicionar Outra Cor / Filamento
                </button>
                <button
                  type="button"
                  className="sec"
                  style={{ fontSize: 12, padding: '4px 8px' }}
                  onClick={() => {
                    const tipo = prompt('Tipo do material (ex: PLA, PETG, ABS):', 'PLA');
                    if (!tipo || !tipo.trim()) return;
                    const cor = prompt('Cor do filamento:', 'Preto') || 'Preto';
                    const marca = prompt('Marca do filamento:', 'Geral') || 'Geral';
                    db.update((state) => {
                      const nextId = state.materiais.length > 0 ? Math.max(...state.materiais.map((m) => m.id)) + 1 : 1;
                      state.materiais.push({
                        id: nextId,
                        tipo: tipo.trim().toUpperCase(),
                        cor: cor.trim(),
                        marca: marca.trim(),
                        minimo_g: 500,
                        ativo: true,
                      });
                      setFormMateriais((prev) => {
                        const next = [...prev];
                        if (next.length > 0 && (next[0].material_id === 0 || next[0].material_id === 1)) {
                          next[0].material_id = nextId;
                        }
                        return next;
                      });
                    });
                  }}
                >
                  ⚡ Cadastrar Novo Filamento
                </button>
              </div>

              <h4 style={{ margin: '16px 0 6px', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                Insumos / Embalagem
              </h4>
              {formInsumos.map((ins, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <select
                    value={ins.insumo_id}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFormInsumos((prev) => {
                        const next = [...prev];
                        next[idx].insumo_id = val;
                        return next;
                      });
                    }}
                    style={{ flex: 1 }}
                  >
                    {data.insumos.filter((i) => i.ativo).map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.nome} ({formatBrl(i.custo_unit)}/{i.unidade})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={ins.qtd}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFormInsumos((prev) => {
                        const next = [...prev];
                        next[idx].qtd = val;
                        return next;
                      });
                    }}
                    style={{ width: 80 }}
                  />
                  <button
                    type="button"
                    className="sec bad"
                    style={{ padding: '2px 6px' }}
                    onClick={() => setFormInsumos((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                {data.insumos.length > 0 && (
                  <button
                    type="button"
                    className="sec"
                    style={{ fontSize: 12, padding: '4px 8px' }}
                    onClick={() => setFormInsumos((prev) => [...prev, { insumo_id: data.insumos[0]?.id || 1, qtd: 1 }])}
                  >
                    + Adicionar Insumo da Receita
                  </button>
                )}
                <button
                  type="button"
                  className="sec"
                  style={{ fontSize: 12, padding: '4px 8px' }}
                  onClick={() => {
                    const nome = prompt('Nome do insumo (ex: Argola, Parafuso M3, Embalagem):');
                    if (!nome || !nome.trim()) return;
                    const custo = parseFloat(prompt('Custo unitário em R$:', '0.50') || '0.50');
                    const un = prompt('Unidade de medida (un, cm, m):', 'un') || 'un';
                    db.update((state) => {
                      const nextId = state.insumos.length > 0 ? Math.max(...state.insumos.map((i) => i.id)) + 1 : 1;
                      state.insumos.push({
                        id: nextId,
                        nome: nome.trim(),
                        unidade: un.trim(),
                        custo_unit: isNaN(custo) ? 0.5 : custo,
                        minimo: 10,
                        fornecedor: '',
                        ativo: true,
                      });
                      setFormInsumos((prev) => [...prev, { insumo_id: nextId, qtd: 1 }]);
                    });
                  }}
                >
                  ⚡ Cadastrar Novo Insumo
                </button>
              </div>
            </div>

            {/* Lado direito: Formação de Preço e Cálculo em tempo real */}
            <div className="card">
              <h4 style={{ margin: '0 0 10px' }}>Custos e Margem de Lucro</h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label>Margem Alvo (%)</label>
                  <input
                    type="number"
                    value={formMargemPct}
                    onChange={(e) => setFormMargemPct(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label>Embalagem Extra (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formEmbalagem}
                    onChange={(e) => setFormEmbalagem(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Demonstração de Custo ao Vivo */}
              <div
                style={{
                  background: 'var(--col)',
                  borderRadius: 8,
                  padding: '12px 14px',
                  marginTop: 14,
                  fontSize: 13,
                }}
              >
                <b style={{ display: 'block', marginBottom: 8, color: 'var(--p)' }}>
                  Composição de Custo do Lote ({formLoteQtd} un):
                </b>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                  <span>Filamento:</span>
                  <b>{formatBrl(previewCalc.filamento)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                  <span>Energia Elétrica:</span>
                  <span>{formatBrl(previewCalc.energia)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                  <span>Depreciação + Manutenção:</span>
                  <span>{formatBrl(previewCalc.deprec)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                  <span>Margem de Falha ({data.config.falhas_pct}%):</span>
                  <span>{formatBrl(previewCalc.falhas)}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--border)',
                    marginTop: 6,
                    paddingTop: 6,
                    fontSize: 14,
                  }}
                >
                  <b>Custo Unitário da Peça:</b>
                  <b className="bad">{formatBrl(previewCalc.custo)}</b>
                </div>
              </div>

              {/* Preço de Venda */}
              <div style={{ marginTop: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: 6 }}>
                  <input
                    type="checkbox"
                    checked={formPrecoManual}
                    onChange={(e) => {
                      setFormPrecoManual(e.target.checked);
                      if (!e.target.checked && previewCalc.preco) {
                        setFormPreco(previewCalc.preco);
                      }
                    }}
                    style={{ width: 'auto' }}
                  />
                  <span>Digitar preço de venda manualmente (desativa sugestão automática)</span>
                </label>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="number"
                    step="0.01"
                    disabled={!formPrecoManual}
                    value={formPrecoManual ? formPreco : (previewCalc.preco || 0)}
                    onChange={(e) => setFormPreco(Number(e.target.value))}
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      background: formPrecoManual ? 'var(--input)' : 'var(--col)',
                    }}
                  />
                  {!formPrecoManual && (
                    <span className="tag ok" style={{ whiteSpace: 'nowrap' }}>
                      Sugerido ({formMargemPct}% margem)
                    </span>
                  )}
                </div>
              </div>

              {/* Tabela de Preço por Canal de Venda */}
              <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                <small className="muted" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  PREÇO SUGERIDO POR CANAL DE VENDA:
                </small>
                {data.canais.filter((c) => c.ativo).map((cn) => {
                  const precoCanal = custoProduto(previewProd, data.config, cn, sdRolos).preco;
                  return (
                    <div
                      key={cn.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '3px 0',
                        fontSize: 13,
                      }}
                    >
                      <span>{cn.nome}:</span>
                      <b>{formatBrl(precoCanal)}</b>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
                <button type="button" className="sec" onClick={() => setModoEdicao(false)}>
                  Cancelar
                </button>
                <button type="submit">Salvar Produto</button>
              </div>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // Se visualizando ficha do produto
  if (produtoAtual) {
    const custo = custoProduto(produtoAtual, data.config, null, sdRolos).custo;
    const margemReal = produtoAtual.preco > 0 ? ((produtoAtual.preco - custo) / produtoAtual.preco) * 100 : 0;
    const estoquePronto = sdProdutos[produtoAtual.id] || 0;
    const imp = produtoAtual.impressora_id ? data.impressoras.find((i) => i.id === produtoAtual.impressora_id) : null;

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <button className="sec" onClick={() => setProdutoSelecionadoId(null)} style={{ marginRight: 8 }}>
              ← Catálogo
            </button>
            <h2 style={{ display: 'inline', verticalAlign: 'middle' }}>{produtoAtual.nome}</h2>
            <span className="tag" style={{ marginLeft: 8 }}>{produtoAtual.sku}</span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => handleEditar(produtoAtual)}>Editar Ficha</button>
            <button className="sec bad" onClick={() => handleExcluirProduto(produtoAtual.id)} title="Excluir produto permanentemente">
              Excluir Produto
            </button>
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 16 }}>
          <div className="card">
            <h4 style={{ margin: '0 0 8px' }}>Ficha Técnica</h4>
            <p style={{ margin: '4px 0' }}><b>Categoria:</b> {produtoAtual.categoria || 'Geral'}</p>
            <p style={{ margin: '4px 0' }}><b>Tempo de Impressão:</b> {produtoAtual.tempo_min} minutos ({(produtoAtual.tempo_min / 60).toFixed(1)} h)</p>
            <p style={{ margin: '4px 0' }}><b>Impressora Padrão:</b> {imp?.nome || 'Nenhuma'}</p>
            <p style={{ margin: '4px 0' }}><b>Unidades por Lote:</b> {produtoAtual.lote_qtd}</p>
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
              <b>Estoque Pronto:</b>{' '}
              <span className={`tag ${estoquePronto <= produtoAtual.minimo ? (estoquePronto <= 0 ? 'acabou' : 'acabando') : 'ativa'}`}>
                {estoquePronto} unidade(s)
              </span>
              {produtoAtual.minimo > 0 && <small className="muted"> (mínimo: {produtoAtual.minimo})</small>}
            </div>
          </div>

          <div className="card kpi">
            <small>Preço de Venda</small>
            <h2>{formatBrl(produtoAtual.preco)}</h2>
            <small>Custo de Produção: <b>{formatBrl(custo)}</b></small>
            <div style={{ marginTop: 8 }}>
              <span className={`tag ${margemReal >= produtoAtual.margem_pct ? 'ok' : 'bad'}`}>
                Margem Real: {formatDec(margemReal, 1)}% (Meta: {produtoAtual.margem_pct}%)
              </span>
            </div>
            <small className="muted" style={{ display: 'block', marginTop: 4 }}>
              Lucro Unitário: <b>{formatBrl(produtoAtual.preco - custo)}</b>
            </small>
          </div>
        </div>

        {/* Tabela de preços em cada canal de venda */}
        <div className="card wrap" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h4 style={{ margin: 0 }}>Preços Sugeridos nos Canais de Venda</h4>
            <button
              type="button"
              className="sec"
              style={{ fontSize: 12, padding: '3px 8px' }}
              onClick={handleExportarPrecosCanaisCsv}
              title="Exportar preços por canal para CSV"
            >
              📥 Exportar CSV
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Canal</th>
                <th>Taxa %</th>
                <th>Taxa Fixa</th>
                <th>Preço Sugerido</th>
              </tr>
            </thead>
            <tbody>
              {data.canais.filter((c) => c.ativo).map((cn) => {
                const pCanal = custoProduto(produtoAtual, data.config, cn, sdRolos).preco;
                return (
                  <tr key={cn.id}>
                    <td><b>{cn.nome}</b></td>
                    <td>{cn.taxa_pct}%</td>
                    <td>{formatBrl(cn.taxa_fixa)}</td>
                    <td className="ok"><b>{formatBrl(pCanal)}</b></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Lista padrão do catálogo
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0 }}>Produtos Cadastrados ({produtosAtivos.length})</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="sec"
            onClick={handleExportarCsv}
            title="Exportar catálogo de produtos exibidos para arquivo CSV"
            disabled={filtrados.length === 0}
          >
            📥 Exportar CSV
          </button>
          <button onClick={handleIniciarNovo}>+ Novo Produto</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Buscar produto ou SKU..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />

        {categorias.length > 0 && (
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            style={{ width: 180 }}
          >
            <option value="">Todas as categorias</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="card wrap">
        {filtrados.length === 0 ? (
          <p className="muted" style={{ padding: 12 }}>
            Nenhum produto cadastrado.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Custo</th>
                <th>Preço</th>
                <th>Margem Real</th>
                <th>Estoque Pronto</th>
                <th className="r">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => {
                const c = custoProduto(p, data.config, null, sdRolos).custo;
                const margemReal = p.preco > 0 ? ((p.preco - c) / p.preco) * 100 : 0;
                const slPronto = sdProdutos[p.id] || 0;
                const abaixoMargem = margemReal < p.margem_pct;

                return (
                  <tr key={p.id}>
                    <td><code>{p.sku}</code></td>
                    <td>
                      <a
                        href={`#produto-${p.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          setProdutoSelecionadoId(p.id);
                        }}
                        style={{ fontWeight: 600 }}
                      >
                        {p.nome}
                      </a>
                    </td>
                    <td>{p.categoria || '-'}</td>
                    <td>{formatBrl(c)}</td>
                    <td><b>{formatBrl(p.preco)}</b></td>
                    <td>
                      <span className={abaixoMargem ? 'bad' : 'ok'}>
                        {formatDec(margemReal, 1)}%
                      </span>
                    </td>
                    <td>
                      <span className={`tag ${slPronto <= p.minimo ? (slPronto <= 0 ? 'acabou' : 'acabando') : ''}`}>
                        {slPronto} un
                      </span>
                    </td>
                    <td className="r">
                      <button
                        className="sec"
                        style={{ padding: '3px 8px', fontSize: 13, marginRight: 6 }}
                        onClick={() => setProdutoSelecionadoId(p.id)}
                      >
                        Ficha
                      </button>
                      <button
                        className="sec"
                        style={{ padding: '3px 8px', fontSize: 13, marginRight: 6 }}
                        onClick={() => handleEditar(p)}
                      >
                        Editar
                      </button>
                      <button
                        className="sec bad"
                        style={{ padding: '3px 8px', fontSize: 13 }}
                        onClick={() => handleExcluirProduto(p.id)}
                        title="Excluir produto permanentemente"
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
