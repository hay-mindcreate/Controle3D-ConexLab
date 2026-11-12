import React, { useState } from 'react';
import {
  baixarArquivoSnapshot,
  executarBackup,
  excluirSnapshot,
  obterConfigBackup,
  obterSnapshotsBackup,
  restaurarSnapshot,
} from '../backupScheduler';
import { formatBrl } from '../calc';
import { db } from '../db';
import {
  baixarModeloCsv,
  exportarBackupExcel,
  ImportResult,
  processarArquivoImportacao,
} from '../importExport';
import { BackupAgendamento, BackupSnapshot, Canal, Config, Impressora } from '../types';
import { NavTab } from './Navigation';

interface ConfigViewProps {
  onNavigate: (tab: NavTab, extra?: any) => void;
}

export const ConfigView: React.FC<ConfigViewProps> = ({ onNavigate }) => {
  const data = db.get();
  const [config, setConfig] = useState<Config>({ ...data.config });
  const [msgSucesso, setMsgSucesso] = useState('');

  // Impressora Modal
  const [modalImp, setModalImp] = useState(false);
  const [impEdicao, setImpEdicao] = useState<Partial<Impressora> | null>(null);

  // Canal Modal
  const [modalCanal, setModalCanal] = useState(false);
  const [canalEdicao, setCanalEdicao] = useState<Partial<Canal> | null>(null);

  // Importação Modal
  const [modalImportar, setModalImportar] = useState(false);
  const [arquivoImportar, setArquivoImportar] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const [resultadoImportacao, setResultadoImportacao] = useState<ImportResult | null>(null);

  // Agendamento de Backup Automático
  const [agendamentoBackup, setAgendamentoBackup] = useState<BackupAgendamento>(obterConfigBackup(data.config));
  const [snapshots, setSnapshots] = useState<BackupSnapshot[]>(obterSnapshotsBackup());
  const [executandoBackupManual, setExecutandoBackupManual] = useState(false);
  const [msgBackup, setMsgBackup] = useState('');

  const handleSalvarConfig = (e: React.FormEvent) => {
    e.preventDefault();
    db.update((state) => {
      state.config = { ...config };
    });
    setMsgSucesso('Configurações salvas com sucesso!');
    setTimeout(() => setMsgSucesso(''), 4000);
  };

  const handleSalvarImpressora = (e: React.FormEvent) => {
    e.preventDefault();
    if (!impEdicao || !impEdicao.nome) return;
    const nome = impEdicao.nome.trim();
    if (!nome) return;

    db.update((state) => {
      if (impEdicao.id) {
        const i = state.impressoras.find((x) => x.id === impEdicao.id);
        if (i) Object.assign(i, impEdicao, { nome });
      } else {
        const nextId = state.impressoras.length > 0 ? Math.max(...state.impressoras.map((x) => x.id)) + 1 : 1;
        state.impressoras.push({
          id: nextId,
          nome,
          watts: Number(impEdicao.watts || 100),
          valor: Number(impEdicao.valor || 3000),
          vida_h: Number(impEdicao.vida_h || 4000),
          horas_acumuladas: Number(impEdicao.horas_acumuladas || 0),
          manutencao_h: Number(impEdicao.manutencao_h || 0),
          ativo: true,
        });
      }
    });

    setModalImp(false);
    setImpEdicao(null);
  };

  const handleSalvarCanal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canalEdicao || !canalEdicao.nome) return;
    const nome = canalEdicao.nome.trim();
    if (!nome) return;

    db.update((state) => {
      if (canalEdicao.id) {
        const c = state.canais.find((x) => x.id === canalEdicao.id);
        if (c) Object.assign(c, canalEdicao, { nome });
      } else {
        const nextId = state.canais.length > 0 ? Math.max(...state.canais.map((x) => x.id)) + 1 : 1;
        state.canais.push({
          id: nextId,
          nome,
          taxa_pct: Number(canalEdicao.taxa_pct || 0),
          taxa_fixa: Number(canalEdicao.taxa_fixa || 0),
          ativo: true,
        });
      }
    });

    setModalCanal(false);
    setCanalEdicao(null);
  };

  const handleDesativarCanal = (id: number) => {
    if (!confirm('Deseja remover este canal de venda?')) return;
    db.update((state) => {
      const c = state.canais.find((x) => x.id === id);
      if (c) c.ativo = false;
    });
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

  const handleDownloadBackup = () => {
    const jsonStr = JSON.stringify(db.get(), null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-controle-3d-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestaurarBackupArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result as string;
        db.importJson(content);
        alert('Backup restaurado com sucesso!');
        window.location.reload();
      } catch (err) {
        alert('Erro ao restaurar arquivo de backup: ' + err);
      }
    };
    reader.readAsText(file);
  };

  const handleZerarBancoLimpo = () => {
    if (confirm('Atenção: Isso irá APAGAR TODOS os dados existentes (clientes, produtos, estoque, pedidos, orçamentos, vendas e financeiro), deixando o sistema 100% limpo para você cadastrar seus dados reais. Deseja continuar?')) {
      db.limparTodosDados();
      alert('Sistema zerado com sucesso! Todos os dados de teste foram removidos e o sistema está limpo.');
    }
  };

  const handleSalvarAgendamento = (e: React.FormEvent) => {
    e.preventDefault();
    db.update((state) => {
      state.config.backup_agendamento = { ...agendamentoBackup };
    });
    setMsgBackup('Configurações de agendamento de backup salvas com sucesso!');
    setTimeout(() => setMsgBackup(''), 4000);
  };

  const handleExecutarBackupAgora = async () => {
    setExecutandoBackupManual(true);
    try {
      const res = await executarBackup({
        formato: agendamentoBackup.formato,
        baixar: true,
        ehAgendado: false,
      });
      setAgendamentoBackup(obterConfigBackup(db.get().config));
      setSnapshots(obterSnapshotsBackup());
      setMsgBackup(`✓ ${res.mensagem} Arquivo gerado e histórico atualizado.`);
      setTimeout(() => setMsgBackup(''), 5000);
    } catch (err: any) {
      alert('Erro ao executar backup: ' + (err?.message || err));
    } finally {
      setExecutandoBackupManual(false);
    }
  };

  const handleRestaurarSnapshot = (snap: BackupSnapshot) => {
    if (
      confirm(
        `Atenção: Deseja restaurar o backup de ${new Date(snap.data).toLocaleString('pt-BR')}? Todos os dados atuais serão substituídos por este backup.`
      )
    ) {
      if (restaurarSnapshot(snap.id)) {
        alert('Backup restaurado com sucesso!');
        window.location.reload();
      }
    }
  };

  const handleExcluirSnapshot = (id: string) => {
    if (confirm('Deseja remover este backup do histórico?')) {
      excluirSnapshot(id);
      setSnapshots(obterSnapshotsBackup());
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Configurações do Sistema</h2>
      </div>

      {msgSucesso && <div className="msg">{msgSucesso}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {/* Parâmetros de Custos e Oficina */}
        <div className="card">
          <h4 style={{ margin: '0 0 10px' }}>Parâmetros de Custo de Impressão</h4>
          <form onSubmit={handleSalvarConfig}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label>Energia Elétrica (R$/kWh)</label>
                <input
                  type="number"
                  step="0.01"
                  value={config.kwh}
                  onChange={(e) => setConfig({ ...config, kwh: Number(e.target.value) })}
                />
              </div>

              <div>
                <label>Valor da Hora de Trabalho (R$/h)</label>
                <input
                  type="number"
                  step="0.01"
                  value={config.hora_trabalho}
                  onChange={(e) => setConfig({ ...config, hora_trabalho: Number(e.target.value) })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label>Margem de Falhas Padrão (%)</label>
                <input
                  type="number"
                  value={config.falhas_pct}
                  onChange={(e) => setConfig({ ...config, falhas_pct: Number(e.target.value) })}
                />
              </div>

              <div>
                <label>Margem de Lucro Alvo (%)</label>
                <input
                  type="number"
                  value={config.margem_pct}
                  onChange={(e) => setConfig({ ...config, margem_pct: Number(e.target.value) })}
                />
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <label>Mão de Obra sobre o Lucro Geral (%)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={config.mao_de_obra_lucro_pct ?? 15}
                onChange={(e) => setConfig({ ...config, mao_de_obra_lucro_pct: Number(e.target.value) })}
              />
              <small className="muted" style={{ display: 'block', marginTop: 2 }}>
                Percentual da mão de obra calculado exclusivamente sobre o lucro líquido geral no Dashboard (padrão: 15%).
              </small>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label>Custos Fixos da Oficina / Mês (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={config.custos_fixos_mes}
                  onChange={(e) => setConfig({ ...config, custos_fixos_mes: Number(e.target.value) })}
                />
                <small className="muted">Aluguel, softwares, etc.</small>
              </div>

              <div>
                <label>Horas de Impressão / Mês</label>
                <input
                  type="number"
                  value={config.horas_mes}
                  onChange={(e) => setConfig({ ...config, horas_mes: Number(e.target.value) })}
                />
                <small className="muted">Para rateio dos custos fixos</small>
              </div>
            </div>

            <h4 style={{ margin: '16px 0 8px', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              Dados da Empresa (Impressos no Orçamento)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label>CNPJ / CPF</label>
                <input
                  type="text"
                  value={config.cnpj}
                  onChange={(e) => setConfig({ ...config, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div>
                <label>Chave PIX</label>
                <input
                  type="text"
                  value={config.pix}
                  onChange={(e) => setConfig({ ...config, pix: e.target.value })}
                  placeholder="E-mail, CPF, telefone ou aleatória"
                />
              </div>
            </div>

            <label>Endereço Comercial</label>
            <input
              type="text"
              value={config.endereco}
              onChange={(e) => setConfig({ ...config, endereco: e.target.value })}
              placeholder="Rua, número, bairro, cidade - UF"
            />

            <div style={{ marginTop: 14 }}>
              <button type="submit">Salvar Parâmetros</button>
            </div>
          </form>
        </div>

        {/* Gerenciamento de Impressoras e Canais */}
        <div>
          {/* Impressoras */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>Impressoras 3D</h4>
              <button
                className="sec"
                style={{ fontSize: 12, padding: '3px 8px' }}
                onClick={() => {
                  setImpEdicao({ nome: '', watts: 120, valor: 3500, vida_h: 4000, manutencao_h: 0.5, horas_acumuladas: 0, ativo: true });
                  setModalImp(true);
                }}
              >
                + Nova Impressora
              </button>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Consumo</th>
                  <th>Horas</th>
                  <th>Depreciação</th>
                  <th className="r">Ação</th>
                </tr>
              </thead>
              <tbody>
                {data.impressoras.filter((i) => i.ativo).map((imp) => {
                  const custoH = (imp.vida_h ? imp.valor / imp.vida_h : 0) + imp.manutencao_h;
                  return (
                    <tr key={imp.id}>
                      <td><b>{imp.nome}</b></td>
                      <td>{imp.watts} W</td>
                      <td>{imp.horas_acumuladas.toFixed(1)} h</td>
                      <td>{formatBrl(custoH)}/h</td>
                      <td className="r">
                        <button
                          className="sec"
                          style={{ padding: '2px 6px', fontSize: 12 }}
                          onClick={() => {
                            setImpEdicao(imp);
                            setModalImp(true);
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
          </div>

          {/* Canais de Venda */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>Canais de Venda e Taxas</h4>
              <button
                className="sec"
                style={{ fontSize: 12, padding: '3px 8px' }}
                onClick={() => {
                  setCanalEdicao({ nome: '', taxa_pct: 0, taxa_fixa: 0, ativo: true });
                  setModalCanal(true);
                }}
              >
                + Novo Canal
              </button>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Canal</th>
                  <th>Taxa %</th>
                  <th>Taxa Fixa</th>
                  <th className="r">Ação</th>
                </tr>
              </thead>
              <tbody>
                {data.canais.filter((c) => c.ativo).map((cn) => (
                  <tr key={cn.id}>
                    <td><b>{cn.nome}</b></td>
                    <td>{cn.taxa_pct}%</td>
                    <td>{formatBrl(cn.taxa_fixa)}</td>
                    <td className="r">
                      <button
                        className="sec"
                        style={{ padding: '2px 6px', fontSize: 12, marginRight: 4 }}
                        onClick={() => {
                          setCanalEdicao(cn);
                          setModalCanal(true);
                        }}
                      >
                        Editar
                      </button>
                      {data.canais.filter((c) => c.ativo).length > 1 && (
                        <button
                          className="sec bad"
                          style={{ padding: '2px 6px', fontSize: 12 }}
                          onClick={() => handleDesativarCanal(cn.id)}
                          title="Remover este canal"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Agendamento de Backup Automático & Notificação */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, display: 'inline', verticalAlign: 'middle' }}>
                  ⏰ Agendamento de Backup Automático
                </h3>
                <span
                  className={`tag ${agendamentoBackup.ativo ? 'ok' : ''}`}
                  style={{ marginLeft: 10, verticalAlign: 'middle' }}
                >
                  {agendamentoBackup.ativo ? `● Agendamento Ativo (${agendamentoBackup.frequencia_horas}h)` : '○ Agendamento Desativado'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleExecutarBackupAgora}
                  disabled={executandoBackupManual}
                  style={{ background: 'var(--p)', color: '#fff' }}
                  title="Executar backup imediatamente com os parâmetros configurados"
                >
                  {executandoBackupManual ? 'Gerando Backup...' : '⚡ Fazer Backup Agora'}
                </button>
              </div>
            </div>

            {msgBackup && (
              <div
                style={{
                  background: 'rgba(46, 204, 113, 0.15)',
                  border: '1px solid var(--ok)',
                  color: 'var(--ok)',
                  padding: '8px 12px',
                  borderRadius: 6,
                  marginBottom: 12,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {msgBackup}
              </div>
            )}

            {/* Painel de Notificação do Último Backup Realizado */}
            <div
              style={{
                background: agendamentoBackup.ultimo_backup_em ? 'rgba(46, 204, 113, 0.08)' : 'rgba(241, 196, 15, 0.08)',
                borderLeft: `4px solid ${agendamentoBackup.ultimo_backup_em ? 'var(--ok)' : 'var(--warn)'}`,
                padding: '12px 16px',
                borderRadius: '0 8px 8px 0',
                marginBottom: 16,
              }}
            >
              {agendamentoBackup.ultimo_backup_em ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <small style={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, color: 'var(--ok)' }}>
                        ✓ STATUS DO ÚLTIMO BACKUP
                      </small>
                      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
                        Realizado em: {new Date(agendamentoBackup.ultimo_backup_em).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })} às {new Date(agendamentoBackup.ultimo_backup_em).toLocaleTimeString('pt-BR')}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="tag ok">
                        Formato: {agendamentoBackup.ultimo_backup_formato?.toUpperCase() || agendamentoBackup.formato.toUpperCase()}
                      </span>
                      {agendamentoBackup.ultimo_backup_tamanho && (
                        <span className="tag">
                          {(agendamentoBackup.ultimo_backup_tamanho / 1024).toFixed(1)} KB
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 13, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <span>
                      <b>Próximo backup agendado:</b>{' '}
                      {new Date(
                        new Date(agendamentoBackup.ultimo_backup_em).getTime() + agendamentoBackup.frequencia_horas * 3600 * 1000
                      ).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      {' '}(executado periodicamente a cada {agendamentoBackup.frequencia_horas}h)
                    </span>
                    {snapshots.length > 0 && (
                      <button
                        type="button"
                        className="sec"
                        style={{ fontSize: 12, padding: '2px 8px' }}
                        onClick={() => baixarArquivoSnapshot(snapshots[0])}
                      >
                        📥 Baixar Cópia Deste Backup
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <b style={{ color: 'var(--warn)' }}>⚠ Nenhum backup automático realizado até o momento.</b>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
                    O sistema fará o primeiro backup automaticamente em segundo plano ou você pode acionar o botão "Fazer Backup Agora" acima.
                  </p>
                </div>
              )}
            </div>

            {/* Formulário de Configuração de Agendamento */}
            <form onSubmit={handleSalvarAgendamento}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', height: '100%', paddingTop: 6 }}>
                    <input
                      type="checkbox"
                      checked={agendamentoBackup.ativo}
                      onChange={(e) => setAgendamentoBackup((prev) => ({ ...prev, ativo: e.target.checked }))}
                      style={{ width: 'auto' }}
                    />
                    <span><b>Habilitar Backup Automático</b></span>
                  </label>
                </div>

                <div>
                  <label>Frequência Periódica</label>
                  <select
                    value={agendamentoBackup.frequencia_horas}
                    disabled={!agendamentoBackup.ativo}
                    onChange={(e) =>
                      setAgendamentoBackup((prev) => ({ ...prev, frequencia_horas: Number(e.target.value) }))
                    }
                  >
                    <option value={1}>A cada 1 hora</option>
                    <option value={6}>A cada 6 horas</option>
                    <option value={12}>A cada 12 horas</option>
                    <option value={24}>A cada 24 horas (Diário - Recomendado)</option>
                    <option value={168}>A cada 7 dias (Semanal)</option>
                  </select>
                </div>

                <div>
                  <label>Formato do Arquivo</label>
                  <select
                    value={agendamentoBackup.formato}
                    disabled={!agendamentoBackup.ativo}
                    onChange={(e) =>
                      setAgendamentoBackup((prev) => ({ ...prev, formato: e.target.value as any }))
                    }
                  >
                    <option value="json">JSON (Backup completo do sistema - Recomendado)</option>
                    <option value="csv">CSV (Planilha universal de dados)</option>
                    <option value="xlsx">Excel .xlsx (Planilhas com abas)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', height: '100%', paddingTop: 6 }}>
                    <input
                      type="checkbox"
                      checked={agendamentoBackup.baixar_automaticamente}
                      disabled={!agendamentoBackup.ativo}
                      onChange={(e) =>
                        setAgendamentoBackup((prev) => ({ ...prev, baixar_automaticamente: e.target.checked }))
                      }
                      style={{ width: 'auto' }}
                    />
                    <span style={{ fontSize: 13 }}>Baixar arquivo no computador a cada backup</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button type="submit" className="sec">
                  Salvar Preferências de Agendamento
                </button>
              </div>
            </form>

            {/* Histórico dos Últimos Backups Realizados */}
            {snapshots.length > 0 && (
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                <h4 style={{ margin: '0 0 10px' }}>Histórico de Backups Salvos ({snapshots.length})</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Data e Hora</th>
                        <th>Formato</th>
                        <th>Tamanho</th>
                        <th>Resumo dos Registros</th>
                        <th className="r">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshots.map((snap) => (
                        <tr key={snap.id}>
                          <td>
                            <b>{new Date(snap.data).toLocaleDateString('pt-BR')}</b>{' '}
                            <span className="muted">{new Date(snap.data).toLocaleTimeString('pt-BR')}</span>
                          </td>
                          <td>
                            <span className="tag ok">{snap.formato.toUpperCase()}</span>
                          </td>
                          <td>{(snap.tamanho / 1024).toFixed(1)} KB</td>
                          <td style={{ fontSize: 12 }}>
                            {snap.itens.produtos} produtos · {snap.itens.rolos} rolos · {snap.itens.clientes} clientes · {snap.itens.vendas} vendas
                          </td>
                          <td className="r">
                            <button
                              type="button"
                              className="sec"
                              style={{ padding: '2px 8px', fontSize: 12, marginRight: 6 }}
                              onClick={() => baixarArquivoSnapshot(snap)}
                              title="Baixar arquivo deste backup"
                            >
                              📥 Baixar
                            </button>
                            {snap.formato === 'json' && (
                              <button
                                type="button"
                                className="sec"
                                style={{ padding: '2px 8px', fontSize: 12, marginRight: 6 }}
                                onClick={() => handleRestaurarSnapshot(snap)}
                                title="Restaurar dados a partir deste ponto no tempo"
                              >
                                ↺ Restaurar
                              </button>
                            )}
                            <button
                              type="button"
                              className="sec bad"
                              style={{ padding: '2px 6px', fontSize: 12 }}
                              onClick={() => handleExcluirSnapshot(snap.id)}
                              title="Excluir este snapshot"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Backup e Manutenção dos Dados */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h4 style={{ margin: '0 0 8px' }}>Exportação Manual & Importação de Dados</h4>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 12px' }}>
              Faça download avulso em planilhas Excel (.xlsx) ou importe planilhas CSV/Excel para popular o estoque e catálogo.
            </p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <button
                type="button"
                onClick={() => exportarBackupExcel()}
                style={{ background: 'var(--ok)', color: '#fff', fontWeight: 600 }}
                title="Gera arquivo .xlsx completo com todas as tabelas do sistema"
              >
                📊 Exportar Planilha Excel (.xlsx)
              </button>

              <button
                type="button"
                className="sec"
                onClick={() => setModalImportar(true)}
                title="Importar catálogo, clientes ou estoque de arquivo CSV ou Excel"
              >
                📥 Importar Planilha CSV / Excel
              </button>

              <button
                type="button"
                className="sec"
                onClick={() => baixarModeloCsv()}
                title="Baixar planilha CSV com colunas padronizadas de exemplo"
              >
                📄 Baixar Modelo CSV
              </button>
            </div>

            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" className="sec" onClick={handleDownloadBackup}>
                💾 Baixar JSON Completo
              </button>

              <label className="btn sec" style={{ cursor: 'pointer', margin: 0 }}>
                📂 Restaurar JSON
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestaurarBackupArquivo}
                  style={{ display: 'none' }}
                />
              </label>

              <button
                type="button"
                className="sec bad"
                onClick={handleZerarBancoLimpo}
                title="Apagar permanentemente todos os dados de teste e iniciar base limpa"
              >
                🗑️ Zerar Todos os Dados (Iniciar Limpo)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Impressora */}
      {modalImp && (
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
            <h3>{impEdicao?.id ? 'Editar Impressora' : 'Nova Impressora'}</h3>
            <form onSubmit={handleSalvarImpressora}>
              <label>Nome / Modelo *</label>
              <input
                type="text"
                required
                value={impEdicao?.nome || ''}
                onChange={(e) => setImpEdicao((prev) => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Bambu Lab A1"
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label>Consumo (Watts)</label>
                  <input
                    type="number"
                    value={impEdicao?.watts || 100}
                    onChange={(e) => setImpEdicao((prev) => ({ ...prev, watts: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label>Valor da Máquina (R$)</label>
                  <input
                    type="number"
                    value={impEdicao?.valor || 3000}
                    onChange={(e) => setImpEdicao((prev) => ({ ...prev, valor: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label>Vida Útil Estimada (horas)</label>
                  <input
                    type="number"
                    value={impEdicao?.vida_h || 4000}
                    onChange={(e) => setImpEdicao((prev) => ({ ...prev, vida_h: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label>Manutenção (R$/h)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={impEdicao?.manutencao_h || 0.5}
                    onChange={(e) => setImpEdicao((prev) => ({ ...prev, manutencao_h: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" className="sec" onClick={() => setModalImp(false)}>
                  Cancelar
                </button>
                <button type="submit">Salvar Impressora</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Canal */}
      {modalCanal && (
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
          <div className="card" style={{ width: 400, maxWidth: '100%' }}>
            <h3>{canalEdicao?.id ? 'Editar Canal de Venda' : 'Novo Canal de Venda'}</h3>
            <form onSubmit={handleSalvarCanal}>
              <label>Nome do Canal *</label>
              <input
                type="text"
                required
                value={canalEdicao?.nome || ''}
                onChange={(e) => setCanalEdicao((prev) => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Shopee, Mercado Livre"
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label>Taxa Percentual (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={canalEdicao?.taxa_pct || 0}
                    onChange={(e) => setCanalEdicao((prev) => ({ ...prev, taxa_pct: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label>Taxa Fixa (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={canalEdicao?.taxa_fixa || 0}
                    onChange={(e) => setCanalEdicao((prev) => ({ ...prev, taxa_fixa: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" className="sec" onClick={() => setModalCanal(false)}>
                  Cancelar
                </button>
                <button type="submit">Salvar Canal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Importar Planilha CSV / Excel */}
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
