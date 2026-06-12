// ============================================================
//  CONFIGURAÇÃO — dados do seu projeto Supabase
//  (Supabase > Project Settings > API)
// ============================================================
import { createClient } from "@supabase/supabase-js";

// 1) Project URL (já preenchida com a sua)
const SUPABASE_URL = "https://cfzgvstgqbuuvyxxmvqe.supabase.co";

// 2) >>> COLE AQUI a chave "anon public" <<<
//    Supabase > Project Settings > API > Project API keys > "anon public"
//    Apague o texto COLE_SUA_CHAVE_ANON_AQUI e ponha a chave longa entre as aspas.
const SUPABASE_ANON_KEY = "COLE_SUA_CHAVE_ANON_AQUI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- Outras configurações do bolão ----
export const ADMIN_PASSWORD = "copa2026"; // senha do painel admin
export const TRAVA_MINUTOS = 10;          // palpite fecha N min antes do jogo
export const LEAGUE_ID = 4429;            // FIFA World Cup na TheSportsDB
export const API_KEY = "123";             // chave pública gratuita
export const PONTOS = { exato: 5, parcial: 3, resultado: 3, erro: 0 };
// Regras: 5 pts placar exato · 3 pts acertar vitória/empate (resultado)
