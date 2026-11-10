import React, { useEffect, useState } from 'react';
import { estoqueBaixo } from '../services';

export type NavTab =
  | 'dashboard'
  | 'clientes'
  | 'orcamentos'
  | 'pedidos'
  | 'vendas'
  | 'produtos'
  | 'calculadora'
  | 'estoque'
  | 'financeiro'
  | 'projetos'
  | 'relatorios'
  | 'config'
  | 'ia';

interface NavigationProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onSelectTab }) => {
  const [tema, setTema] = useState<'light' | 'dark'>('light');
  const [alertasCount, setAlertasCount] = useState({ acabou: 0, acabando: 0 });

  useEffect(() => {
    try {
      const saved = (localStorage.getItem('tema') as 'light' | 'dark') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      setTema(saved);
      document.documentElement.dataset.tema = saved;
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const baixo = estoqueBaixo();
    const acabou = baixo.filter((a) => a.status === 'acabou').length;
    const acabando = baixo.filter((a) => a.status === 'acabando').length;
    setAlertasCount({ acabou, acabando });
  }, [currentTab]);

  const toggleTema = () => {
    const next = tema === 'dark' ? 'light' : 'dark';
    setTema(next);
    document.documentElement.dataset.tema = next;
    try {
      localStorage.setItem('tema', next);
    } catch {
      // ignore
    }
  };

  const navGrupos: Array<{
    grupo: string;
    itens: Array<{ tab: NavTab; nome: string; badge?: number; badgeColor?: string }>;
  }> = [
    {
      grupo: 'Início',
      itens: [{ tab: 'dashboard', nome: 'Dashboard' }],
    },
    {
      grupo: 'Vender',
      itens: [
        { tab: 'clientes', nome: 'Clientes' },
        { tab: 'orcamentos', nome: 'Orçamentos' },
        { tab: 'pedidos', nome: 'Pedidos' },
        { tab: 'vendas', nome: 'Vendas' },
      ],
    },
    {
      grupo: 'Produzir',
      itens: [
        { tab: 'produtos', nome: 'Produtos' },
        { tab: 'calculadora', nome: 'Calculadora' },
        {
          tab: 'estoque',
          nome: 'Estoque',
          badge: alertasCount.acabou + alertasCount.acabando > 0 ? alertasCount.acabou + alertasCount.acabando : undefined,
          badgeColor: alertasCount.acabou > 0 ? 'var(--bad)' : 'var(--warn)',
        },
        { tab: 'projetos', nome: 'Projetos 3D' },
      ],
    },
    {
      grupo: 'Dinheiro',
      itens: [
        { tab: 'financeiro', nome: 'Financeiro' },
        { tab: 'relatorios', nome: 'Relatórios' },
      ],
    },
    {
      grupo: 'Sistema',
      itens: [
        { tab: 'config', nome: 'Configurações' },
        { tab: 'ia', nome: 'IA Assistente' },
      ],
    },
  ];

  return (
    <nav>
      <div style={{ cursor: 'pointer' }} onClick={() => onSelectTab('dashboard')}>
        <img className="logo-claro" src="/static/logo.png" alt="3D Conex Lab" />
        <img className="logo-escuro" src="/static/logo-noturno.png" alt="3D Conex Lab" />
      </div>

      {navGrupos.map((g) => (
        <div key={g.grupo}>
          <h6>{g.grupo}</h6>
          {g.itens.map((it) => {
            const isActive = currentTab === it.tab;
            return (
              <a
                key={it.tab}
                href={`#${it.tab}`}
                onClick={(e) => {
                  e.preventDefault();
                  onSelectTab(it.tab);
                }}
                style={{
                  background: isActive ? 'var(--hover)' : undefined,
                  fontWeight: isActive ? 600 : undefined,
                }}
              >
                {it.nome}
                {it.badge !== undefined && (
                  <span className="badge" style={{ background: it.badgeColor || 'var(--bad)' }}>
                    {it.badge}
                  </span>
                )}
              </a>
            );
          })}
        </div>
      ))}

      <button type="button" id="tema-btn" className="sec tema-btn" onClick={toggleTema}>
        {tema === 'dark' ? '☀️ Modo claro' : '🌙 Modo noturno'}
      </button>
    </nav>
  );
};
