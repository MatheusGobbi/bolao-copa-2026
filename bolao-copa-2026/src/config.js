// ============================================================
//  CONFIGURAÇÃO — preencha com os dados do seu projeto Supabase
//  (Supabase > Project Settings > API)
// ============================================================
import { createClient } from "@supabase/supabase-js";

// 1) Cole aqui a "Project URL"
const SUPABASE_URL = "https://cfzgvstgqbuuvyxxmvqe.supabase.co/rest/v1/";

// 2) Cole aqui a chave "anon public"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmemd2c3RncWJ1dXZ5eHhtdnFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MTkyNTksImV4cCI6MjA5NTk5NTI1OX0.T7dB_F3il0o6plin8n4p4WSxO9xG3Ch2BavMqZy5DMw";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- Outras configurações do bolão ----
export const ADMIN_PASSWORD = "copa2026"; // senha do painel admin
export const TRAVA_MINUTOS = 10;          // palpite fecha N min antes do jogo
export const LEAGUE_ID = 4429;            // FIFA World Cup na TheSportsDB
export const API_KEY = "123";             // chave pública gratuita
export const PONTOS = { exato: 5, parcial: 3, resultado: 2, erro: 0 };
