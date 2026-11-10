import {
  Canal,
  Cliente,
  Config,
  Impressora,
  Insumo,
  Lancamento,
  Material,
  MovEstoque,
  Orcamento,
  Pedido,
  Produto,
  Projeto,
  Rolo,
  Tarefa,
  Venda,
} from './types';

export const EMPRESA = {
  nome: '3D Conex Lab',
  instagram: '@conexlab3d',
  whatsapp: '+55 62 9423-1913',
};

export interface AppDatabase {
  config: Config;
  impressoras: Impressora[];
  canais: Canal[];
  clientes: Cliente[];
  materiais: Material[];
  rolos: Rolo[];
  insumos: Insumo[];
  movimentos: MovEstoque[];
  projetos: Projeto[];
  produtos: Produto[];
  orcamentos: Orcamento[];
  pedidos: Pedido[];
  vendas: Venda[];
  lancamentos: Lancamento[];
  tarefas: Tarefa[];
}

const STORAGE_KEY = 'conexlab_3d_db_v1';

function createDefaultData(): AppDatabase {
  const hoje = new Date().toISOString().split('T')[0];

  const config: Config = {
    id: 1,
    kwh: 0.95,
    hora_trabalho: 20.0,
    falhas_pct: 8.0,
    margem_pct: 40.0,
    custos_fixos_mes: 0,
    horas_mes: 160,
    cnpj: '',
    endereco: '',
    pix: '',
    mao_de_obra_lucro_pct: 15.0,
    backup_agendamento: {
      ativo: true,
      frequencia_horas: 24,
      formato: 'json',
      ultimo_backup_em: null,
      ultimo_backup_formato: null,
      ultimo_backup_tamanho: null,
      ultimo_backup_status: 'pendente',
      baixar_automaticamente: false,
    },
  };

  const impressoras: Impressora[] = [
    {
      id: 1,
      nome: 'Bambu Lab A1 (AMS Lite)',
      watts: 100,
      valor: 4000,
      vida_h: 5000,
      horas_acumuladas: 24.5,
      manutencao_h: 0.5,
      ativo: true,
    },
  ];

  const canais: Canal[] = [
    { id: 1, nome: 'Balcão (PIX/Dinheiro)', taxa_pct: 0, taxa_fixa: 0, ativo: true },
    { id: 2, nome: 'WhatsApp / Instagram', taxa_pct: 0, taxa_fixa: 0, ativo: true },
    { id: 3, nome: 'Shopee', taxa_pct: 14, taxa_fixa: 3.0, ativo: true },
    { id: 4, nome: 'Mercado Livre', taxa_pct: 16, taxa_fixa: 5.0, ativo: true },
  ];

  const clientes: Cliente[] = [
    {
      id: 1,
      nome: 'Ana Paula Silva',
      telefone: '(62) 99876-5432',
      email: 'ana.silva@email.com',
      documento: '123.456.789-00',
      endereco: 'Goiânia - GO',
      observacoes: 'Cliente frequente de brindes personalizados',
      ativo: true,
    },
    {
      id: 2,
      nome: 'Carlos Eduardo Santos',
      telefone: '(62) 98123-4567',
      email: 'carlos.santos@email.com',
      documento: '',
      endereco: 'Aparecida de Goiânia - GO',
      observacoes: 'Peças técnicas e protótipos',
      ativo: true,
    },
  ];

  const materiais: Material[] = [
    { id: 1, tipo: 'PLA', cor: 'Preto', marca: 'Voolt3D', minimo_g: 1000, ativo: true },
    { id: 2, tipo: 'PLA', cor: 'Branco', marca: 'Voolt3D', minimo_g: 500, ativo: true },
    { id: 3, tipo: 'PETG', cor: 'Cinza', marca: '3D Fila', minimo_g: 500, ativo: true },
  ];

  const rolos: Rolo[] = [
    {
      id: 1,
      material_id: 1,
      peso_inicial: 1000,
      preco: 95.0,
      fornecedor: 'Loja 3D Brasil',
      comprado_em: hoje,
      ativo: true,
    },
    {
      id: 2,
      material_id: 2,
      peso_inicial: 1000,
      preco: 98.0,
      fornecedor: 'Loja 3D Brasil',
      comprado_em: hoje,
      ativo: true,
    },
    {
      id: 3,
      material_id: 3,
      peso_inicial: 1000,
      preco: 110.0,
      fornecedor: '3D Fila Oficial',
      comprado_em: hoje,
      ativo: true,
    },
  ];

  const insumos: Insumo[] = [
    { id: 1, nome: 'Argola de Chaveiro com Corrente', unidade: 'un', custo_unit: 0.35, minimo: 50, fornecedor: 'Armarinhos', ativo: true },
    { id: 2, nome: 'Caixa de Envio P', unidade: 'un', custo_unit: 2.2, minimo: 15, fornecedor: 'Embalagens Brasil', ativo: true },
    { id: 3, nome: 'Saquinho Plástico Adesivado', unidade: 'un', custo_unit: 0.15, minimo: 50, fornecedor: 'Embalagens Brasil', ativo: true },
  ];

  const movimentos: MovEstoque[] = [
    { id: 1, item_tipo: 'rolo', item_id: 1, delta: 1000, motivo: 'compra', ref_tipo: 'rolo', ref_id: 1, obs: 'Estoque inicial', em: `${hoje}T09:00:00`, valor: 95, data: hoje, fornecedor: 'Loja 3D Brasil' },
    { id: 2, item_tipo: 'rolo', item_id: 2, delta: 1000, motivo: 'compra', ref_tipo: 'rolo', ref_id: 2, obs: 'Estoque inicial', em: `${hoje}T09:00:00`, valor: 98, data: hoje, fornecedor: 'Loja 3D Brasil' },
    { id: 3, item_tipo: 'rolo', item_id: 3, delta: 1000, motivo: 'compra', ref_tipo: 'rolo', ref_id: 3, obs: 'Estoque inicial', em: `${hoje}T09:00:00`, valor: 110, data: hoje, fornecedor: '3D Fila Oficial' },
    { id: 4, item_tipo: 'insumo', item_id: 1, delta: 100, motivo: 'compra', ref_tipo: 'insumo', ref_id: 1, obs: 'Estoque inicial', em: `${hoje}T09:00:00`, valor: 35, data: hoje, fornecedor: 'Armarinhos' },
    { id: 5, item_tipo: 'insumo', item_id: 2, delta: 30, motivo: 'compra', ref_tipo: 'insumo', ref_id: 2, obs: 'Estoque inicial', em: `${hoje}T09:00:00`, valor: 66, data: hoje, fornecedor: 'Embalagens Brasil' },
    { id: 6, item_tipo: 'insumo', item_id: 3, delta: 100, motivo: 'compra', ref_tipo: 'insumo', ref_id: 3, obs: 'Estoque inicial', em: `${hoje}T09:00:00`, valor: 15, data: hoje, fornecedor: 'Embalagens Brasil' },
    { id: 7, item_tipo: 'produto', item_id: 1, delta: 8, motivo: 'producao', ref_tipo: 'produto', ref_id: 1, obs: 'Estoque inicial pronto', em: `${hoje}T10:00:00`, valor: 0, data: hoje, fornecedor: '' },
  ];

  const projetos: Projeto[] = [
    {
      id: 1,
      nome: 'Chaveiro Spotify Code',
      descricao: 'Chaveiro retangular com código de música em relevo para leitura',
      categoria: 'Chaveiros',
      arquivo: '/uploads/chaveiro-spotify.3mf',
      arquivo_nome: 'chaveiro-spotify.3mf',
      tamanho: 245000,
      foto: '',
      peso_g: 12,
      tempo_min: 24,
      criado_em: `${hoje}T08:00:00`,
      ativo: true,
    },
    {
      id: 2,
      nome: 'Suporte de Celular Dobrável',
      descricao: 'Suporte articulado para smartphone com ângulo ajustável',
      categoria: 'Utilidades',
      arquivo: '/uploads/suporte-celular.stl',
      arquivo_nome: 'suporte-celular.stl',
      tamanho: 1250000,
      foto: '',
      peso_g: 45,
      tempo_min: 75,
      criado_em: `${hoje}T08:00:00`,
      ativo: true,
    },
  ];

  const produtos: Produto[] = [
    {
      id: 1,
      nome: 'Chaveiro Spotify Code',
      sku: 'P0001',
      categoria: 'Chaveiros',
      foto: '',
      modelo: 'chaveiro-spotify.3mf',
      projeto_id: 1,
      tempo_min: 24,
      impressora_id: 1,
      preco: 15.0,
      preco_manual: false,
      margem_pct: 45,
      lote_qtd: 1,
      fornecedor: '',
      minimo: 5,
      embalagem: 0.15,
      acessorios: 0.35,
      min_trabalho: 5,
      ativo: true,
      materiais: [{ id: 1, produto_id: 1, material_id: 1, gramas: 12 }],
      insumos: [
        { id: 1, produto_id: 1, insumo_id: 1, qtd: 1 },
        { id: 2, produto_id: 1, insumo_id: 3, qtd: 1 },
      ],
    },
    {
      id: 2,
      nome: 'Suporte de Celular Dobrável',
      sku: 'P0002',
      categoria: 'Utilidades',
      foto: '',
      modelo: 'suporte-celular.stl',
      projeto_id: 2,
      tempo_min: 75,
      impressora_id: 1,
      preco: 32.0,
      preco_manual: false,
      margem_pct: 40,
      lote_qtd: 1,
      fornecedor: '',
      minimo: 2,
      embalagem: 2.2,
      acessorios: 0,
      min_trabalho: 10,
      ativo: true,
      materiais: [{ id: 2, produto_id: 2, material_id: 2, gramas: 45 }],
      insumos: [{ id: 3, produto_id: 2, insumo_id: 2, qtd: 1 }],
    },
  ];

  const orcamentos: Orcamento[] = [
    {
      id: 1,
      cliente_id: 1,
      canal_id: 2,
      data: hoje,
      validade_dias: 7,
      desconto: 0,
      frete: 0,
      prazo: '3 dias úteis após confirmação',
      pagamento: '50% de sinal e 50% na retirada (PIX)',
      observacoes: 'Chaveiro na cor preta com detalhes em branco',
      status: 'aprovado',
      itens: [
        {
          id: 1,
          orcamento_id: 1,
          produto_id: 1,
          descricao: 'Chaveiro Spotify Code',
          personalizacao: 'Música: Imagine - John Lennon',
          qtd: 2,
          preco_unit: 15.0,
          custo_unit: 4.85,
        },
      ],
    },
    {
      id: 2,
      cliente_id: 2,
      canal_id: 1,
      data: hoje,
      validade_dias: 7,
      desconto: 0,
      frete: 0,
      prazo: '4 dias úteis',
      pagamento: 'PIX à vista',
      observacoes: 'Orçamento solicitado via WhatsApp',
      status: 'aberto',
      itens: [
        {
          id: 2,
          orcamento_id: 2,
          produto_id: 2,
          descricao: 'Suporte de Celular Dobrável',
          personalizacao: 'Cor Branca',
          qtd: 1,
          preco_unit: 32.0,
          custo_unit: 11.5,
        },
      ],
    },
  ];

  const pedidos: Pedido[] = [
    {
      id: 1,
      orcamento_id: 1,
      cliente_id: 1,
      canal_id: 2,
      tipo: 'cliente',
      status: 'imprimindo',
      prazo: hoje,
      observacoes: 'Pedido aprovado do orçamento #0001',
      desconto: 0,
      frete: 0,
      custo_extra: 0,
      do_estoque: false,
      criado_em: `${hoje}T09:30:00`,
      itens: [
        {
          id: 1,
          pedido_id: 1,
          produto_id: 1,
          descricao: 'Chaveiro Spotify Code',
          personalizacao: 'Música: Imagine - John Lennon',
          qtd: 2,
          preco_unit: 15.0,
          custo_unit: 4.85,
          qtd_pronta: 0,
        },
      ],
      historico: [
        { id: 1, pedido_id: 1, de: '', para: 'aguardando', em: `${hoje}T09:30:00` },
        { id: 2, pedido_id: 1, de: 'aguardando', para: 'imprimindo', em: `${hoje}T10:00:00` },
      ],
    },
  ];

  const vendas: Venda[] = [
    {
      id: 1,
      pedido_id: null,
      cliente_id: 1,
      canal_id: 1,
      forma_pagamento: 'PIX',
      data: hoje,
      total: 30.0,
      custo: 9.7,
      taxa: 0,
      lucro: 20.3,
      status: 'ativa',
      itens: [
        {
          id: 1,
          venda_id: 1,
          produto_id: 1,
          descricao: 'Chaveiro Spotify Code',
          qtd: 2,
          preco_unit: 15.0,
          custo_unit: 4.85,
        },
      ],
    },
  ];

  const lancamentos: Lancamento[] = [
    {
      id: 1,
      tipo: 'receita',
      categoria: 'Vendas',
      natureza: 'variavel',
      descricao: 'Venda #1',
      valor: 30.0,
      vencimento: hoje,
      pago_em: hoje,
      venda_id: 1,
      recorrencia: '',
      gerou_proximo: false,
      cancelado: false,
    },
    {
      id: 2,
      tipo: 'despesa',
      categoria: 'Material',
      natureza: 'variavel',
      descricao: 'Compra de Filamento PLA Preto Voolt3D',
      valor: 95.0,
      vencimento: hoje,
      pago_em: hoje,
      venda_id: null,
      recorrencia: '',
      gerou_proximo: false,
      cancelado: false,
    },
  ];

  const tarefas: Tarefa[] = [
    {
      id: 1,
      titulo: 'Verificar nivelamento e bico da Bambu Lab A1',
      data: hoje,
      hora: '09:00',
      feita: false,
      recorrencia: 'semanal',
    },
    {
      id: 2,
      titulo: 'Pesagem e conferência dos rolos de filamento',
      data: hoje,
      hora: '17:30',
      feita: false,
      recorrencia: '',
    },
  ];

  return {
    config,
    impressoras,
    canais,
    clientes,
    materiais,
    rolos,
    insumos,
    movimentos,
    projetos,
    produtos,
    orcamentos,
    pedidos,
    vendas,
    lancamentos,
    tarefas,
  };
}

class DatabaseStore {
  private data: AppDatabase;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.data = this.load();
  }

  private load(): AppDatabase {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Erro ao carregar dados do localStorage, usando dados padrão:', e);
    }
    const def = createDefaultData();
    this.saveToStorage(def);
    return def;
  }

  private saveToStorage(d: AppDatabase) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    } catch (e) {
      console.error('Erro ao salvar no localStorage:', e);
    }
  }

  public get(): AppDatabase {
    return this.data;
  }

  public update(updater: (db: AppDatabase) => void) {
    updater(this.data);
    this.saveToStorage(this.data);
    this.notify();
  }

  public resetToDefault() {
    this.data = createDefaultData();
    this.saveToStorage(this.data);
    this.notify();
  }

  public importJson(jsonStr: string) {
    const parsed = JSON.parse(jsonStr);
    this.data = parsed;
    this.saveToStorage(this.data);
    this.notify();
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    for (const cb of this.listeners) {
      cb();
    }
  }
}

export const db = new DatabaseStore();
