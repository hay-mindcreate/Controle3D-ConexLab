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

const STORAGE_KEY = 'conexlab_3d_db_v3';

function createDefaultData(): AppDatabase {
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
      nome: 'Impressora 3D',
      watts: 150,
      valor: 3500,
      vida_h: 5000,
      horas_acumuladas: 0,
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

  return {
    config,
    impressoras,
    canais,
    clientes: [],
    materiais: [],
    rolos: [],
    insumos: [],
    movimentos: [],
    projetos: [],
    produtos: [],
    orcamentos: [],
    pedidos: [],
    vendas: [],
    lancamentos: [],
    tarefas: [],
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
      // Limpa chaves legadas que continham dados mockados de teste
      try {
        localStorage.removeItem('conexlab_3d_db_v1');
        localStorage.removeItem('conexlab_3d_db_v2');
      } catch {}

      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: AppDatabase = JSON.parse(saved);
        // Se ainda contiver dados de teste mockados antigos (Ana Paula, Chaveiro Spotify, Carlos Eduardo, etc.), limpa
        const temMock =
          parsed.clientes?.some((c) => c.nome === 'Ana Paula Silva' || c.nome === 'Carlos Eduardo Santos') ||
          parsed.produtos?.some((p) => p.sku === 'P0001' || p.nome?.includes('Spotify Code')) ||
          parsed.rolos?.some((r) => r.fornecedor === 'Loja 3D Brasil');

        if (temMock) {
          const limpo = createDefaultData();
          this.saveToStorage(limpo);
          return limpo;
        }

        // Garante que todos os arrays existam
        parsed.clientes = parsed.clientes || [];
        parsed.materiais = parsed.materiais || [];
        parsed.rolos = parsed.rolos || [];
        parsed.insumos = parsed.insumos || [];
        parsed.movimentos = parsed.movimentos || [];
        parsed.projetos = parsed.projetos || [];
        parsed.produtos = parsed.produtos || [];
        parsed.orcamentos = parsed.orcamentos || [];
        parsed.pedidos = parsed.pedidos || [];
        parsed.vendas = parsed.vendas || [];
        parsed.lancamentos = parsed.lancamentos || [];
        parsed.tarefas = parsed.tarefas || [];
        parsed.impressoras = parsed.impressoras || [];
        parsed.canais = parsed.canais || [];
        return parsed;
      }
    } catch (e) {
      console.warn('Erro ao carregar dados do localStorage, usando base limpa:', e);
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

  public limparTodosDados() {
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
