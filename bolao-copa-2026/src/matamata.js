// ============================================================
//  MATA-MATA da Copa 2026 — estrutura completa até a final.
//  Os 16 jogos do Round of 32 já têm os times definidos.
//  As fases seguintes têm o "caminho" fixo: cada jogo aponta
//  de quais jogos vêm os finalistas (origem casa/fora).
//  Horários em UTC. Pontuação = igual à fase de grupos.
// ============================================================

// fase: "r32" (16 avos), "r16" (oitavas), "qf" (quartas), "sf" (semi), "final"
export const FASES_MATA = [
  { id: "r32", nome: "16 avos" },
  { id: "r16", nome: "Oitavas" },
  { id: "qf",  nome: "Quartas" },
  { id: "sf",  nome: "Semifinal" },
  { id: "final", nome: "Final" },
];

// Round of 32 — times JÁ definidos
export const MATA_JOGOS = [
  // --- Round of 32 ---
  { id: "ko73", fase: "r32", casa: "África do Sul", fora: "Canadá",        iso: "2026-06-28T19:00:00Z" },
  { id: "ko76", fase: "r32", casa: "Brasil",        fora: "Japão",         iso: "2026-06-29T17:00:00Z" },
  { id: "ko74", fase: "r32", casa: "Alemanha",      fora: "Paraguai",      iso: "2026-06-29T20:30:00Z" },
  { id: "ko75", fase: "r32", casa: "Holanda",       fora: "Marrocos",      iso: "2026-06-30T01:00:00Z" },
  { id: "ko78", fase: "r32", casa: "Costa do Marfim", fora: "Noruega",     iso: "2026-06-30T17:00:00Z" },
  { id: "ko77", fase: "r32", casa: "França",        fora: "Suécia",        iso: "2026-06-30T21:00:00Z" },
  { id: "ko79", fase: "r32", casa: "México",        fora: "Equador",       iso: "2026-07-01T01:00:00Z" },
  { id: "ko80", fase: "r32", casa: "Inglaterra",    fora: "DR Congo",      iso: "2026-07-01T16:00:00Z" },
  { id: "ko82", fase: "r32", casa: "Bélgica",       fora: "Senegal",       iso: "2026-07-01T20:00:00Z" },
  { id: "ko81", fase: "r32", casa: "EUA",           fora: "Bósnia e Herzegovina", iso: "2026-07-02T00:00:00Z" },
  { id: "ko84", fase: "r32", casa: "Espanha",       fora: "Áustria",       iso: "2026-07-02T19:00:00Z" },
  { id: "ko83", fase: "r32", casa: "Portugal",      fora: "Croácia",       iso: "2026-07-02T23:00:00Z" },
  { id: "ko85", fase: "r32", casa: "Suíça",         fora: "Argélia",       iso: "2026-07-03T03:00:00Z" },
  { id: "ko88", fase: "r32", casa: "Austrália",     fora: "Egito",         iso: "2026-07-03T18:00:00Z" },
  { id: "ko86", fase: "r32", casa: "Argentina",     fora: "Cabo Verde",    iso: "2026-07-03T22:00:00Z" },
  { id: "ko87", fase: "r32", casa: "Colômbia",      fora: "Gana",          iso: "2026-07-04T01:30:00Z" },

  // --- Oitavas (R16): origem = vencedores do R32 ---
  { id: "ko90", fase: "r16", deCasa: "ko73", deFora: "ko75", iso: "2026-07-04T17:00:00Z" },
  { id: "ko89", fase: "r16", deCasa: "ko74", deFora: "ko77", iso: "2026-07-04T21:00:00Z" },
  { id: "ko91", fase: "r16", deCasa: "ko76", deFora: "ko78", iso: "2026-07-05T20:00:00Z" },
  { id: "ko92", fase: "r16", deCasa: "ko79", deFora: "ko80", iso: "2026-07-06T00:00:00Z" },
  { id: "ko93", fase: "r16", deCasa: "ko83", deFora: "ko84", iso: "2026-07-06T19:00:00Z" },
  { id: "ko94", fase: "r16", deCasa: "ko81", deFora: "ko82", iso: "2026-07-06T23:00:00Z" },
  { id: "ko95", fase: "r16", deCasa: "ko86", deFora: "ko88", iso: "2026-07-07T20:00:00Z" },
  { id: "ko96", fase: "r16", deCasa: "ko85", deFora: "ko87", iso: "2026-07-07T23:00:00Z" },

  // --- Quartas (QF) ---
  { id: "ko97",  fase: "qf", deCasa: "ko89", deFora: "ko90", iso: "2026-07-09T21:00:00Z" },
  { id: "ko98",  fase: "qf", deCasa: "ko93", deFora: "ko94", iso: "2026-07-10T19:00:00Z" },
  { id: "ko99",  fase: "qf", deCasa: "ko91", deFora: "ko92", iso: "2026-07-10T23:00:00Z" },
  { id: "ko100", fase: "qf", deCasa: "ko95", deFora: "ko96", iso: "2026-07-11T01:00:00Z" },

  // --- Semifinais (SF) ---
  { id: "ko101", fase: "sf", deCasa: "ko97", deFora: "ko98",  iso: "2026-07-14T19:00:00Z" },
  { id: "ko102", fase: "sf", deCasa: "ko99", deFora: "ko100", iso: "2026-07-15T19:00:00Z" },

  // --- Final ---
  { id: "ko104", fase: "final", deCasa: "ko101", deFora: "ko102", iso: "2026-07-19T19:00:00Z" },
];

// rótulo de origem quando o time ainda não é conhecido (ex: "Vencedor 16 avos")
export const ROTULO_FASE_ORIGEM = { r32: "16 avos", r16: "oitavas", qf: "quartas", sf: "semi" };
