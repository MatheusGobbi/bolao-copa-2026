import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase, ADMIN_PASSWORD, TRAVA_MINUTOS, LEAGUE_ID, API_KEY, PONTOS } from "./config";
import { JOGOS_OFICIAIS } from "./jogos";

const COLS = {
  bg: "#0a1f0f", card: "#11331a", cardAlt: "#0d2814", line: "#1d5230",
  gold: "#f5c542", goldDim: "#b8911f", green: "#2fbf6b", red: "#e0533d",
  text: "#eaf4ec", textDim: "#8fb89a", white: "#ffffff",
};
const API_BASE = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`;

// normaliza nome de time p/ casar com a API (sem acento, minúsculo)
function norm(s) {
  return (s || "").toString().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
}
// apelidos p/ casar nomes diferentes entre nossa tabela e a TheSportsDB (em inglês)
const APELIDOS = {
  mexico: "mexico", africadosul: "southafrica", coreiadosul: "southkorea",
  republicatcheca: "czechrepublic", canada: "canada", bosniaeherzegovina: "bosnia",
  estadosunidos: "usa", paraguai: "paraguay", catar: "qatar", suica: "switzerland",
  brasil: "brazil", marrocos: "morocco", haiti: "haiti", escocia: "scotland",
  australia: "australia", turquia: "turkey", alemanha: "germany", curacao: "curacao",
  holanda: "netherlands", japao: "japan", costadomarfim: "ivorycoast",
  equador: "ecuador", suecia: "sweden", tunisia: "tunisia", espanha: "spain",
  caboverde: "capeverde", belgica: "belgium", egito: "egypt",
  arabiasaudita: "saudiarabia", uruguai: "uruguay", ira: "iran",
  novazelandia: "newzealand", franca: "france", senegal: "senegal",
  iraque: "iraq", noruega: "norway", argentina: "argentina", argelia: "algeria",
  austria: "austria", jordania: "jordan", portugal: "portugal", rdcongo: "drcongo",
  inglaterra: "england", croacia: "croatia", gana: "ghana", panama: "panama",
  uzbequistao: "uzbekistan", colombia: "colombia",
};
const chaveTime = (s) => APELIDOS[norm(s)] || norm(s);
const chaveJogo = (casa, fora) => `${chaveTime(casa)}__${chaveTime(fora)}`;

function calcPontos(palpite, resultado) {
  if (!resultado || resultado.casa == null || resultado.fora == null) return null;
  if (!palpite || palpite.casa == null || palpite.casa === "" || palpite.fora == null || palpite.fora === "") return null;
  const pc = Number(palpite.casa), pf = Number(palpite.fora);
  const rc = Number(resultado.casa), rf = Number(resultado.fora);
  if (pc === rc && pf === rf) return PONTOS.exato;
  const s = (a, b) => (a > b ? 1 : a < b ? -1 : 0);
  const venceu = s(pc, pf) === s(rc, rf);
  if (venceu && (pc === rc || pf === rf)) return PONTOS.parcial;
  if (venceu) return PONTOS.resultado;
  return PONTOS.erro;
}

function fmtData(iso) {
  if (!iso) return "data a definir";
  const d = new Date(iso);
  if (isNaN(d)) return "data a definir";
  return d.toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function jogoFechado(jogo, resultado) {
  if (resultado && resultado.casa != null && resultado.fora != null) return true;
  if (!jogo.iso) return false;
  const inicio = new Date(jogo.iso).getTime();
  if (isNaN(inicio)) return false;
  return Date.now() >= inicio - TRAVA_MINUTOS * 60 * 1000;
}

export default function App() {
  const [tab, setTab] = useState("palpites");
  const [jogos, setJogos] = useState(JOGOS_OFICIAIS); // base; substituída pelos jogos do banco
  const [resultadosManuais, setResultadosManuais] = useState({});
  const [apiResultados, setApiResultados] = useState({}); // casados por nome
  const [palpitesTodos, setPalpitesTodos] = useState({});
  const [usuarios, setUsuarios] = useState([]); // todos os cadastrados

  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [logado, setLogado] = useState(false);
  const [authMsg, setAuthMsg] = useState("");
  const [carregandoAuth, setCarregandoAuth] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [senhaAdmin, setSenhaAdmin] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState("");
  const [, force] = useState(0);

  const resultadoFinal = useCallback(
    (jogoId, casa, fora) =>
      resultadosManuais[jogoId] || apiResultados[chaveJogo(casa, fora)] || null,
    [resultadosManuais, apiResultados]
  );

  const carregarBanco = useCallback(async () => {
    // Jogos: lê do banco. Se estiver vazio, semeia com a tabela curada (1x).
    const { data: jg } = await supabase.from("jogos").select("*").order("ordem", { ascending: true });
    if (jg && jg.length) {
      setJogos(jg.map(j => ({ id: j.id, grupo: j.grupo, casa: j.casa, fora: j.fora, iso: j.iso })));
    } else {
      const semente = JOGOS_OFICIAIS.map((j, i) => ({ ...j, ordem: i }));
      await supabase.from("jogos").upsert(semente, { onConflict: "id" });
      setJogos(JOGOS_OFICIAIS);
    }
    const { data: us } = await supabase.from("usuarios").select("nome");
    if (us) setUsuarios(us.map(u => u.nome));
    const { data: pal } = await supabase.from("palpites").select("*");
    if (pal) {
      const todos = {};
      for (const p of pal) {
        if (!todos[p.nome]) todos[p.nome] = {};
        todos[p.nome][p.jogo_id] = { casa: p.casa, fora: p.fora };
      }
      setPalpitesTodos(todos);
    }
    const { data: res } = await supabase.from("resultados_manuais").select("*");
    if (res) {
      const m = {};
      for (const r of res) if (r.casa != null && r.fora != null) m[r.jogo_id] = { casa: r.casa, fora: r.fora };
      setResultadosManuais(m);
    }
  }, []);

  // Sincroniza SÓ resultados da API, casando por nome — nunca mexe na lista de jogos
  const sincronizar = useCallback(async () => {
    setSyncStatus("sincronizando");
    try {
      const passados = await fetch(`${API_BASE}/eventspastleague.php?id=${LEAGUE_ID}`).then(r => r.json()).catch(() => null);
      const ar = {};
      if (passados?.events) {
        for (const ev of passados.events) {
          if (ev.intHomeScore == null || ev.intHomeScore === "" || ev.intAwayScore == null || ev.intAwayScore === "") continue;
          // só jogos de 2026 em diante
          const dt = ev.dateEvent ? new Date(`${ev.dateEvent}T00:00:00Z`).getTime() : NaN;
          if (isNaN(dt) || dt < new Date("2026-01-01T00:00:00Z").getTime()) continue;
          const k = chaveJogo(ev.strHomeTeam, ev.strAwayTeam);
          ar[k] = { casa: Number(ev.intHomeScore), fora: Number(ev.intAwayScore) };
        }
      }
      setApiResultados(ar);
      setSyncStatus(Object.keys(ar).length ? "ok" : "sem-resultados");
    } catch { setSyncStatus("erro"); }
  }, []);

  useEffect(() => {
    (async () => {
      const salvo = localStorage.getItem("bolao:auth");
      if (salvo) { try { const a = JSON.parse(salvo); setNome(a.nome); setLogado(true); } catch {} }
      await carregarBanco();
      setLoading(false);
      sincronizar();
    })();
  }, [carregarBanco, sincronizar]);

  useEffect(() => { const t = setInterval(() => force(n => n + 1), 30000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!logado) return;
    const t = setInterval(carregarBanco, 25000);
    return () => clearInterval(t);
  }, [logado, carregarBanco]);

  const meusPalpites = palpitesTodos[nome] || {};

  async function criarConta() {
    const n = nome.trim(); if (!n || !senha) { setAuthMsg("Preencha nome e senha."); return; }
    setCarregandoAuth(true); setAuthMsg("");
    const { data: existe } = await supabase.from("usuarios").select("nome").eq("nome", n).maybeSingle();
    if (existe) { setAuthMsg("Esse nome já existe. Tente entrar."); setCarregandoAuth(false); return; }
    const { error } = await supabase.from("usuarios").insert({ nome: n, senha });
    setCarregandoAuth(false);
    if (error) { setAuthMsg("Erro ao criar conta."); return; }
    localStorage.setItem("bolao:auth", JSON.stringify({ nome: n }));
    setLogado(true); carregarBanco();
  }
  async function entrar() {
    const n = nome.trim(); if (!n || !senha) { setAuthMsg("Preencha nome e senha."); return; }
    setCarregandoAuth(true); setAuthMsg("");
    const { data: u } = await supabase.from("usuarios").select("*").eq("nome", n).maybeSingle();
    setCarregandoAuth(false);
    if (!u) { setAuthMsg("Conta não encontrada. Crie uma conta."); return; }
    if (u.senha !== senha) { setAuthMsg("Senha incorreta."); return; }
    localStorage.setItem("bolao:auth", JSON.stringify({ nome: n }));
    setLogado(true); carregarBanco();
  }
  function sair() { localStorage.removeItem("bolao:auth"); setLogado(false); setIsAdmin(false); setSenha(""); }

  async function salvarPalpite(jogoId, campo, valor) {
    const v = valor === "" ? null : Number(valor);
    const atual = palpitesTodos[nome]?.[jogoId] || { casa: null, fora: null };
    const novo = { ...atual, [campo]: v };
    setPalpitesTodos(p => ({ ...p, [nome]: { ...(p[nome] || {}), [jogoId]: novo } }));
    await supabase.from("palpites").upsert(
      { nome, jogo_id: jogoId, casa: novo.casa, fora: novo.fora, atualizado_em: new Date().toISOString() },
      { onConflict: "nome,jogo_id" }
    );
  }
  async function salvarResultadoManual(jogoId, campo, valor) {
    const v = valor === "" ? null : Number(valor);
    const atual = resultadosManuais[jogoId] || { casa: null, fora: null };
    const novo = { ...atual, [campo]: v };
    setResultadosManuais(r => ({ ...r, [jogoId]: novo }));
    if (novo.casa == null && novo.fora == null) {
      await supabase.from("resultados_manuais").delete().eq("jogo_id", jogoId);
    } else {
      await supabase.from("resultados_manuais").upsert(
        { jogo_id: jogoId, casa: novo.casa, fora: novo.fora, atualizado_em: new Date().toISOString() },
        { onConflict: "jogo_id" }
      );
    }
  }

  // Ranking: TODOS os cadastrados, mesmo zerados
  const ranking = useMemo(() => {
    return usuarios.map((jogador) => {
      let total = 0, exatos = 0, jogados = 0;
      const pal = palpitesTodos[jogador] || {};
      for (const jg of jogos) {
        const p = calcPontos(pal[jg.id], resultadoFinal(jg.id, jg.casa, jg.fora));
        if (p != null) { total += p; jogados++; if (p === PONTOS.exato) exatos++; }
      }
      return { jogador, total, exatos, jogados };
    }).sort((a, b) => b.total - a.total || b.exatos - a.exatos || a.jogador.localeCompare(b.jogador));
  }, [usuarios, palpitesTodos, jogos, resultadoFinal]);

  // Agrupa jogos por grupo para a tela de palpites
  const porGrupo = useMemo(() => {
    const g = {};
    for (const jg of jogos) { (g[jg.grupo] = g[jg.grupo] || []).push(jg); }
    return Object.keys(g).sort().map(k => ({ grupo: k, jogos: g[k] }));
  }, [jogos]);

  if (loading) return (
    <div style={{ ...S.app, display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: COLS.gold, fontFamily: "Georgia, serif" }}>Carregando o bolão…</div>
    </div>
  );

  const syncLabel = { sincronizando: "🔄 buscando resultados…", ok: "✓ resultados atualizados", "sem-resultados": "aguardando 1º resultado", erro: "sem conexão" , "": "" }[syncStatus];

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Manrope:wght@400;600;800&display=swap');
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        input::-webkit-outer-spin-button,input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
        input[type=number]{-moz-appearance:textfield}
        body{margin:0;background:${COLS.bg}}
        .fade{animation:fade .4s ease}@keyframes fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
      `}</style>

      <header style={S.header}>
        <div style={S.kicker}>BOLÃO • FIFA WORLD CUP</div>
        <h1 style={S.title}>COPA 2026</h1>
        <div style={S.sub}>EUA · MÉXICO · CANADÁ</div>
      </header>

      {!logado ? (
        <div style={{ ...S.card, ...S.wrap }} className="fade">
          <div style={S.label}>Nome</div>
          <input style={S.in} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: João da TI" />
          <div style={S.label}>Senha</div>
          <input type="password" style={S.in} value={senha} onChange={e => setSenha(e.target.value)} placeholder="sua senha do bolão" />
          <button style={S.btn} disabled={carregandoAuth} onClick={entrar}>ENTRAR</button>
          <button style={S.btn2} disabled={carregandoAuth} onClick={criarConta}>CRIAR CONTA</button>
          {authMsg && <p style={{ ...S.hint, color: COLS.red }}>{authMsg}</p>}
          <p style={S.hint}>Não use uma senha importante — aqui ela serve só para o bolão.</p>
        </div>
      ) : (
        <>
          <div style={S.userbar}>
            <span style={{ color: COLS.textDim }}>Jogando como </span>
            <strong style={{ color: COLS.gold }}>{nome}</strong>
            <button style={S.ghost} onClick={sair}>sair</button>
          </div>

          <nav style={S.tabs}>
            {[["palpites","Palpites"],["ranking","Ranking"],["resultados","Resultados"],["admin","Admin"]].map(([k,l]) => (
              <button key={k} onClick={() => setTab(k)} style={{ ...S.tab, ...(tab === k ? S.tabOn : {}) }}>{l}</button>
            ))}
          </nav>

          <div style={S.syncBar}>
            <span style={{ color: syncStatus === "erro" ? COLS.red : COLS.textDim }}>{syncLabel}</span>
            <button style={S.syncBtn} onClick={sincronizar} disabled={syncStatus === "sincronizando"}>atualizar</button>
          </div>

          <main style={S.wrap}>
            {tab === "palpites" && (
              <div className="fade">
                <p style={S.note}>Fase de grupos · 1ª rodada. Palpites fecham {TRAVA_MINUTOS} min antes de cada jogo. Salva sozinho.</p>
                {porGrupo.map(({ grupo, jogos: js }) => (
                  <div key={grupo}>
                    <div style={S.groupHead}>GRUPO {grupo}</div>
                    {js.map(jg => {
                      const p = meusPalpites[jg.id] || { casa: null, fora: null };
                      const res = resultadoFinal(jg.id, jg.casa, jg.fora);
                      const fechado = jogoFechado(jg, res);
                      const tem = res && res.casa != null && res.fora != null;
                      const pts = calcPontos(p, res);
                      return (
                        <div key={jg.id} style={S.match}>
                          <div style={S.mTop}>
                            <span style={S.dt}>{fmtData(jg.iso)}</span>
                            {fechado && !tem && <span style={S.lock}>fechado</span>}
                          </div>
                          <div style={S.mRow}>
                            <span style={S.team}>{jg.casa}</span>
                            <input type="number" min="0" style={{ ...S.sc, opacity: fechado ? .5 : 1 }} value={p.casa ?? ""} disabled={fechado} onChange={e => salvarPalpite(jg.id, "casa", e.target.value)} />
                            <span style={S.x}>×</span>
                            <input type="number" min="0" style={{ ...S.sc, opacity: fechado ? .5 : 1 }} value={p.fora ?? ""} disabled={fechado} onChange={e => salvarPalpite(jg.id, "fora", e.target.value)} />
                            <span style={{ ...S.team, textAlign: "right" }}>{jg.fora}</span>
                          </div>
                          {tem && (
                            <div style={S.resLine}>Final: <strong>{res.casa} × {res.fora}</strong>
                              <span style={{ ...S.badge, background: pts === PONTOS.exato ? COLS.green : pts > 0 ? COLS.goldDim : COLS.red }}>{pts != null ? `+${pts} pts` : "sem palpite"}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {tab === "ranking" && (
              <div className="fade">
                <p style={S.note}>Classificação geral · {ranking.length} participante(s)</p>
                {ranking.length === 0 && <p style={S.empty}>Nenhum participante ainda.</p>}
                {ranking.map((r, i) => (
                  <div key={r.jogador} style={{ ...S.rk, ...(r.jogador === nome ? S.rkMe : {}) }}>
                    <span style={{ ...S.rkPos, color: i===0?COLS.gold:i===1?"#cfd8d2":i===2?"#c08a4a":COLS.textDim }}>{i+1}º</span>
                    <span style={S.rkName}>{r.jogador}</span>
                    <span style={S.rkMeta}>{r.exatos} exatos · {r.jogados} jogos</span>
                    <span style={S.rkPts}>{r.total}</span>
                  </div>
                ))}
              </div>
            )}

            {tab === "resultados" && (
              <div className="fade">
                <p style={S.note}>Resultados oficiais (automático via TheSportsDB + correções do admin)</p>
                {porGrupo.map(({ grupo, jogos: js }) => (
                  <div key={grupo}>
                    <div style={S.groupHead}>GRUPO {grupo}</div>
                    {js.map(jg => {
                      const res = resultadoFinal(jg.id, jg.casa, jg.fora); const tem = res && res.casa != null && res.fora != null;
                      return (
                        <div key={jg.id} style={S.match}>
                          <div style={S.mTop}><span style={S.dt}>{fmtData(jg.iso)}</span></div>
                          <div style={S.mRow}>
                            <span style={S.team}>{jg.casa}</span>
                            <span style={S.scShow}>{tem ? res.casa : "–"}</span><span style={S.x}>×</span><span style={S.scShow}>{tem ? res.fora : "–"}</span>
                            <span style={{ ...S.team, textAlign: "right" }}>{jg.fora}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {tab === "admin" && (
              <div className="fade">
                {!isAdmin ? (
                  <div style={S.card}>
                    <div style={S.label}>Senha de administrador</div>
                    <input type="password" style={S.in} value={senhaAdmin} onChange={e => setSenhaAdmin(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && setIsAdmin(senhaAdmin === ADMIN_PASSWORD)} />
                    <button style={S.btn} onClick={() => setIsAdmin(senhaAdmin === ADMIN_PASSWORD)}>DESBLOQUEAR</button>
                    {senhaAdmin && senhaAdmin !== ADMIN_PASSWORD && <p style={{ ...S.hint, color: COLS.red }}>Senha incorreta.</p>}
                  </div>
                ) : (
                  <>
                    <p style={S.note}>Correção manual de placar (tem prioridade sobre a API). Campos vazios = usa o automático.</p>
                    {porGrupo.map(({ grupo, jogos: js }) => (
                      <div key={grupo}>
                        <div style={S.groupHead}>GRUPO {grupo}</div>
                        {js.map(jg => {
                          const m = resultadosManuais[jg.id] || { casa: null, fora: null };
                          const a = apiResultados[chaveJogo(jg.casa, jg.fora)];
                          return (
                            <div key={jg.id} style={S.match}>
                              <div style={S.mTop}><span style={S.dt}>{jg.casa} × {jg.fora}</span><span style={S.dt}>{a ? `API: ${a.casa}×${a.fora}` : "API: —"}</span></div>
                              <div style={S.mRow}>
                                <span style={S.team}>{jg.casa}</span>
                                <input type="number" min="0" style={S.sc} value={m.casa ?? ""} placeholder="–" onChange={e => salvarResultadoManual(jg.id, "casa", e.target.value)} />
                                <span style={S.x}>×</span>
                                <input type="number" min="0" style={S.sc} value={m.fora ?? ""} placeholder="–" onChange={e => salvarResultadoManual(jg.id, "fora", e.target.value)} />
                                <span style={{ ...S.team, textAlign: "right" }}>{jg.fora}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </main>
        </>
      )}

      <footer style={S.footer}>
        <div style={S.sb}>
          <span>Exato <b style={{ color: COLS.green }}>+{PONTOS.exato}</b></span>
          <span>Vencedor+1 placar <b style={{ color: COLS.gold }}>+{PONTOS.parcial}</b></span>
          <span>Só vencedor <b style={{ color: COLS.gold }}>+{PONTOS.resultado}</b></span>
        </div>
      </footer>
    </div>
  );
}

const S = {
  app: { background: `radial-gradient(circle at 50% 0%, #143d20 0%, ${COLS.bg} 55%)`, minHeight: "100vh", maxWidth: 480, margin: "0 auto", fontFamily: "Manrope, sans-serif", color: COLS.text, paddingBottom: 90 },
  header: { textAlign: "center", padding: "28px 16px 12px" },
  kicker: { color: COLS.goldDim, letterSpacing: 3, fontSize: 11, fontWeight: 800 },
  title: { fontFamily: "Anton, sans-serif", fontSize: 52, margin: "4px 0", color: COLS.white, letterSpacing: 1, textShadow: `0 2px 0 ${COLS.goldDim}` },
  sub: { color: COLS.gold, letterSpacing: 4, fontSize: 12, fontWeight: 700 },
  wrap: { padding: "0 14px" },
  card: { background: COLS.card, border: `1px solid ${COLS.line}`, borderRadius: 16, padding: 20, margin: "0 14px" },
  label: { color: COLS.textDim, fontSize: 13, marginBottom: 8, fontWeight: 600 },
  in: { width: "100%", background: COLS.cardAlt, border: `1px solid ${COLS.line}`, borderRadius: 10, padding: "13px 14px", color: COLS.text, fontSize: 16, outline: "none", marginBottom: 12 },
  btn: { width: "100%", background: COLS.gold, color: "#1a2e12", border: "none", borderRadius: 10, padding: 14, fontWeight: 800, fontSize: 15, letterSpacing: 1, cursor: "pointer", marginBottom: 8 },
  btn2: { width: "100%", background: "transparent", color: COLS.gold, border: `1px solid ${COLS.gold}`, borderRadius: 10, padding: 13, fontWeight: 800, fontSize: 14, cursor: "pointer" },
  hint: { color: COLS.textDim, fontSize: 12, marginTop: 10, lineHeight: 1.4 },
  userbar: { display: "flex", alignItems: "center", gap: 6, padding: "6px 18px", fontSize: 14 },
  ghost: { marginLeft: "auto", background: "transparent", border: `1px solid ${COLS.line}`, color: COLS.textDim, borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer" },
  tabs: { display: "flex", gap: 6, padding: "4px 14px 6px", overflowX: "auto" },
  tab: { flex: 1, background: COLS.cardAlt, border: `1px solid ${COLS.line}`, color: COLS.textDim, borderRadius: 10, padding: "10px 4px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" },
  tabOn: { background: COLS.gold, color: "#1a2e12", borderColor: COLS.gold },
  syncBar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 18px 10px", fontSize: 12 },
  syncBtn: { background: "transparent", border: `1px solid ${COLS.line}`, color: COLS.gold, borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  note: { color: COLS.textDim, fontSize: 13, margin: "4px 4px 14px", lineHeight: 1.4 },
  empty: { color: COLS.textDim, textAlign: "center", padding: 30 },
  groupHead: { color: COLS.gold, fontFamily: "Anton, sans-serif", fontSize: 16, letterSpacing: 2, margin: "16px 4px 8px", paddingBottom: 4, borderBottom: `1px solid ${COLS.line}` },
  match: { background: COLS.card, border: `1px solid ${COLS.line}`, borderRadius: 14, padding: 14, marginBottom: 10 },
  mTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  dt: { color: COLS.textDim, fontSize: 11, textTransform: "capitalize" },
  lock: { color: COLS.red, fontSize: 10, fontWeight: 800, border: `1px solid ${COLS.red}`, borderRadius: 6, padding: "1px 6px" },
  mRow: { display: "flex", alignItems: "center", gap: 8 },
  team: { flex: 1, fontSize: 14, fontWeight: 600 },
  sc: { width: 46, height: 46, textAlign: "center", background: COLS.cardAlt, border: `1px solid ${COLS.line}`, borderRadius: 10, color: COLS.white, fontSize: 20, fontWeight: 800, outline: "none" },
  scShow: { width: 46, height: 46, display: "flex", alignItems: "center", justifyContent: "center", background: COLS.cardAlt, borderRadius: 10, color: COLS.white, fontSize: 20, fontWeight: 800 },
  x: { color: COLS.textDim, fontWeight: 700 },
  resLine: { marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${COLS.line}`, fontSize: 13, color: COLS.textDim, display: "flex", alignItems: "center", gap: 8 },
  badge: { marginLeft: "auto", color: COLS.white, fontSize: 12, fontWeight: 800, padding: "3px 9px", borderRadius: 20 },
  rk: { display: "flex", alignItems: "center", gap: 10, background: COLS.card, border: `1px solid ${COLS.line}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8 },
  rkMe: { borderColor: COLS.gold, boxShadow: `0 0 0 1px ${COLS.gold}` },
  rkPos: { fontFamily: "Anton, sans-serif", fontSize: 18, width: 32 },
  rkName: { fontWeight: 700, fontSize: 15 },
  rkMeta: { marginLeft: "auto", color: COLS.textDim, fontSize: 11 },
  rkPts: { fontFamily: "Anton, sans-serif", fontSize: 24, color: COLS.gold, minWidth: 36, textAlign: "right" },
  footer: { position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 480, margin: "0 auto", background: COLS.cardAlt, borderTop: `1px solid ${COLS.line}`, padding: "10px 14px" },
  sb: { display: "flex", justifyContent: "space-around", gap: 6, fontSize: 11, color: COLS.textDim, textAlign: "center", flexWrap: "wrap" },
};
