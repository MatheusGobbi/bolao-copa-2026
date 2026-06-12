// ============================================================
//  CONFIGURAÇÃO — preencha com os dados do seu projeto Supabase
//  (Supabase > Project Settings > API)
// ============================================================
import { createClient } from "@supabase/supabase-js";

// 1) Cole aqui a "Project URL"
const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";

// 2) Cole aqui a chave "anon public"
const SUPABASE_ANON_KEY = "SUA_CHAVE_ANON_PUBLIC";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- Outras configurações do bolão ----
export const ADMIN_PASSWORD = "copa2026"; // senha do painel admin
export const TRAVA_MINUTOS = 10;          // palpite fecha N min antes do jogo
export const LEAGUE_ID = 4429;            // FIFA World Cup na TheSportsDB
export const API_KEY = "123";             // chave pública gratuita
export const PONTOS = { exato: 5, parcial: 3, resultado: 3, erro: 0 };
// Regras: 5 pts placar exato · 3 pts acertar vitória/empate (resultado)
