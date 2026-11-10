import React, { useState } from 'react';
import { formatBrl } from '../calc';
import { db, EMPRESA } from '../db';
import { estoqueBaixo, saldos, totaisMes } from '../services';
import { NavTab } from './Navigation';

interface IaViewProps {
  onNavigate: (tab: NavTab, extra?: any) => void;
}

export const IaView: React.FC<IaViewProps> = ({ onNavigate }) => {
  const data = db.get();
  const hoje = new Date().toISOString().split('T')[0];
  const iniMes = hoje.slice(0, 7) + '-01';

  const [pergunta, setPergunta] = useState('');
  const [resposta, setResposta] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [orcamentoSelecionadoId, setOrcamentoSelecionadoId] = useState<number>(data.orcamentos[0]?.id || 0);

  // Compila resumo estatístico real da loja para enriquecer a inteligência
  const gerarContextoNegocio = () => {
    const totais = totaisMes(iniMes, hoje + 'T23:59:59');
    const alertas = estoqueBaixo();
    const pedidosAndamento = data.pedidos.filter((p) => ['aguardando', 'imprimindo', 'acabamento', 'pronto'].includes(p.status));
    const orcamentosAbertos = data.orcamentos.filter((o) => o.status === 'aberto');

    return {
      hoje,
      totais,
      alertas,
      pedidosAndamento,
      orcamentosAbertos,
    };
  };

  const handleGerarResumoMes = () => {
    setCarregando(true);
    setPergunta('Resumo do mês atual');

    const ctx = gerarContextoNegocio();
    const topVendas = data.vendas
      .filter((v) => v.status === 'ativa')
      .flatMap((v) => v.itens)
      .reduce((acc, it) => {
        acc[it.descricao] = (acc[it.descricao] || 0) + it.qtd;
        return acc;
      }, {} as Record<string, number>);

    const maisVendidosStr = Object.entries(topVendas)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([nome, qtd]) => `${nome} (${qtd} un)`)
      .join(', ') || 'Nenhuma venda ainda';

    const alertasStr = ctx.alertas.length > 0
      ? ctx.alertas.map((a) => `${a.tipo} ${a.nome}: ${a.status.toUpperCase()} (${a.saldo} restante)`).join('; ')
      : 'Todos os materiais e insumos com estoque saudável.';

    setTimeout(() => {
      const texto = `📊 **Resumo Gerencial do Mês (${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}):**\n\n` +
        `• **Faturamento:** ${formatBrl(ctx.totais.faturamento)} em ${ctx.totais.n} venda(s) realizada(s).\n` +
        `• **Custo dos Produtos (CMV):** ${formatBrl(ctx.totais.cmv)}\n` +
        `• **Despesas Pagas:** ${formatBrl(ctx.totais.despesas)}\n` +
        `• **Lucro Líquido:** ${formatBrl(ctx.totais.lucro)}\n\n` +
        `🔥 **Mais Vendidos:** ${maisVendidosStr}.\n` +
        `⚙ **Produção:** ${ctx.pedidosAndamento.length} pedido(s) em andamento na oficina.\n` +
        `📋 **Orçamentos:** ${ctx.orcamentosAbertos.length} orçamento(s) aguardando aprovação do cliente.\n\n` +
        `⚠️ **Atenção ao Estoque:** ${alertasStr}`;

      setResposta(texto);
      setCarregando(false);
    }, 400);
  };

  const handleGerarMensagemOrcamento = () => {
    const orc = data.orcamentos.find((o) => o.id === Number(orcamentoSelecionadoId));
    if (!orc) return;

    setCarregando(true);
    setPergunta(`Mensagem de WhatsApp para Orçamento #${String(orc.id).padStart(4, '0')}`);

    const cli = data.clientes.find((c) => c.id === orc.cliente_id);
    const primeiroNome = cli ? cli.nome.split(' ')[0] : 'Cliente';
    const total = orc.itens.reduce((acc, it) => acc + it.qtd * it.preco_unit, 0) - orc.desconto + orc.frete;
    const itensStr = orc.itens.map((i) => `${i.qtd}x ${i.descricao}`).join(' e ');

    setTimeout(() => {
      const msg = `Olá, ${primeiroNome}! Tudo bem? 😊\n\n` +
        `Aqui é da *${EMPRESA.nome}*! Conforme conversamos, segue a proposta do seu pedido:\n\n` +
        `📦 *Item:* ${itensStr}\n` +
        `💰 *Valor Total:* ${formatBrl(total)}\n` +
        `⏱ *Prazo de Produção:* ${orc.prazo}\n` +
        `💳 *Condição de Pagamento:* ${orc.pagamento}\n\n` +
        `O orçamento nº *#${String(orc.id).padStart(4, '0')}* tem validade de ${orc.validade_dias} dias. ` +
        `Se quiser confirmar para colocarmos na fila de impressão, só me dar um retorno por aqui! Ficamos à total disposição! 🚀`;

      setResposta(msg);
      setCarregando(false);
    }, 350);
  };

  const handlePerguntarCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pergunta.trim()) return;

    setCarregando(true);
    const q = pergunta.toLowerCase();

    setTimeout(() => {
      let resp = '';
      if (q.includes('lucro') || q.includes('faturamento') || q.includes('quanto ganhei')) {
        const totais = totaisMes(iniMes, hoje + 'T23:59:59');
        resp = `No mês atual, seu faturamento total é de **${formatBrl(totais.faturamento)}** com custos de **${formatBrl(totais.custos)}**, resultando em um lucro líquido de **${formatBrl(totais.lucro)}** (${totais.faturamento > 0 ? ((totais.lucro / totais.faturamento) * 100).toFixed(1) : 0}% de margem).`;
      } else if (q.includes('estoque') || q.includes('filamento') || q.includes('acabando')) {
        const alertas = estoqueBaixo();
        if (alertas.length === 0) {
          resp = 'Todos os seus materiais e insumos estão com saldo acima do mínimo configurado!';
        } else {
          resp = `Encontrei ${alertas.length} item(ns) que precisam de atenção:\n` +
            alertas.map((a) => `• ${a.nome} (${a.tipo}): saldo atual de ${a.saldo} (situação: ${a.status.toUpperCase()})`).join('\n');
        }
      } else if (q.includes('pedido') || q.includes('produção') || q.includes('imprimindo')) {
        const emProd = data.pedidos.filter((p) => ['imprimindo', 'acabamento'].includes(p.status));
        resp = `Atualmente você possui **${emProd.length} pedido(s)** em produção na oficina (${emProd.map((p) => `#${String(p.id).padStart(4, '0')}`).join(', ') || 'nenhum'}).`;
      } else {
        resp = `Analisando os dados da **3D Conex Lab**:\n` +
          `• Produtos cadastrados: ${data.produtos.filter((p) => p.ativo).length}\n` +
          `• Clientes ativos: ${data.clientes.filter((c) => c.ativo).length}\n` +
          `• Vendas registradas: ${data.vendas.filter((v) => v.status === 'ativa').length}\n` +
          `• Impressoras ativas: ${data.impressoras.filter((i) => i.ativo).map((i) => i.nome).join(', ')}\n\n` +
          `Dica: Você pode consultar o resumo do mês, sugerir preços na calculadora ou verificar alertas de filamento a qualquer momento!`;
      }

      setResposta(resp);
      setCarregando(false);
    }, 450);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Assistente IA — 3D Conex Lab</h2>
        <span className="tag ok">Pronto / Integrado</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {/* Painel de Ações Rápidas */}
        <div className="card">
          <h4 style={{ margin: '0 0 10px' }}>Casos de Uso Inteligentes</h4>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px' }}>
            A IA analisa exclusivamente os dados do seu sistema (vendas, estoque, custos reais) para redigir textos e resumos operacionais.
          </p>

          <div style={{ marginBottom: 16 }}>
            <button
              onClick={handleGerarResumoMes}
              disabled={carregando}
              style={{ width: '100%', textAlign: 'left', padding: '10px 14px' }}
            >
              📊 <b>Resumo Executivo do Mês</b>
              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
                Gera um relatório curto das vendas, lucro, produção e itens acabando.
              </div>
            </button>
          </div>

          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <label>Redigir Mensagem de Orçamento para WhatsApp:</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <select
                value={orcamentoSelecionadoId}
                onChange={(e) => setOrcamentoSelecionadoId(Number(e.target.value))}
                style={{ flex: 1 }}
              >
                {data.orcamentos.map((o) => {
                  const cli = data.clientes.find((c) => c.id === o.cliente_id);
                  return (
                    <option key={o.id} value={o.id}>
                      Orçamento #{String(o.id).padStart(4, '0')} — {cli?.nome || 'Cliente'}
                    </option>
                  );
                })}
              </select>
              <button className="sec" onClick={handleGerarMensagemOrcamento} disabled={carregando}>
                Redigir Texto
              </button>
            </div>
          </div>

          {/* Perguntas livres */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 14 }}>
            <form onSubmit={handlePerguntarCustom}>
              <label>Fazer Pergunta sobre o Negócio:</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  placeholder="Ex: quanto lucrei este mês? quais filamentos estão acabando?"
                  value={pergunta}
                  onChange={(e) => setPergunta(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" disabled={carregando}>
                  Enviar
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Resposta do Assistente */}
        <div className="card" style={{ minHeight: 300, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h4 style={{ margin: 0 }}>Resposta da IA</h4>
            {resposta && (
              <button
                className="sec"
                style={{ fontSize: 12, padding: '2px 8px' }}
                onClick={() => {
                  navigator.clipboard.writeText(resposta);
                  alert('Texto copiado para a área de transferência!');
                }}
              >
                📋 Copiar Texto
              </button>
            )}
          </div>

          <div
            style={{
              flex: 1,
              background: 'var(--col)',
              borderRadius: 8,
              padding: 14,
              fontSize: 14,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              overflowY: 'auto',
            }}
          >
            {carregando ? (
              <div style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                Consultando dados e redigindo resposta...
              </div>
            ) : resposta ? (
              resposta
            ) : (
              <div style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                Clique em um dos botões ao lado ou faça uma pergunta para ver a resposta da IA aqui.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
