export interface BackupAgendamento {
  ativo: boolean;
  frequencia_horas: number; // ex: 24 (diário), 12, 6, 1
  formato: 'json' | 'csv' | 'xlsx';
  ultimo_backup_em: string | null; // ISO timestamp
  ultimo_backup_formato?: 'json' | 'csv' | 'xlsx' | null;
  ultimo_backup_tamanho?: number | null; // bytes
  ultimo_backup_status?: 'sucesso' | 'erro' | 'pendente' | null;
  baixar_automaticamente: boolean; // se deve baixar arquivo no navegador automaticamente
}

export interface BackupSnapshot {
  id: string;
  data: string; // ISO
  formato: 'json' | 'csv' | 'xlsx';
  nome_arquivo: string;
  tamanho: number;
  conteudo: string; // JSON string ou CSV data URI/base64
  itens: {
    clientes: number;
    produtos: number;
    rolos: number;
    insumos: number;
    pedidos: number;
    vendas: number;
  };
}

export interface Config {
  id: number;
  kwh: number;
  hora_trabalho: number;
  falhas_pct: number;
  margem_pct: number;
  custos_fixos_mes: number;
  horas_mes: number;
  cnpj: string;
  endereco: string;
  pix: string;
  mao_de_obra_lucro_pct?: number; // percentual padrão de mão de obra sobre o lucro geral (dashboard)
  backup_agendamento?: BackupAgendamento;
}

export interface Impressora {
  id: number;
  nome: string;
  watts: number;
  valor: number;
  vida_h: number;
  horas_acumuladas: number;
  manutencao_h: number; // R$/h
  ativo: boolean;
}

export interface Canal {
  id: number;
  nome: string;
  taxa_pct: number;
  taxa_fixa: number;
  ativo: boolean;
}

export interface Cliente {
  id: number;
  nome: string;
  telefone: string;
  email: string;
  documento: string;
  endereco: string;
  observacoes: string;
  ativo: boolean;
}

export interface Material {
  id: number;
  tipo: string; // PLA, PETG...
  cor: string;
  marca: string;
  minimo_g: number;
  ativo: boolean;
}

export interface Rolo {
  id: number;
  material_id: number;
  peso_inicial: number;
  preco: number;
  fornecedor: string;
  comprado_em: string;
  ativo: boolean;
}

export interface Insumo {
  id: number;
  nome: string;
  unidade: string;
  custo_unit: number;
  minimo: number;
  fornecedor: string;
  ativo: boolean;
}

export interface MovEstoque {
  id: number;
  item_tipo: 'rolo' | 'insumo' | 'produto';
  item_id: number;
  delta: number;
  motivo: 'compra' | 'producao' | 'falha' | 'venda' | 'ajuste';
  ref_tipo: string;
  ref_id: number;
  obs: string;
  em: string;
  valor?: number | null;
  data?: string | null;
  fornecedor?: string;
}

export interface Projeto {
  id: number;
  nome: string;
  descricao: string;
  categoria: string;
  arquivo: string;
  arquivo_nome: string;
  tamanho: number;
  foto: string;
  peso_g: number;
  tempo_min: number;
  criado_em: string;
  ativo: boolean;
}

export interface ProdutoMaterial {
  id: number;
  produto_id: number;
  material_id: number;
  gramas: number;
}

export interface ProdutoInsumo {
  id: number;
  produto_id: number;
  insumo_id: number;
  qtd: number;
}

export interface Produto {
  id: number;
  nome: string;
  sku: string;
  categoria: string;
  foto: string;
  modelo: string;
  projeto_id: number | null;
  tempo_min: number;
  impressora_id: number | null;
  preco: number;
  preco_manual: boolean;
  margem_pct: number;
  lote_qtd: number;
  fornecedor: string;
  minimo: number;
  embalagem: number;
  acessorios: number;
  min_trabalho: number;
  ativo: boolean;
  materiais: ProdutoMaterial[];
  insumos: ProdutoInsumo[];
}

export interface ItemOrcamento {
  id: number;
  orcamento_id: number;
  produto_id: number | null;
  descricao: string;
  personalizacao: string;
  qtd: number;
  preco_unit: number;
  custo_unit: number;
}

export interface Orcamento {
  id: number;
  cliente_id: number;
  canal_id: number | null;
  data: string;
  validade_dias: number;
  desconto: number;
  frete: number;
  prazo: string;
  pagamento: string;
  observacoes: string;
  status: 'aberto' | 'aprovado' | 'recusado';
  itens: ItemOrcamento[];
}

export interface PedidoItem {
  id: number;
  pedido_id: number;
  produto_id: number | null;
  descricao: string;
  personalizacao: string;
  qtd: number;
  preco_unit: number;
  custo_unit: number;
  qtd_pronta: number;
}

export interface PedidoHistorico {
  id: number;
  pedido_id: number;
  de: string;
  para: string;
  em: string;
}

export type PedidoStatus =
  | 'aguardando'
  | 'imprimindo'
  | 'acabamento'
  | 'pronto'
  | 'enviado'
  | 'entregue'
  | 'cancelado';

export interface Pedido {
  id: number;
  orcamento_id: number | null;
  cliente_id: number | null;
  canal_id: number | null;
  tipo: 'cliente' | 'estoque';
  status: PedidoStatus;
  prazo: string | null;
  observacoes: string;
  desconto: number;
  frete: number;
  custo_extra: number;
  do_estoque: boolean;
  criado_em: string;
  itens: PedidoItem[];
  historico: PedidoHistorico[];
}

export interface VendaItem {
  id: number;
  venda_id: number;
  produto_id: number | null;
  descricao: string;
  qtd: number;
  preco_unit: number;
  custo_unit: number;
}

export interface Venda {
  id: number;
  pedido_id: number | null;
  cliente_id: number | null;
  canal_id: number | null;
  forma_pagamento: string;
  data: string;
  total: number;
  custo: number;
  taxa: number;
  lucro: number;
  status: 'ativa' | 'estornada';
  itens: VendaItem[];
}

export interface Lancamento {
  id: number;
  tipo: 'receita' | 'despesa';
  categoria: string;
  natureza: 'fixa' | 'variavel';
  descricao: string;
  valor: number;
  vencimento: string;
  pago_em: string | null;
  venda_id: number | null;
  recorrencia: '' | 'mensal';
  gerou_proximo: boolean;
  cancelado: boolean;
}

export interface Tarefa {
  id: number;
  titulo: string;
  data: string;
  hora: string;
  feita: boolean;
  recorrencia: '' | 'diaria' | 'semanal';
}

export interface StockAlert {
  tipo: string;
  nome: string;
  key: string;
  saldo: number;
  minimo: number;
  status: 'acabou' | 'acabando';
}
