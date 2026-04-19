// Centralized mock data for ESC LOG ERP

export type Status = "ok" | "inconsistente" | "ajustado" | "pendente" | "incompleto";

export interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
  unidade: string;
  cidade: string;
  uf: string;
  colaboradores: number;
  coletores: number;
  status: "ativa" | "inativa";
}

export const empresas: Empresa[] = [
  { id: "EMP-01", nome: "Transvolume Logística", cnpj: "12.345.678/0001-90", unidade: "Matriz SP", cidade: "São Paulo", uf: "SP", colaboradores: 6, coletores: 2, status: "ativa" },
  { id: "EMP-02", nome: "RodoCarga Express", cnpj: "23.456.789/0001-12", unidade: "Filial Campinas", cidade: "Campinas", uf: "SP", colaboradores: 3, coletores: 1, status: "ativa" },
  { id: "EMP-03", nome: "Express SP Transportes", cnpj: "34.567.890/0001-34", unidade: "Matriz", cidade: "Guarulhos", uf: "SP", colaboradores: 2, coletores: 1, status: "ativa" },
  { id: "EMP-04", nome: "LogPort Brasil", cnpj: "45.678.901/0001-56", unidade: "Filial Santos", cidade: "Santos", uf: "SP", colaboradores: 1, coletores: 1, status: "inativa" },
];

export interface Coletor {
  id: string;
  modelo: string;
  serie: string;
  empresaId: string;
  empresa: string;
  ultimaSync: string;
  registros: number;
  status: "online" | "offline" | "erro";
}

export const coletores: Coletor[] = [
  { id: "REP-01", modelo: "Henry Prisma R03", serie: "HPR-19283", empresaId: "EMP-01", empresa: "Transvolume Logística", ultimaSync: "Há 2 min", registros: 247, status: "online" },
  { id: "REP-02", modelo: "Henry Prisma R03", serie: "HPR-19284", empresaId: "EMP-01", empresa: "Transvolume Logística", ultimaSync: "Há 18 min", registros: 89, status: "erro" },
  { id: "REP-03", modelo: "Topdata Inner Rep", serie: "TDR-55102", empresaId: "EMP-02", empresa: "RodoCarga Express", ultimaSync: "Há 5 min", registros: 156, status: "online" },
  { id: "REP-04", modelo: "Control iD iDClass", serie: "CID-90021", empresaId: "EMP-03", empresa: "Express SP Transportes", ultimaSync: "Há 1 min", registros: 78, status: "online" },
  { id: "REP-05", modelo: "Henry Prisma R03", serie: "HPR-19999", empresaId: "EMP-04", empresa: "LogPort Brasil", ultimaSync: "Há 3 dias", registros: 0, status: "offline" },
];

export interface Colaborador {
  id: string;
  nome: string;
  cargo: string;
  empresaId: string;
  empresa: string;
  contrato: "Hora" | "Operação";
  valorBase: number; // valor hora ou valor operação
  faturamento: boolean;
  status: Status;
  admissao: string;
  matricula: string;
}

export const colaboradores: Colaborador[] = [
  { id: "C001", nome: "Imelda Hakim", cargo: "Operadora", empresaId: "EMP-01", empresa: "Transvolume Logística", contrato: "Hora", valorBase: 22, faturamento: true, status: "ok", admissao: "12/03/2023", matricula: "0012" },
  { id: "C002", nome: "Hikmat Sofyan", cargo: "Operador", empresaId: "EMP-01", empresa: "Transvolume Logística", contrato: "Operação", valorBase: 35, faturamento: true, status: "inconsistente", admissao: "05/08/2022", matricula: "0034" },
  { id: "C003", nome: "Ita Septiasari", cargo: "Conferente", empresaId: "EMP-01", empresa: "Transvolume Logística", contrato: "Hora", valorBase: 22, faturamento: true, status: "ok", admissao: "20/01/2024", matricula: "0051" },
  { id: "C004", nome: "Hendy", cargo: "Operador", empresaId: "EMP-02", empresa: "RodoCarga Express", contrato: "Hora", valorBase: 20, faturamento: false, status: "ajustado", admissao: "14/06/2023", matricula: "0078" },
  { id: "C005", nome: "Jainudin", cargo: "Conferente", empresaId: "EMP-02", empresa: "RodoCarga Express", contrato: "Hora", valorBase: 22, faturamento: true, status: "incompleto", admissao: "02/02/2025", matricula: "0102" },
  { id: "C006", nome: "Ahmad Indrawan", cargo: "Conferente", empresaId: "EMP-03", empresa: "Express SP Transportes", contrato: "Hora", valorBase: 22, faturamento: true, status: "ok", admissao: "18/09/2023", matricula: "0066" },
  { id: "C007", nome: "Joko Joko", cargo: "Operador", empresaId: "EMP-01", empresa: "Transvolume Logística", contrato: "Hora", valorBase: 22, faturamento: true, status: "ok", admissao: "30/11/2022", matricula: "0023" },
];

export interface PontoRow {
  colaboradorId: string;
  nome: string;
  cargo: string;
  empresa: string;
  entrada: string;
  saidaAlmoco: string;
  retornoAlmoco: string;
  saida: string;
  horas: string;
  extras: string;
  periodo: "Diurno" | "Noturno";
  tipoDia: "Normal" | "Domingo" | "Feriado";
  valorDia: string;
  status: Status;
  alert?: boolean;
}

export const pontoRows: PontoRow[] = [
  { colaboradorId: "C005", nome: "Jainudin", cargo: "Conferente", empresa: "RodoCarga Express", entrada: "08:00", saidaAlmoco: "12:00", retornoAlmoco: "13:00", saida: "—", horas: "0h00", extras: "—", periodo: "Diurno", tipoDia: "Normal", valorDia: "—", status: "incompleto", alert: true },
  { colaboradorId: "C001", nome: "Imelda Hakim", cargo: "Operadora", empresa: "Transvolume Logística", entrada: "08:02", saidaAlmoco: "12:05", retornoAlmoco: "13:00", saida: "17:10", horas: "8h08", extras: "0h08", periodo: "Diurno", tipoDia: "Normal", valorDia: "R$ 178,93", status: "ok" },
  { colaboradorId: "C003", nome: "Ita Septiasari", cargo: "Conferente", empresa: "Transvolume Logística", entrada: "08:00", saidaAlmoco: "12:00", retornoAlmoco: "13:00", saida: "18:30", horas: "9h30", extras: "1h30", periodo: "Diurno", tipoDia: "Normal", valorDia: "R$ 209,00", status: "ok" },
  { colaboradorId: "C004", nome: "Hendy", cargo: "Operador", empresa: "RodoCarga Express", entrada: "08:00", saidaAlmoco: "12:00", retornoAlmoco: "12:55", saida: "15:05", horas: "6h05", extras: "—", periodo: "Diurno", tipoDia: "Normal", valorDia: "R$ 121,67", status: "ajustado" },
  { colaboradorId: "C002", nome: "Hikmat Sofyan", cargo: "Operador", empresa: "Transvolume Logística", entrada: "08:00", saidaAlmoco: "12:10", retornoAlmoco: "13:05", saida: "18:22", horas: "9h22", extras: "1h22", periodo: "Diurno", tipoDia: "Normal", valorDia: "R$ 206,00", status: "inconsistente", alert: true },
  { colaboradorId: "C006", nome: "Ahmad Indrawan", cargo: "Conferente", empresa: "Express SP Transportes", entrada: "08:00", saidaAlmoco: "12:00", retornoAlmoco: "13:00", saida: "16:20", horas: "7h20", extras: "—", periodo: "Diurno", tipoDia: "Normal", valorDia: "R$ 161,33", status: "ok" },
  { colaboradorId: "C007", nome: "Joko Joko", cargo: "Operador", empresa: "Transvolume Logística", entrada: "08:00", saidaAlmoco: "12:00", retornoAlmoco: "13:00", saida: "17:12", horas: "8h12", extras: "0h12", periodo: "Diurno", tipoDia: "Normal", valorDia: "R$ 180,40", status: "ok" },
];

export interface OperacaoRow {
  id: string;
  transp: string;
  servico: "Volume" | "Carro";
  qtd: number;
  ini: string;
  fim: string;
  produto: string;
  valorUnit: number;
  valor: string;
  valorDia: string;
  status: Status;
  alert?: boolean;
  responsavelId?: string;
}

export const opsRows: OperacaoRow[] = [
  { id: "OP-1041", transp: "Transvolume", servico: "Volume", qtd: 320, ini: "08:00", fim: "11:30", produto: "Eletro", valorUnit: 4, valor: "R$ 1.280,00", valorDia: "R$ 1.280,00", status: "ok", responsavelId: "C001" },
  { id: "OP-1042", transp: "RodoCarga", servico: "Carro", qtd: 4, ini: "09:15", fim: "12:00", produto: "Móveis", valorUnit: 230, valor: "R$ 920,00", valorDia: "R$ 920,00", status: "inconsistente", alert: true, responsavelId: "C002" },
  { id: "OP-1043", transp: "Transvolume", servico: "Volume", qtd: 180, ini: "13:00", fim: "15:40", produto: "Bebidas", valorUnit: 4, valor: "R$ 720,00", valorDia: "R$ 720,00", status: "pendente", responsavelId: "C003" },
  { id: "OP-1044", transp: "Express SP", servico: "Carro", qtd: 2, ini: "14:00", fim: "16:30", produto: "Diversos", valorUnit: 230, valor: "R$ 460,00", valorDia: "R$ 460,00", status: "ok", responsavelId: "C006" },
  { id: "OP-1045", transp: "RodoCarga", servico: "Volume", qtd: 500, ini: "16:00", fim: "16:20", produto: "Eletro", valorUnit: 4, valor: "R$ 2.000,00", valorDia: "R$ 2.000,00", status: "inconsistente", alert: true, responsavelId: "C007" },
];

// Série semanal para gráfico do dashboard
export const serieSemanal = [
  { dia: "Seg", operacoes: 6, valor: 2480, colaboradores: 10 },
  { dia: "Ter", operacoes: 8, valor: 3100, colaboradores: 11 },
  { dia: "Qua", operacoes: 5, valor: 1920, colaboradores: 9 },
  { dia: "Qui", operacoes: 9, valor: 3450, colaboradores: 12 },
  { dia: "Sex", operacoes: 7, valor: 2890, colaboradores: 11 },
  { dia: "Sáb", operacoes: 4, valor: 1620, colaboradores: 7 },
  { dia: "Dom", operacoes: 8, valor: 3189, colaboradores: 12 },
];

// Importações (sincronizações)
export interface Importacao {
  id: string;
  data: string;
  origem: string;
  empresa: string;
  registros: number;
  status: "sucesso" | "erro" | "parcial";
  duracao: string;
}

export const importacoes: Importacao[] = [
  { id: "SYNC-2031", data: "07/03/2025 14:32", origem: "REP-01", empresa: "Transvolume Logística", registros: 247, status: "sucesso", duracao: "2.3s" },
  { id: "SYNC-2030", data: "07/03/2025 14:14", origem: "REP-02", empresa: "Transvolume Logística", registros: 89, status: "erro", duracao: "5.1s" },
  { id: "SYNC-2029", data: "07/03/2025 13:55", origem: "REP-03", empresa: "RodoCarga Express", registros: 156, status: "sucesso", duracao: "1.9s" },
  { id: "SYNC-2028", data: "07/03/2025 13:40", origem: "REP-04", empresa: "Express SP Transportes", registros: 78, status: "sucesso", duracao: "1.2s" },
  { id: "SYNC-2027", data: "07/03/2025 12:01", origem: "Manual (CSV)", empresa: "RodoCarga Express", registros: 42, status: "parcial", duracao: "3.5s" },
];

// Fechamento mensal
export const fechamentos = [
  { periodo: "Fevereiro 2025", totalDias: 28, operacoes: 198, valor: "R$ 84.320,00", inconsistencias: 0, status: "fechado" as const, fechadoEm: "01/03/2025" },
  { periodo: "Janeiro 2025", totalDias: 31, operacoes: 215, valor: "R$ 92.140,00", inconsistencias: 0, status: "fechado" as const, fechadoEm: "01/02/2025" },
  { periodo: "Março 2025", totalDias: 7, operacoes: 47, valor: "R$ 21.430,00", inconsistencias: 3, status: "aberto" as const, fechadoEm: "—" },
  { periodo: "Dezembro 2024", totalDias: 31, operacoes: 178, valor: "R$ 76.890,00", inconsistencias: 0, status: "fechado" as const, fechadoEm: "02/01/2025" },
];
