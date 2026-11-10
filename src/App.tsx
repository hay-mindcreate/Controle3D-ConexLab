/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { iniciarAgendadorBackup } from './backupScheduler';
import { CalculadoraView } from './components/CalculadoraView';
import { ClientesView } from './components/ClientesView';
import { ConfigView } from './components/ConfigView';
import { DashboardView } from './components/DashboardView';
import { EstoqueView } from './components/EstoqueView';
import { FinanceiroView } from './components/FinanceiroView';
import { IaView } from './components/IaView';
import { NavTab, Navigation } from './components/Navigation';
import { OrcamentosView } from './components/OrcamentosView';
import { PedidosView } from './components/PedidosView';
import { ProdutosView } from './components/ProdutosView';
import { ProjetosView } from './components/ProjetosView';
import { RelatoriosView } from './components/RelatoriosView';
import { VendasView } from './components/VendasView';
import { db } from './db';
import { estoqueBaixo } from './services';

export default function App() {
  const [, setDbVersion] = useState(0);
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [navigationExtra, setNavigationExtra] = useState<any>(null);
  const [toastBackup, setToastBackup] = useState<{ mensagem: string; formato: string; data: string } | null>(null);

  useEffect(() => {
    // Escuta mudanças de banco de dados reativo
    const unsubscribe = db.subscribe(() => {
      setDbVersion((v) => v + 1);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    // Inicializa agendador de backup automático periódico
    const pararAgendador = iniciarAgendadorBackup();

    const handleBackupEvent = (e: any) => {
      const snap = e.detail?.snapshot;
      if (snap) {
        const horaStr = new Date(snap.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        setToastBackup({
          mensagem: e.detail?.ehAgendado
            ? `Backup automático agendado salvo com sucesso!`
            : `Backup salvo com sucesso!`,
          formato: snap.formato.toUpperCase(),
          data: horaStr,
        });
        setTimeout(() => setToastBackup(null), 6000);
      }
    };

    window.addEventListener('conexlab:backup_realizado', handleBackupEvent);

    return () => {
      pararAgendador();
      window.removeEventListener('conexlab:backup_realizado', handleBackupEvent);
    };
  }, []);

  const handleNavigate = (tab: NavTab, extra?: any) => {
    setCurrentTab(tab);
    setNavigationExtra(extra || null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const alertas = estoqueBaixo();
  const acabou = alertas.filter((a) => a.status === 'acabou').length;
  const acabando = alertas.filter((a) => a.status === 'acabando').length;
  const temAlertas = acabou + acabando > 0;

  return (
    <>
      <Navigation
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          setNavigationExtra(null);
        }}
      />

      <main>
        {/* Notificação Flutuante de Backup */}
        {toastBackup && (
          <div
            style={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: 9999,
              background: 'var(--card)',
              border: '1px solid var(--ok)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              borderRadius: 8,
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              animation: 'fadeIn 0.3s ease-out',
            }}
          >
            <span style={{ fontSize: 20 }}>💾</span>
            <div>
              <b style={{ color: 'var(--ok)', fontSize: 13, display: 'block' }}>
                ✓ {toastBackup.mensagem}
              </b>
              <small className="muted">
                Formato: {toastBackup.formato} · {toastBackup.data} · Registro gravado no painel
              </small>
            </div>
            <button
              className="sec"
              style={{ fontSize: 11, padding: '3px 8px', marginLeft: 8 }}
              onClick={() => {
                handleNavigate('config');
                setToastBackup(null);
              }}
            >
              Ver em Configurações
            </button>
            <button
              className="sec"
              style={{ fontSize: 11, padding: '3px 6px' }}
              onClick={() => setToastBackup(null)}
            >
              ✕
            </button>
          </div>
        )}

        {/* Banner de alerta global idêntico ao base.html original */}
        {temAlertas && (
          <a
            className={`alerta ${acabou > 0 ? 'bad' : ''} no-print`}
            href="#estoque"
            onClick={(e) => {
              e.preventDefault();
              handleNavigate('estoque', { aba: 'alertas' });
            }}
          >
            ⚠ <b>Estoque:</b>{' '}
            {acabou > 0 && <b className="bad">{acabou} acabou</b>}
            {acabou > 0 && acabando > 0 && ' · '}
            {acabando > 0 && <b className="warn">{acabando} acabando</b>}
            {' '}— clique para ver
          </a>
        )}

        {currentTab === 'dashboard' && <DashboardView onNavigate={handleNavigate} />}

        {currentTab === 'clientes' && (
          <ClientesView
            onNavigate={handleNavigate}
            clienteId={navigationExtra?.clienteId}
          />
        )}

        {currentTab === 'orcamentos' && (
          <OrcamentosView
            onNavigate={handleNavigate}
            orcamentoId={navigationExtra?.orcamentoId}
            novo={navigationExtra?.novo}
            novoParaClienteId={navigationExtra?.novoParaClienteId}
          />
        )}

        {currentTab === 'pedidos' && (
          <PedidosView
            onNavigate={handleNavigate}
            pedidoId={navigationExtra?.pedidoId}
          />
        )}

        {currentTab === 'vendas' && (
          <VendasView
            onNavigate={handleNavigate}
            vendaId={navigationExtra?.vendaId}
          />
        )}

        {currentTab === 'produtos' && (
          <ProdutosView
            onNavigate={handleNavigate}
            produtoId={navigationExtra?.produtoId}
          />
        )}

        {currentTab === 'calculadora' && <CalculadoraView onNavigate={handleNavigate} />}

        {currentTab === 'estoque' && (
          <EstoqueView
            onNavigate={handleNavigate}
            abaInicial={navigationExtra?.aba || 'filamentos'}
          />
        )}

        {currentTab === 'financeiro' && <FinanceiroView onNavigate={handleNavigate} />}

        {currentTab === 'projetos' && (
          <ProjetosView
            onNavigate={handleNavigate}
            projetoId={navigationExtra?.projetoId}
          />
        )}

        {currentTab === 'relatorios' && <RelatoriosView onNavigate={handleNavigate} />}

        {currentTab === 'config' && <ConfigView onNavigate={handleNavigate} />}

        {currentTab === 'ia' && <IaView onNavigate={handleNavigate} />}
      </main>
    </>
  );
}
