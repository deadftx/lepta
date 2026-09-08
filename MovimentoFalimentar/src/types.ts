export type Tribunal = { code: string; alias: string; name: string };

export type RjItem = {
  processo: string;
  tribunal: string;
  tribunalNome: string;
  classe: string;
  empresa: string | null;
  cnpj: string | null;
  endereco: string | null;
  administradorJudicial: string | null;
  varaComarca: string | null;
  dataAjuizamento: string | null;
  dataCaptura: string;
  fonte: string;
  raw: unknown;
};
