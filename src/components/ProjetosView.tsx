import React, { useState } from 'react';
import { db } from '../db';
import { Projeto } from '../types';
import { NavTab } from './Navigation';

interface ProjetosViewProps {
  onNavigate: (tab: NavTab, extra?: any) => void;
  projetoId?: number | null;
}

export const ProjetosView: React.FC<ProjetosViewProps> = ({ onNavigate, projetoId }) => {
  const data = db.get();
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [projetoSelecionadoId, setProjetoSelecionadoId] = useState<number | null>(projetoId || null);
  const [modalNovo, setModalNovo] = useState(false);

  // Form State
  const [formNome, setFormNome] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formCategoria, setFormCategoria] = useState('');
  const [formPesoG, setFormPesoG] = useState(25);
  const [formTempoMin, setFormTempoMin] = useState(45);
  const [formArquivoNome, setFormArquivoNome] = useState('');

  const categorias = Array.from(new Set(data.projetos.map((p) => p.categoria).filter(Boolean)));
  const projetosAtivos = data.projetos.filter((p) => p.ativo);

  const filtrados = projetosAtivos.filter((p) => {
    const matchBusca = !busca.trim() || p.nome.toLowerCase().includes(busca.toLowerCase()) || p.descricao.toLowerCase().includes(busca.toLowerCase());
    const matchCat = !filtroCategoria || p.categoria === filtroCategoria;
    return matchBusca && matchCat;
  });

  const projetoAtual = projetoSelecionadoId ? data.projetos.find((p) => p.id === projetoSelecionadoId) : null;
  const produtosUsando = projetoAtual ? data.produtos.filter((p) => p.projeto_id === projetoAtual.id && p.ativo) : [];

  const handleSalvarProjeto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNome.trim()) return;

    let savedId = 1;
    db.update((state) => {
      savedId = state.projetos.length > 0 ? Math.max(...state.projetos.map((p) => p.id)) + 1 : 1;
      state.projetos.unshift({
        id: savedId,
        nome: formNome.trim(),
        descricao: formDescricao.trim(),
        categoria: formCategoria.trim() || 'Geral',
        arquivo: `/uploads/${formArquivoNome.trim() || 'modelo.stl'}`,
        arquivo_nome: formArquivoNome.trim() || 'modelo.stl',
        tamanho: 450000,
        foto: '',
        peso_g: Number(formPesoG),
        tempo_min: Number(formTempoMin),
        criado_em: new Date().toISOString(),
        ativo: true,
      });
    });

    setModalNovo(false);
    setProjetoSelecionadoId(savedId);
  };

  const handleArquivar = (id: number) => {
    if (!confirm('Deseja arquivar este arquivo de projeto?')) return;
    db.update((state) => {
      const p = state.projetos.find((x) => x.id === id);
      if (p) p.ativo = false;
    });
    setProjetoSelecionadoId(null);
  };

  // Se visualizando ficha do projeto
  if (projetoAtual) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <button className="sec" onClick={() => setProjetoSelecionadoId(null)} style={{ marginRight: 8 }}>
              ← Todos os Projetos
            </button>
            <h2 style={{ display: 'inline', verticalAlign: 'middle' }}>{projetoAtual.nome}</h2>
            <span className="tag" style={{ marginLeft: 8 }}>{projetoAtual.categoria}</span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                alert(`Download iniciado para ${projetoAtual.arquivo_nome}`);
              }}
            >
              📥 Baixar Arquivo ({projetoAtual.arquivo_nome})
            </button>
            <button className="sec bad" onClick={() => handleArquivar(projetoAtual.id)}>
              Arquivar
            </button>
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 16 }}>
          <div className="card">
            <h4 style={{ margin: '0 0 8px' }}>Dados do Fatiamento</h4>
            <p style={{ margin: '4px 0' }}><b>Arquivo:</b> <code>{projetoAtual.arquivo_nome}</code></p>
            <p style={{ margin: '4px 0' }}><b>Peso Estimado no Fatiador:</b> <b>{projetoAtual.peso_g} g</b></p>
            <p style={{ margin: '4px 0' }}><b>Tempo de Impressão Estimado:</b> <b>{projetoAtual.tempo_min} min</b> ({(projetoAtual.tempo_min / 60).toFixed(1)} h)</p>
            <p style={{ margin: '4px 0' }}><b>Tamanho do Arquivo:</b> {(projetoAtual.tamanho / 1024).toFixed(1)} KB</p>
            {projetoAtual.descricao && (
              <p style={{ margin: '8px 0 0', borderTop: '1px solid var(--line)', paddingTop: 6, color: 'var(--muted)' }}>
                {projetoAtual.descricao}
              </p>
            )}
          </div>

          <div className="card">
            <h4 style={{ margin: '0 0 8px' }}>Produtos Vinculados ({produtosUsando.length})</h4>
            {produtosUsando.length === 0 ? (
              <div>
                <p className="muted">Nenhum produto cadastrado com este arquivo ainda.</p>
                <button
                  className="sec"
                  onClick={() => onNavigate('produtos')}
                  style={{ marginTop: 8 }}
                >
                  + Criar Produto com este Projeto
                </button>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Produto</th>
                    <th>Preço</th>
                  </tr>
                </thead>
                <tbody>
                  {produtosUsando.map((prod) => (
                    <tr key={prod.id}>
                      <td><code>{prod.sku}</code></td>
                      <td>
                        <a
                          href={`#prod-${prod.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            onNavigate('produtos', { produtoId: prod.id });
                          }}
                        >
                          {prod.nome}
                        </a>
                      </td>
                      <td>R$ {prod.preco.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Galeria de projetos 3D
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Modelos e Projetos 3D ({projetosAtivos.length})</h2>
        <button onClick={() => setModalNovo(true)}>+ Adicionar Projeto / STL / 3MF</button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Buscar projeto ou descrição..."
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {filtrados.map((p) => (
          <div
            key={p.id}
            className="card"
            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <span className="tag">{p.categoria || '3D'}</span>
                <small className="muted">{p.peso_g} g · {p.tempo_min} min</small>
              </div>

              <h4 style={{ margin: '4px 0 6px' }}>{p.nome}</h4>
              <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--muted)', minHeight: 38 }}>
                {p.descricao || 'Sem descrição adicional.'}
              </p>
            </div>

            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <code style={{ fontSize: 11 }}>{p.arquivo_nome}</code>
              <button
                className="sec"
                style={{ padding: '3px 8px', fontSize: 12 }}
                onClick={() => setProjetoSelecionadoId(p.id)}
              >
                Ver Detalhes
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Enviar Projeto */}
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
            <h3>Cadastrar Novo Projeto 3D</h3>
            <form onSubmit={handleSalvarProjeto}>
              <label>Nome do Projeto *</label>
              <input
                type="text"
                required
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                placeholder="Ex: Suporte de Headset Articulado"
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label>Categoria</label>
                  <input
                    type="text"
                    value={formCategoria}
                    onChange={(e) => setFormCategoria(e.target.value)}
                    placeholder="Chaveiros, Decoração..."
                  />
                </div>
                <div>
                  <label>Nome do Arquivo (STL, 3MF...)</label>
                  <input
                    type="text"
                    value={formArquivoNome}
                    onChange={(e) => setFormArquivoNome(e.target.value)}
                    placeholder="suporte-headset.3mf"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label>Peso Fatiado (g)</label>
                  <input
                    type="number"
                    min="0"
                    value={formPesoG}
                    onChange={(e) => setFormPesoG(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label>Tempo Estimado (min)</label>
                  <input
                    type="number"
                    min="0"
                    value={formTempoMin}
                    onChange={(e) => setFormTempoMin(Number(e.target.value))}
                  />
                </div>
              </div>

              <label>Descrição e Orientações de Impressão</label>
              <textarea
                rows={2}
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                placeholder="Ex: Altura de camada 0.2mm, sem suportes, 15% preenchimento..."
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" className="sec" onClick={() => setModalNovo(false)}>
                  Cancelar
                </button>
                <button type="submit">Salvar Projeto</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
