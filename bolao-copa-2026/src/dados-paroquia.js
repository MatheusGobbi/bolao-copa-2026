// ============================================================
//  MODO PARÓQUIA — jogos do Brasil + elenco do Brasil
//  Conforme o cartaz, só importam os jogadores do BRASIL
//  ("apenas os gols marcados pela Seleção Brasileira").
//  Elenco editável pela comissão no painel admin.
// ============================================================

// Jogos do Brasil na fase de grupos (Grupo C)
export const JOGOS_BRASIL = [
  { id: "br1", casa: "Brasil",   fora: "Marrocos", iso: "2026-06-13T22:00:00Z" },
  { id: "br2", casa: "Brasil",   fora: "Haiti",    iso: "2026-06-20T00:30:00Z" },
  { id: "br3", casa: "Escócia",  fora: "Brasil",   iso: "2026-06-24T22:00:00Z" },
];

// Elenco do Brasil — 26 convocados por Ancelotti para a Copa 2026.
// Baseado nas listas divulgadas pela imprensa. Confira no admin antes de abrir:
// há 1-2 nomes que a imprensa divergiu (ex.: 3º goleiro Weverton/Bento).
export const ELENCO_INICIAL = [
  // Goleiros
  { id: "j01", nome: "Alisson",          posicao: "Goleiro" },
  { id: "j02", nome: "Ederson",          posicao: "Goleiro" },
  { id: "j03", nome: "Weverton",         posicao: "Goleiro" },
  // Defensores
  { id: "j04", nome: "Marquinhos",       posicao: "Zagueiro" },
  { id: "j05", nome: "Bremer",           posicao: "Zagueiro" },
  { id: "j06", nome: "Gabriel Magalhães", posicao: "Zagueiro" },
  { id: "j07", nome: "Léo Pereira",      posicao: "Zagueiro" },
  { id: "j08", nome: "Danilo",           posicao: "Lateral" },
  { id: "j09", nome: "Alex Sandro",      posicao: "Lateral" },
  { id: "j10", nome: "Wesley",           posicao: "Lateral" },
  { id: "j11", nome: "Douglas Santos",   posicao: "Lateral" },
  // Meio-campo
  { id: "j12", nome: "Casemiro",         posicao: "Volante" },
  { id: "j13", nome: "Bruno Guimarães",  posicao: "Meio-campo" },
  { id: "j14", nome: "Fabinho",          posicao: "Volante" },
  { id: "j15", nome: "Danilo (Botafogo)", posicao: "Meio-campo" },
  { id: "j16", nome: "Lucas Paquetá",    posicao: "Meio-campo" },
  // Atacantes
  { id: "j17", nome: "Vini Jr.",         posicao: "Atacante" },
  { id: "j18", nome: "Raphinha",         posicao: "Atacante" },
  { id: "j19", nome: "Neymar",           posicao: "Atacante" },
  { id: "j20", nome: "Matheus Cunha",    posicao: "Atacante" },
  { id: "j21", nome: "Endrick",          posicao: "Atacante" },
  { id: "j22", nome: "Rodrygo",          posicao: "Atacante" },
  { id: "j23", nome: "Gabriel Martinelli", posicao: "Atacante" },
  { id: "j24", nome: "Luiz Henrique",    posicao: "Atacante" },
  { id: "j25", nome: "Igor Thiago",      posicao: "Atacante" },
  { id: "j26", nome: "Rayan",            posicao: "Atacante" },
];
