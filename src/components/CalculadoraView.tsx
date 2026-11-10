import React, { useState } from 'react';
import { calcular, formatBrl, formatDec } from '../calc';
import { db } from '../db';
import { custoGMaterial, saldos } from '../services';
import { NavTab } from './Navigation';

interface CalculadoraViewProps {
  onNavigate: (tab: NavTab, extra?: any) => void;
}

export const CalculadoraView: React.FC<CalculadoraViewProps> = ({ onNavigate }) => {
  const data = db.get();
  const cfg = data.config;
  const sdRolos = saldos('rolo');

  const [filamentos, setFilamentos] = useState<
    Array<{ material_id: number | ''; g: number; precoManual: number; pesoRoloManual: number }>
  >([
    {
      material_id: data.materiais[0]?.id || '',
      g: 35,
      precoManual: 100,
      pesoRoloManual: 1000,
    },
  ]);

  const [impressoraId, setImpressoraId] = useState<number | ''>(data.impressoras[0]?.id || '');
  const [horas, setHoras] = useState<number>(1.5);
  const [minTrabalho, setMinTrabalho] = useState<number>(10);
  const [embalagem, setEmbalagem] = useState<number>(1.5);
  const [acessorios, setAcessorios] = useState<number>(0.5);
  const [margemPct, setMargemPct] = useState<number>(Number(cfg.margem_pct || 40));
  const [lote, setLote] = useState<number>(1);
  const [nomeProdutoSalvar, setNomeProdutoSalvar] = useState<string>('');
  const [modalSalvar, setModalSalvar] = useState<boolean>(false);

  // Calcula custo de filamento total
  let filamentoTotal = 0;
  const detalheFilamentos: Array<{ nome: string; g: number; custoG: number; total: number }> = [];

  for (const f of filamentos) {
    if (f.g <= 0) continue;
    let cg = 0;
    let nome = 'Filamento';
    if (f.material_id) {
      const mat = data.materiais.find((m) => m.id === Number(f.material_id));
      nome = mat ? `${mat.tipo} ${mat.cor} (${mat.marca})` : 'Material';
      cg = custoGMaterial(Number(f.material_id), sdRolos);
    } else {
      nome = 'Manual';
      cg = f.pesoRoloManual > 0 ? f.precoManual / f.pesoRoloManual : 0;
    }
    const custo = f.g * cg;
    filamentoTotal += custo;
    detalheFilamentos.push({ nome, g: f.g, custoG: cg, total: custo });
  }

  const imp = impressoraId ? data.impressoras.find((i) => i.id === Number(impressoraId)) || null : null;

  const resultado = calcular(
    cfg,
    imp,
    filamentoTotal,
    horas,
    embalagem,
    acessorios,
    minTrabalho,
    margemPct,
    0,
    0,
    lote
  );

  const handleSalvarComoProduto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeProdutoSalvar.trim()) return;

    db.update((state) => {
      const nextId = state.produtos.length > 0 ? Math.max(...state.produtos.map((p) => p.id)) + 1 : 1;
      const sku = `P${String(nextId).padStart(4, '0')}`;

      state.produtos.push({
        id: nextId,
        nome: nomeProdutoSalvar.trim(),
        sku,
        categoria: 'Calculadora',
        foto: '',
        modelo: '',
        projeto_id: null,
        tempo_min: Math.round(horas * 60),
        impressora_id: impressoraId ? Number(impressoraId) : null,
        preco: resultado.preco || 0,
        preco_manual: false,
        margem_pct: margemPct,
        lote_qtd: lote,
        fornecedor: '',
        minimo: 0,
        embalagem,
        acessorios,
        min_trabalho: minTrabalho,
        ativo: true,
        materiais: filamentos
          .filter((f) => f.material_id && f.g > 0)
          .map((f, idx) => ({
            id: idx + 1,
            produto_id: nextId,
            material_id: Number(f.material_id),
            gramas: f.g,
          })),
        insumos: [],
      });
    });

    setModalSalvar(false);
    onNavigate('produtos');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Calculadora de Custos e Precificação 3D</h2>
        <button onClick={() => setModalSalvar(true)}>Salvar como Produto</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {/* Parâmetros de Entrada */}
        <div className="card">
          <h4 style={{ margin: '0 0 10px' }}>Parâmetros da Impressão</h4>

          <h5 style={{ margin: '8px 0 4px', color: 'var(--muted)', textTransform: 'uppercase', fontSize: 11 }}>
            Filamentos (gasto no lote)
          </h5>
          {filamentos.map((f, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <select
                value={f.material_id}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : '';
                  setFilamentos((prev) => {
                    const next = [...prev];
                    next[idx].material_id = val;
                    return next;
                  });
                }}
                style={{ flex: 1 }}
              >
                <option value="">Manual (digitar preço)</option>
                {data.materiais.filter((m) => m.ativo).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.tipo} {m.cor} ({m.marca}) — {formatBrl(custoGMaterial(m.id, sdRolos))}/g
                  </option>
                ))}
              </select>

              {!f.material_id && (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input
                    type="number"
                    placeholder="R$ rolo"
                    value={f.precoManual}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFilamentos((prev) => {
                        const next = [...prev];
                        next[idx].precoManual = val;
                        return next;
                      });
                    }}
                    style={{ width: 75 }}
                  />
                </div>
              )}

              <input
                type="number"
                min="0"
                value={f.g}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setFilamentos((prev) => {
                    const next = [...prev];
                    next[idx].g = val;
                    return next;
                  });
                }}
                style={{ width: 75 }}
              />
              <span>g</span>

              {filamentos.length > 1 && (
                <button
                  type="button"
                  className="sec bad"
                  style={{ padding: '2px 6px' }}
                  onClick={() => setFilamentos((prev) => prev.filter((_, i) => i !== idx))}
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            className="sec"
            style={{ fontSize: 12, padding: '3px 8px', marginBottom: 12 }}
            onClick={() => setFilamentos((prev) => [...prev, { material_id: data.materiais[0]?.id || '', g: 10, precoManual: 100, pesoRoloManual: 1000 }])}
          >
            + Adicionar Cor / Filamento
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label>Tempo de Impressão (horas)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={horas}
                onChange={(e) => setHoras(Number(e.target.value))}
              />
              <small className="muted">Equivale a {Math.round(horas * 60)} min</small>
            </div>

            <div>
              <label>Impressora 3D</label>
              <select
                value={impressoraId}
                onChange={(e) => setImpressoraId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Nenhuma / Sem custo de máquina</option>
                {data.impressoras.filter((i) => i.ativo).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nome} ({i.watts} W)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label>Peças no Lote</label>
              <input type="number" min="1" value={lote} onChange={(e) => setLote(Number(e.target.value))} />
            </div>

            <div>
              <label>Mão de Obra (min)</label>
              <input type="number" min="0" value={minTrabalho} onChange={(e) => setMinTrabalho(Number(e.target.value))} />
            </div>

            <div>
              <label>Margem Desejada (%)</label>
              <input type="number" value={margemPct} onChange={(e) => setMargemPct(Number(e.target.value))} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label>Embalagem (R$)</label>
              <input
                type="number"
                step="0.01"
                value={embalagem}
                onChange={(e) => setEmbalagem(Number(e.target.value))}
              />
            </div>
            <div>
              <label>Acessórios / Insumos (R$)</label>
              <input
                type="number"
                step="0.01"
                value={acessorios}
                onChange={(e) => setAcessorios(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Resultado e Comparativo por Canal */}
        <div className="card">
          <h4 style={{ margin: '0 0 10px' }}>Resultado do Cálculo</h4>

          <div style={{ background: 'var(--col)', borderRadius: 8, padding: '12px 16px', marginBottom: 14 }}>
            <b style={{ display: 'block', color: 'var(--p)', marginBottom: 6 }}>
              Detalhamento de Custos (Lote de {resultado.lote} un):
            </b>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span>Filamento total:</span>
              <b>{formatBrl(resultado.filamento)}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span>Energia elétrica ({cfg.kwh} R$/kWh):</span>
              <span>{formatBrl(resultado.energia)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span>Depreciação + Manutenção da máquina:</span>
              <span>{formatBrl(resultado.deprec)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span>Mão de obra ({minTrabalho} min):</span>
              <span>{formatBrl(resultado.mao)}</span>
            </div>
            {resultado.rateio > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span>Rateio de custos fixos:</span>
                <span>{formatBrl(resultado.rateio)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span>Embalagem e Acessórios:</span>
              <span>{formatBrl(resultado.embalagem + resultado.acessorios)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span>Margem de Falhas ({cfg.falhas_pct}%):</span>
              <span>{formatBrl(resultado.falhas)}</span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                borderTop: '2px solid var(--border)',
                marginTop: 8,
                paddingTop: 8,
                fontSize: 16,
              }}
            >
              <b>Custo Unitário da Peça:</b>
              <b className="bad">{formatBrl(resultado.custo)}</b>
            </div>
          </div>

          {/* Preço de Venda Sugerido */}
          <div
            style={{
              background: 'var(--card)',
              border: '2px solid var(--ok)',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <small className="muted" style={{ fontWeight: 600 }}>PREÇO SUGERIDO (Balcão / PIX)</small>
                <h2 className="ok" style={{ margin: '2px 0' }}>
                  {formatBrl(resultado.preco)} <span style={{ fontSize: 14, fontWeight: 400 }}>/ unidade</span>
                </h2>
                {resultado.lote > 1 && (
                  <small className="muted">Total do lote ({resultado.lote} un): {formatBrl(resultado.preco_lote)}</small>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="tag ok" style={{ fontSize: 13 }}>
                  Lucro: <b>{formatBrl(resultado.lucro)}</b>
                </span>
                <small className="muted" style={{ display: 'block', marginTop: 4 }}>
                  Margem: {margemPct}%
                </small>
              </div>
            </div>
          </div>

          {/* Comparativo de Preço por Canal */}
          <div className="wrap">
            <h5 style={{ margin: '0 0 8px', fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>
              Preço Sugerido por Canal de Venda:
            </h5>
            <table>
              <thead>
                <tr>
                  <th>Canal</th>
                  <th>Taxas</th>
                  <th>Preço Sugerido</th>
                  <th>Lucro Líquido</th>
                </tr>
              </thead>
              <tbody>
                {data.canais.filter((c) => c.ativo).map((cn) => {
                  const resCanal = calcular(
                    cfg,
                    imp,
                    filamentoTotal,
                    horas,
                    embalagem,
                    acessorios,
                    minTrabalho,
                    margemPct,
                    cn.taxa_pct,
                    cn.taxa_fixa,
                    lote
                  );
                  return (
                    <tr key={cn.id}>
                      <td><b>{cn.nome}</b></td>
                      <td>{cn.taxa_pct}% {cn.taxa_fixa > 0 ? `+ ${formatBrl(cn.taxa_fixa)}` : ''}</td>
                      <td className="ok"><b>{formatBrl(resCanal.preco)}</b></td>
                      <td>{formatBrl(resCanal.lucro)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal para salvar como produto */}
      {modalSalvar && (
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
            <h3>Salvar como Produto Cadastrado</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>
              Este item será cadastrado no seu catálogo de produtos com os filamentos, tempo e custos calculados acima.
            </p>
            <form onSubmit={handleSalvarComoProduto}>
              <label>Nome do Produto *</label>
              <input
                type="text"
                required
                placeholder="Ex: Luminária Lua 3D"
                value={nomeProdutoSalvar}
                onChange={(e) => setNomeProdutoSalvar(e.target.value)}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" className="sec" onClick={() => setModalSalvar(false)}>
                  Cancelar
                </button>
                <button type="submit">Salvar Produto</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
