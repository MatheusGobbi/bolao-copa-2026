import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase, ADMIN_PASSWORD, TRAVA_MINUTOS, LEAGUE_ID, API_KEY, PONTOS } from "./config";
import { JOGOS_OFICIAIS, bandeira } from "./jogos";

// Paleta clara — verde só como destaque
const C = {
  bg: "#f4f6f4", surface: "#ffffff", soft: "#eef1ee", line: "#e2e7e2",
  ink: "#15281b", inkSoft: "#5b6b5f", green: "#1f8a4c", greenDark: "#136336",
  greenSoft: "#e6f3eb", gold: "#c8941f", red: "#c2452f", white: "#ffffff",
};
const API_BASE = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`;

function norm(s) {
  return (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
}
const APELIDOS = {
  mexico:"mexico", africadosul:"southafrica", coreiadosul:"southkorea", republicatcheca:"czechrepublic",
  canada:"canada", bosniaeherzegovina:"bosnia", estadosunidos:"usa", paraguai:"paraguay", catar:"qatar",
  suica:"switzerland", brasil:"brazil", marrocos:"morocco", haiti:"haiti", escocia:"scotland",
  australia:"australia", turquia:"turkey", alemanha:"germany", curacao:"curacao", holanda:"netherlands",
  japao:"japan", costadomarfim:"ivorycoast", equador:"ecuador", suecia:"sweden", tunisia:"tunisia",
  espanha:"spain", caboverde:"capeverde", belgica:"belgium", egito:"egypt", arabiasaudita:"saudiarabia",
  uruguai:"uruguay", ira:"iran", novazelandia:"newzealand", franca:"france", senegal:"senegal",
  iraque:"iraq", noruega:"norway", argentina:"argentina", argelia:"algeria", austria:"austria",
  jordania:"jordan", portugal:"portugal", rdcongo:"drcongo", inglaterra:"england", croacia:"croatia",
  gana:"ghana", panama:"panama", uzbequistao:"uzbekistan", colombia:"colombia",
};
const chaveTime = (s) => APELIDOS[norm(s)] || norm(s);
const chaveJogo = (casa, fora) => `${chaveTime(casa)}__${chaveTime(fora)}`;

function calcPontos(palpite, resultado) {
  if (!resultado || resultado.casa == null || resultado.fora == null) return null;
  if (!palpite || palpite.casa == null || palpite.casa === "" || palpite.fora == null || palpite.fora === "") return null;
  const pc = +palpite.casa, pf = +palpite.fora, rc = +resultado.casa, rf = +resultado.fora;
  const empateReal = rc === rf;
  // placar exato = sempre a pontuação máxima (vitória ou empate)
  if (pc === rc && pf === rf) return PONTOS.exato + PONTOS.vencedor + PONTOS.diferenca + PONTOS.perdedor;
  const s = (a, b) => (a > b ? 1 : a < b ? -1 : 0);
  // errou o vencedor (ou empate vs vitória) → 0
  if (s(pc, pf) !== s(rc, rf)) return 0;
  // acertou o vencedor / empate
  let pts = PONTOS.vencedor;
  if (!empateReal) {
    // diferença de gols (margem da vitória)
    if (Math.abs(pc - pf) === Math.abs(rc - rf)) pts += PONTOS.diferenca;
    // gols do time perdedor
    const perdedorPalpite = pc < pf ? pc : pf;
    const perdedorReal = rc < rf ? rc : rf;
    if (perdedorPalpite === perdedorReal) pts += PONTOS.perdedor;
  }
  return pts;
}
const MAX_PTS = PONTOS.exato + PONTOS.vencedor + PONTOS.diferenca + PONTOS.perdedor; // 11
function ehExato(p, r) {
  if (!p || !r || p.casa == null || p.fora == null || r.casa == null || r.fora == null) return false;
  return +p.casa === +r.casa && +p.fora === +r.fora;
}
function fmtData(iso) {
  if (!iso) return "data a definir";
  const d = new Date(iso); if (isNaN(d)) return "data a definir";
  return d.toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function jogoFechado(jogo, resultado) {
  if (resultado && resultado.casa != null && resultado.fora != null) return true;
  if (!jogo.iso) return false;
  const t = new Date(jogo.iso).getTime();
  if (isNaN(t)) return false;
  return Date.now() >= t - TRAVA_MINUTOS * 60 * 1000;
}

export default function App() {
  const [tab, setTab] = useState("palpites");
  const [rodada, setRodada] = useState(1);
  const [visao, setVisao] = useState("grupo"); // "grupo" ou "dia"
  const [jogos, setJogos] = useState(JOGOS_OFICIAIS);
  const [resultadosManuais, setResultadosManuais] = useState({});
  const [apiResultados, setApiResultados] = useState({});
  const [palpitesTodos, setPalpitesTodos] = useState({});
  const [usuarios, setUsuarios] = useState([]);

  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [logado, setLogado] = useState(false);
  const [authMsg, setAuthMsg] = useState("");
  const [carregandoAuth, setCarregandoAuth] = useState(false);
  const [acaoAuth, setAcaoAuth] = useState(null); // "entrar" | "criar" | null
  const [salvando, setSalvando] = useState(false);
  const [regrasAbertas, setRegrasAbertas] = useState(false);
  const [palpitesAbertos, setPalpitesAbertos] = useState({}); // { jogoId: true }

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminAberto, setAdminAberto] = useState(false); // tela admin visível?
  const [senhaAdmin, setSenhaAdmin] = useState("");
  const [toquesTitulo, setToquesTitulo] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState("");
  const [, force] = useState(0);

  const resultadoFinal = useCallback(
    (jogoId, casa, fora) => resultadosManuais[jogoId] || apiResultados[chaveJogo(casa, fora)] || null,
    [resultadosManuais, apiResultados]
  );

  const carregarBanco = useCallback(async () => {
    const { data: jg } = await supabase.from("jogos").select("*").order("ordem", { ascending: true });
    // mapa de jogos sem pontuação, vindo do arquivo local (não depende do banco)
    const semPontosSet = new Set(JOGOS_OFICIAIS.filter(j => j.semPontos).map(j => j.id));
    if (jg && jg.length) {
      // mantém rodada se existir no banco; semPontos vem do arquivo local
      setJogos(jg.map(j => ({ id: j.id, grupo: j.grupo, casa: j.casa, fora: j.fora, iso: j.iso, rodada: j.rodada, semPontos: semPontosSet.has(j.id) })));
    } else {
      const semente = JOGOS_OFICIAIS.map((j, i) => ({ id: j.id, grupo: j.grupo, casa: j.casa, fora: j.fora, iso: j.iso, rodada: j.rodada, ordem: i }));
      await supabase.from("jogos").upsert(semente, { onConflict: "id" });
      setJogos(JOGOS_OFICIAIS);
    }
    const { data: us } = await supabase.from("usuarios").select("nome");
    if (us) setUsuarios(us.map(u => u.nome));
    const { data: pal } = await supabase.from("palpites").select("*");
    if (pal) {
      const todos = {};
      for (const p of pal) { (todos[p.nome] = todos[p.nome] || {})[p.jogo_id] = { casa: p.casa, fora: p.fora }; }
      setPalpitesTodos(todos);
    }
    const { data: res } = await supabase.from("resultados_manuais").select("*");
    if (res) {
      const m = {};
      for (const r of res) if (r.casa != null && r.fora != null) m[r.jogo_id] = { casa: r.casa, fora: r.fora };
      setResultadosManuais(m);
    }
  }, []);

  const sincronizar = useCallback(async () => {
    setSyncStatus("sincronizando");
    const url = `${API_BASE}/eventspastleague.php?id=${LEAGUE_ID}`;
    console.log("[BOLÃO] Sincronizando resultados…", url);
    try {
      const resp = await fetch(url);
      console.log("[BOLÃO] Status HTTP:", resp.status);
      const passados = await resp.json().catch((e) => { console.error("[BOLÃO] Erro ao ler JSON:", e); return null; });
      console.log("[BOLÃO] Resposta da API:", passados);
      const eventos = passados?.events;
      console.log("[BOLÃO] Eventos retornados:", Array.isArray(eventos) ? eventos.length : "nenhum (events =", eventos, ")");
      const ar = {};
      let comPlacar = 0, de2026 = 0;
      if (Array.isArray(eventos)) {
        for (const ev of eventos) {
          if (ev.intHomeScore == null || ev.intHomeScore === "" || ev.intAwayScore == null || ev.intAwayScore === "") continue;
          comPlacar++;
          const dt = ev.dateEvent ? new Date(`${ev.dateEvent}T00:00:00Z`).getTime() : NaN;
          if (isNaN(dt) || dt < new Date("2026-01-01T00:00:00Z").getTime()) continue;
          de2026++;
          const chave = chaveJogo(ev.strHomeTeam, ev.strAwayTeam);
          console.log(`[BOLÃO] Jogo da API: ${ev.strHomeTeam} ${ev.intHomeScore}x${ev.intAwayScore} ${ev.strAwayTeam} (${ev.dateEvent}) → chave: ${chave}`);
          ar[chave] = { casa: +ev.intHomeScore, fora: +ev.intAwayScore };
        }
      }
      console.log(`[BOLÃO] Resumo: ${comPlacar} com placar, ${de2026} de 2026+, ${Object.keys(ar).length} resultados prontos.`);
      console.log("[BOLÃO] Chaves dos SEUS jogos:", JOGOS_OFICIAIS.map(j => chaveJogo(j.casa, j.fora)));
      setApiResultados(ar);
      setSyncStatus(Object.keys(ar).length ? "ok" : "sem-resultados");
    } catch (e) {
      console.error("[BOLÃO] Falha na sincronização:", e);
      setSyncStatus("erro");
    }
  }, []);

  useEffect(() => {
    (async () => {
      const salvo = localStorage.getItem("bolao:auth");
      if (salvo) { try { setNome(JSON.parse(salvo).nome); setLogado(true); } catch {} }
      await carregarBanco();
      setLoading(false);
      sincronizar();
    })();
  }, [carregarBanco, sincronizar]);

  useEffect(() => { const t = setInterval(() => force(n => n + 1), 30000); return () => clearInterval(t); }, []);

  // ao mudar para visão "por dia", rola até o dia de hoje (ou próximo com jogos)
  useEffect(() => {
    if (visao !== "dia") return;
    const t = setTimeout(() => {
      const alvo = document.querySelector('[data-hoje="1"]') || document.querySelector('[data-proximo="1"]');
      if (alvo) alvo.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => clearTimeout(t);
  }, [visao, tab]);
  useEffect(() => {
    if (!logado) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") carregarBanco();
    }, 60000);
    // recarrega ao voltar para a aba
    const onVis = () => { if (document.visibilityState === "visible") carregarBanco(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [logado, carregarBanco]);

  // 5 toques no título abrem o admin
  function tocarTitulo() {
    const n = toquesTitulo + 1;
    setToquesTitulo(n);
    if (n >= 5) { setAdminAberto(true); setTab("admin"); setToquesTitulo(0); }
    setTimeout(() => setToquesTitulo(0), 1500);
  }

  const meusPalpites = palpitesTodos[nome] || {};

  async function criarConta() {
    const n = nome.trim(); if (!n || !senha) { setAuthMsg("Preencha nome e senha."); return; }
    setCarregandoAuth(true); setAcaoAuth("criar"); setAuthMsg("");
    const { data: existe } = await supabase.from("usuarios").select("nome").eq("nome", n).maybeSingle();
    if (existe) { setAuthMsg("Esse nome já existe. Tente entrar ou escolha outro nome."); setCarregandoAuth(false); setAcaoAuth(null); return; }
    const { error } = await supabase.from("usuarios").insert({ nome: n, senha });
    setCarregandoAuth(false); setAcaoAuth(null);
    if (error) { setAuthMsg("Erro ao criar conta."); return; }
    localStorage.setItem("bolao:auth", JSON.stringify({ nome: n }));
    setLogado(true); carregarBanco();
  }
  async function entrar() {
    const n = nome.trim(); if (!n || !senha) { setAuthMsg("Preencha nome e senha."); return; }
    setCarregandoAuth(true); setAcaoAuth("entrar"); setAuthMsg("");
    const { data: u } = await supabase.from("usuarios").select("*").eq("nome", n).maybeSingle();
    setCarregandoAuth(false); setAcaoAuth(null);
    if (!u) { setAuthMsg("Conta não encontrada. Crie uma conta."); return; }
    if (u.senha !== senha) { setAuthMsg("Senha incorreta."); return; }
    localStorage.setItem("bolao:auth", JSON.stringify({ nome: n }));
    setLogado(true); carregarBanco();
  }
  // "sair" desloga mas mantém o vínculo do dispositivo (trava 1 conta por navegador)
  function sair() { localStorage.removeItem("bolao:auth"); setLogado(false); setIsAdmin(false); setAdminAberto(false); setSenha(""); setTab("palpites"); }

  async function salvarPalpite(jogoId, campo, valor) {
    const v = valor === "" ? null : +valor;
    const atual = palpitesTodos[nome]?.[jogoId] || { casa: null, fora: null };
    const novo = { ...atual, [campo]: v };
    setPalpitesTodos(p => ({ ...p, [nome]: { ...(p[nome] || {}), [jogoId]: novo } }));
    setSalvando(true);
    await supabase.from("palpites").upsert({ nome, jogo_id: jogoId, casa: novo.casa, fora: novo.fora, atualizado_em: new Date().toISOString() }, { onConflict: "nome,jogo_id" });
    setSalvando(false);
  }
  async function salvarResultadoManual(jogoId, campo, valor) {
    const v = valor === "" ? null : +valor;
    const atual = resultadosManuais[jogoId] || { casa: null, fora: null };
    const novo = { ...atual, [campo]: v };
    setResultadosManuais(r => ({ ...r, [jogoId]: novo }));
    if (novo.casa == null && novo.fora == null) await supabase.from("resultados_manuais").delete().eq("jogo_id", jogoId);
    else await supabase.from("resultados_manuais").upsert({ jogo_id: jogoId, casa: novo.casa, fora: novo.fora, atualizado_em: new Date().toISOString() }, { onConflict: "jogo_id" });
  }

  const ranking = useMemo(() => {
    return usuarios.map((jogador) => {
      let total = 0, exatos = 0, jogados = 0;
      const pal = palpitesTodos[jogador] || {};
      for (const jg of jogos) {
        if (jg.semPontos) continue; // jogos de abertura não contam
        const r = resultadoFinal(jg.id, jg.casa, jg.fora);
        const p = calcPontos(pal[jg.id], r);
        if (p != null) { total += p; jogados++; if (ehExato(pal[jg.id], r)) exatos++; }
      }
      return { jogador, total, exatos, jogados };
    }).sort((a, b) => b.total - a.total || b.exatos - a.exatos || a.jogador.localeCompare(b.jogador));
  }, [usuarios, palpitesTodos, jogos, resultadoFinal]);

  // jogos da rodada selecionada, agrupados por grupo
  const porGrupo = useMemo(() => {
    const da = jogos.filter(j => (j.rodada || 1) === rodada);
    const g = {};
    for (const jg of da) (g[jg.grupo] = g[jg.grupo] || []).push(jg);
    return Object.keys(g).sort().map(k => ({ grupo: k, jogos: g[k] }));
  }, [jogos, rodada]);

  // todos os jogos agrupados por DIA, ordenados por data/horário
  const porDia = useMemo(() => {
    const ordenados = [...jogos].sort((a, b) => (a.iso || "").localeCompare(b.iso || ""));
    const dias = {};
    for (const jg of ordenados) {
      const d = jg.iso ? new Date(jg.iso) : null;
      const chave = d && !isNaN(d) ? d.toISOString().slice(0, 10) : "sem-data";
      (dias[chave] = dias[chave] || []).push(jg);
    }
    return Object.keys(dias).sort().map(k => ({ dia: k, jogos: dias[k] }));
  }, [jogos]);

  // rótulo amigável do dia (ex: "Sábado, 13/06")
  const labelDia = (chave) => {
    if (chave === "sem-data") return "Data a definir";
    const d = new Date(`${chave}T12:00:00Z`);
    if (isNaN(d)) return chave;
    const txt = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  };
  const hojeChave = new Date().toISOString().slice(0, 10);

  if (loading) return (
    <div style={{ ...S.app, display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: C.green, fontWeight: 800 }}>Carregando o bolão…</div>
    </div>
  );

  const syncLabel = { sincronizando: "buscando resultados…", ok: "resultados atualizados", "sem-resultados": "aguardando 1º resultado", erro: "sem conexão", "": "" }[syncStatus];

  const Jogo = ({ jg, modo }) => {
    const p = meusPalpites[jg.id] || { casa: null, fora: null };
    const res = resultadoFinal(jg.id, jg.casa, jg.fora);
    const fechado = jogoFechado(jg, res);
    const tem = res && res.casa != null && res.fora != null;
    const pts = calcPontos(p, res);
    const m = resultadosManuais[jg.id] || { casa: null, fora: null };
    const a = apiResultados[chaveJogo(jg.casa, jg.fora)];
    const meuPreenchido = p.casa != null && p.fora != null;
    // palpites dos outros (só quando o jogo fechou) — usa dados já em memória
    const palpitesDoJogo = (modo === "palpite" && fechado)
      ? usuarios
          .map(u => ({ u, pal: palpitesTodos[u]?.[jg.id] }))
          .filter(o => o.pal && o.pal.casa != null && o.pal.fora != null)
      : [];
    return (
      <div style={S.match}>
        <div style={S.mTop}>
          <span style={S.dt}>{fmtData(jg.iso)}</span>
          <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {jg.semPontos && <span style={S.noPts}>não vale pontos</span>}
            {modo === "palpite" && !fechado && meuPreenchido && <span style={S.savedTag}>✓ salvo</span>}
            {modo === "palpite" && fechado && !tem && <span style={S.lock}>fechado</span>}
            {modo === "admin" && <span style={S.dt}>{a ? `API ${a.casa}×${a.fora}` : "API —"}</span>}
          </span>
        </div>
        <div style={S.mRow}>
          <span style={S.team}><span style={S.flag}>{bandeira(jg.casa)}</span>{jg.casa}</span>
          {modo === "palpite" && (<>
            <input type="number" min="0" style={{ ...S.sc, opacity: fechado ? .45 : 1 }} value={p.casa ?? ""} disabled={fechado} onChange={e => salvarPalpite(jg.id, "casa", e.target.value)} />
            <span style={S.x}>×</span>
            <input type="number" min="0" style={{ ...S.sc, opacity: fechado ? .45 : 1 }} value={p.fora ?? ""} disabled={fechado} onChange={e => salvarPalpite(jg.id, "fora", e.target.value)} />
          </>)}
          {modo === "resultado" && (<>
            <span style={S.scShow}>{tem ? res.casa : "–"}</span><span style={S.x}>×</span><span style={S.scShow}>{tem ? res.fora : "–"}</span>
          </>)}
          {modo === "admin" && (<>
            <input type="number" min="0" style={S.sc} value={m.casa ?? ""} placeholder="–" onChange={e => salvarResultadoManual(jg.id, "casa", e.target.value)} />
            <span style={S.x}>×</span>
            <input type="number" min="0" style={S.sc} value={m.fora ?? ""} placeholder="–" onChange={e => salvarResultadoManual(jg.id, "fora", e.target.value)} />
          </>)}
          <span style={{ ...S.team, justifyContent: "flex-end", textAlign: "right" }}>{jg.fora}<span style={S.flag}>{bandeira(jg.fora)}</span></span>
        </div>
        {modo === "palpite" && tem && (
          <div style={S.resLine}>Final {res.casa} × {res.fora}
            <span style={{ ...S.badge, background: ehExato(p, res) ? C.green : pts > 0 ? C.gold : C.red }}>{pts != null ? `+${pts} pts` : "sem palpite"}</span>
          </div>
        )}
        {palpitesDoJogo.length > 0 && (
          <div style={S.othersWrap}>
            <button style={S.othersToggle} onClick={() => setPalpitesAbertos(s => ({ ...s, [jg.id]: !s[jg.id] }))}>
              {palpitesAbertos[jg.id] ? "▲ ocultar palpites" : `▼ ver palpites dos participantes (${palpitesDoJogo.length})`}
            </button>
            {palpitesAbertos[jg.id] && (
              <div style={S.othersList}>
                {palpitesDoJogo.map(({ u, pal }) => {
                  const ap = tem ? calcPontos(pal, res) : null;
                  return (
                    <div key={u} style={{ ...S.otherRow, ...(u === nome ? S.otherMe : {}) }}>
                      <span style={S.otherName}>{u}</span>
                      <span style={S.otherScore}>{pal.casa} × {pal.fora}</span>
                      {tem && ap != null && <span style={{ ...S.otherPts, color: ehExato(pal, res) ? C.green : ap > 0 ? C.gold : C.inkSoft }}>{jg.semPontos ? "—" : `+${ap}`}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // primeiro dia (>= hoje) com jogos, para marcar o alvo do auto-scroll
  const proximoDiaComJogos = porDia.find(d => d.dia >= hojeChave)?.dia || (porDia[porDia.length - 1]?.dia);

  // renderiza os jogos conforme a visão escolhida (grupo ou dia)
  const renderConteudo = (modo) => {
    if (visao === "dia") {
      return porDia.map(({ dia, jogos: js }) => (
        <div key={dia} data-hoje={dia === hojeChave ? "1" : undefined} data-proximo={dia === proximoDiaComJogos ? "1" : undefined}>
          <div style={{ ...S.groupHead, ...(dia === hojeChave ? S.dayHoje : {}) }}>
            {labelDia(dia)}{dia === hojeChave ? " · hoje" : ""}
          </div>
          {js.map(jg => <div key={jg.id}><div style={S.grpTag}>Grupo {jg.grupo}{jg.rodada ? ` · ${jg.rodada}ª rodada` : ""}</div><Jogo jg={jg} modo={modo} /></div>)}
        </div>
      ));
    }
    return porGrupo.map(({ grupo, jogos: js }) => (
      <div key={grupo}>
        <div style={S.groupHead}>Grupo {grupo}</div>
        {js.map(jg => <Jogo key={jg.id} jg={jg} modo={modo} />)}
      </div>
    ));
  };


  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Manrope:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        input::-webkit-outer-spin-button,input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
        input[type=number]{-moz-appearance:textfield}
        body{margin:0;background:${C.bg}}
        button{transition:opacity .15s, transform .06s, background .15s, border-color .15s}
        button:active:not(:disabled){transform:scale(0.97)}
        button:disabled{cursor:not-allowed}
        input:focus{border-color:${C.green}!important;background:${C.white}!important}
        .fade{animation:fade .35s ease}@keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
      `}</style>

      <header style={S.header}>
        <div style={S.kicker}>BOLÃO · FIFA WORLD CUP</div>
        <h1 style={S.title} onClick={tocarTitulo}>Copa 2026</h1>
        <div style={S.sub}>EUA · México · Canadá</div>
      </header>

      {!logado ? (
        <div style={S.loginWrap} className="fade">
          <div style={S.loginCard}>
            <div style={S.loginTitle}>Entrar no bolão</div>
            <div style={S.loginIntro}>Use o mesmo nome e senha sempre para manter seus palpites.</div>
            <div style={S.label}>Nome</div>
            <input style={S.in} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: João da TI"
              onKeyDown={e => e.key === "Enter" && entrar()} />
            <div style={S.label}>Senha</div>
            <input type="password" style={S.in} value={senha} onChange={e => setSenha(e.target.value)} placeholder="sua senha do bolão"
              onKeyDown={e => e.key === "Enter" && entrar()} />
            <button style={{ ...S.btn, ...(carregandoAuth ? S.btnLoading : {}) }} disabled={carregandoAuth} onClick={entrar}>
              {acaoAuth === "entrar" ? "Entrando…" : "Entrar"}
            </button>
            <button style={{ ...S.btn2, ...(carregandoAuth ? S.btnLoading : {}) }} disabled={carregandoAuth} onClick={criarConta}>
              {acaoAuth === "criar" ? "Criando conta…" : "Criar conta"}
            </button>
            {authMsg && <p style={{ ...S.hint, color: C.red, marginTop: 12 }}>{authMsg}</p>}
            <p style={S.hint}>Não use uma senha importante — aqui ela serve só para o bolão.</p>
          </div>
        </div>
      ) : (
        <>
          <div style={S.userbar}>
            <span style={{ color: C.inkSoft }}>Jogando como </span>
            <strong style={{ color: C.green, marginLeft: 4 }}>{nome}</strong>
            <button style={S.ghost} onClick={sair}>sair</button>
          </div>

          {/* Bolão Solidário oculto — para reativar, restaure o seletor de modo e o bloco {modo === "paroquia" ...} (componente Paroquia continua no projeto). */}

          <nav style={S.tabs}>
            {[["palpites","Palpites"],["ranking","Ranking"],["resultados","Resultados"], ...(adminAberto ? [["admin","Admin"]] : [])].map(([k,l]) => (
              <button key={k} onClick={() => setTab(k)} style={{ ...S.tab, ...(tab === k ? S.tabOn : {}) }}>{l}</button>
            ))}
          </nav>

          <div style={S.syncBar}>
            <span style={{ color: syncStatus === "erro" ? C.red : C.inkSoft }}>{syncLabel}</span>
            <button style={S.syncBtn} onClick={sincronizar} disabled={syncStatus === "sincronizando"}>atualizar</button>
          </div>

          {(tab === "palpites" || tab === "resultados" || tab === "admin") && (
            <>
              <div style={S.visaoBar}>
                <button onClick={() => setVisao("grupo")} style={{ ...S.visaoBtn, ...(visao === "grupo" ? S.visaoOn : {}) }}>Por grupo</button>
                <button onClick={() => setVisao("dia")} style={{ ...S.visaoBtn, ...(visao === "dia" ? S.visaoOn : {}) }}>Por dia</button>
              </div>
              {visao === "grupo" && (
                <div style={S.rodadaBar}>
                  {[1,2,3].map(r => (
                    <button key={r} onClick={() => setRodada(r)} style={{ ...S.rodadaBtn, ...(rodada === r ? S.rodadaOn : {}) }}>{r}ª rodada</button>
                  ))}
                </div>
              )}
            </>
          )}

          <main style={S.wrap}>
            {tab === "palpites" && (
              <div className="fade">
                <p style={S.note}>Palpites fecham {TRAVA_MINUTOS} min antes de cada jogo. {salvando ? <span style={{ color: C.green, fontWeight: 700 }}>salvando…</span> : <span>Salva sozinho.</span>}</p>
                {renderConteudo("palpite")}
              </div>
            )}

            {tab === "ranking" && (
              <div className="fade">
                <p style={S.note}>Classificação geral · {ranking.length} participante(s)</p>
                {ranking.length === 0 && <p style={S.empty}>Nenhum participante ainda.</p>}
                {ranking.map((r, i) => (
                  <div key={r.jogador} style={{ ...S.rk, ...(r.jogador === nome ? S.rkMe : {}) }}>
                    <span style={{ ...S.rkPos, ...(i < 3 ? S.rkPosTop : {}) }}>{i + 1}</span>
                    <span style={S.rkName}>{r.jogador}</span>
                    <span style={S.rkMeta}>{r.exatos} exatos · {r.jogados} jogos</span>
                    <span style={S.rkPts}>{r.total}</span>
                  </div>
                ))}
              </div>
            )}

            {tab === "resultados" && (
              <div className="fade">
                <p style={S.note}>Resultados oficiais (automático + correções)</p>
                {renderConteudo("resultado")}
              </div>
            )}

            {tab === "admin" && adminAberto && (
              <div className="fade">
                {!isAdmin ? (
                  <div style={S.card}>
                    <div style={S.label}>Senha de administrador</div>
                    <input type="password" style={S.in} value={senhaAdmin} onChange={e => setSenhaAdmin(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && setIsAdmin(senhaAdmin === ADMIN_PASSWORD)} />
                    <button style={S.btn} onClick={() => setIsAdmin(senhaAdmin === ADMIN_PASSWORD)}>Desbloquear</button>
                    <button style={S.btn2} onClick={() => { setAdminAberto(false); setTab("palpites"); }}>Fechar</button>
                    {senhaAdmin && senhaAdmin !== ADMIN_PASSWORD && <p style={{ ...S.hint, color: C.red }}>Senha incorreta.</p>}
                  </div>
                ) : (
                  <>
                    <p style={S.note}>Correção manual (tem prioridade sobre a API). Vazio = usa o automático.</p>
                    {renderConteudo("admin")}
                  </>
                )}
              </div>
            )}
          </main>
        </>
      )}

      <footer style={S.footer} onClick={() => setRegrasAbertas(true)}>
        <div style={S.sb}>
          <span>Exato <b style={{ color: C.green }}>+{MAX_PTS}</b></span>
          <span>Vencedor <b style={{ color: C.gold }}>+{PONTOS.vencedor}</b></span>
          <span>Diferença <b style={{ color: C.gold }}>+{PONTOS.diferenca}</b></span>
          <span>Gols perdedor <b style={{ color: C.gold }}>+{PONTOS.perdedor}</b></span>
        </div>
        <div style={S.footerHint}>toque para ver as regras completas</div>
      </footer>

      {regrasAbertas && (
        <div style={S.modalBg} onClick={() => setRegrasAbertas(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHead}>
              <h3 style={S.modalTitle}>Como funciona</h3>
              <button style={S.modalX} onClick={() => setRegrasAbertas(false)}>×</button>
            </div>
            <div style={S.modalBody}>
              <p style={S.helpP}>Dê seu palpite de placar para cada jogo. Os palpites fecham {TRAVA_MINUTOS} minutos antes de cada jogo — depois não dá mais para alterar. Quando o jogo termina, os pontos entram no ranking automaticamente.</p>

              <h4 style={S.helpSub}>Pontuação</h4>
              <div style={S.ptList}>
                <div style={S.ptRow}><span style={{...S.ptDot, background: C.green}} /><span style={S.ptName}>Cravar o placar exato</span><span style={S.ptVal}>{MAX_PTS}</span></div>
                <div style={S.ptRow}><span style={{...S.ptDot, background: "#3b7fd4"}} /><span style={S.ptName}>Acertar vencedor + diferença de gols</span><span style={S.ptVal}>{PONTOS.vencedor + PONTOS.diferenca}</span></div>
                <div style={S.ptRow}><span style={{...S.ptDot, background: "#2bb3b3"}} /><span style={S.ptName}>Acertar vencedor + gols do perdedor</span><span style={S.ptVal}>{PONTOS.vencedor + PONTOS.perdedor}</span></div>
                <div style={S.ptRow}><span style={{...S.ptDot, background: C.gold}} /><span style={S.ptName}>Acertar só o vencedor / só o empate</span><span style={S.ptVal}>{PONTOS.vencedor}</span></div>
                <div style={S.ptRow}><span style={{...S.ptDot, background: C.red}} /><span style={S.ptName}>Errar quem ganhou</span><span style={S.ptVal}>0</span></div>
              </div>
              <p style={S.helpNote}>Cravar o placar é sempre a maior pontuação ({MAX_PTS} pontos), valendo igual para vitórias e empates. As faixas de diferença e gols do perdedor só contam se você acertou quem ganhou.</p>

              <h4 style={S.helpSub}>Exemplos · resultado real 3 × 1</h4>
              <div style={S.exBox}>
                <div style={S.exRow}><span>Palpitou 3×1 — cravou</span><b style={{color:C.green}}>{MAX_PTS} pts</b></div>
                <div style={S.exRow}><span>Palpitou 2×0 — vencedor + diferença</span><b>{PONTOS.vencedor + PONTOS.diferenca} pts</b></div>
                <div style={S.exRow}><span>Palpitou 4×1 — vencedor + gols do perdedor</span><b>{PONTOS.vencedor + PONTOS.perdedor} pts</b></div>
                <div style={S.exRow}><span>Palpitou 5×0 — só o vencedor</span><b>{PONTOS.vencedor} pts</b></div>
                <div style={S.exRow}><span>Palpitou 1×2 — errou quem ganhou</span><b style={{color:C.red}}>0 pts</b></div>
              </div>

              <h4 style={S.helpSub}>Exemplos · empate 2 × 2</h4>
              <div style={S.exBox}>
                <div style={S.exRow}><span>Palpitou 2×2 — cravou o empate</span><b style={{color:C.green}}>{MAX_PTS} pts</b></div>
                <div style={S.exRow}><span>Palpitou 1×1 — acertou que era empate</span><b>{PONTOS.vencedor} pts</b></div>
                <div style={S.exRow}><span>Palpitou 2×0 — previu vitória</span><b style={{color:C.red}}>0 pts</b></div>
              </div>
              <p style={S.helpNote}>Em empates não há margem nem perdedor: vale cravar o placar ({MAX_PTS}) ou acertar que seria empate ({PONTOS.vencedor}).</p>

              <h4 style={S.helpSub}>Outras regras</h4>
              <p style={S.helpP}>O ranking mostra todos os participantes e atualiza sozinho. Quando um jogo fecha, você vê os palpites de todos naquele jogo. Os dois jogos de abertura (11/06) não valem pontos. Empate no ranking é desempatado por número de placares exatos.</p>
            </div>
            <div style={S.modalFoot}>
              <button style={S.modalBtn} onClick={() => setRegrasAbertas(false)}>Entendi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  app: { background: C.bg, minHeight: "100vh", maxWidth: 480, margin: "0 auto", fontFamily: "Manrope, sans-serif", color: C.ink, paddingBottom: 78 },
  header: { textAlign: "center", padding: "26px 16px 14px" },
  kicker: { color: C.green, letterSpacing: 2.5, fontSize: 10.5, fontWeight: 800 },
  title: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 44, margin: "2px 0", color: C.ink, fontWeight: 800, letterSpacing: -1, cursor: "default", userSelect: "none" },
  sub: { color: C.inkSoft, letterSpacing: 1, fontSize: 12, fontWeight: 600 },
  wrap: { padding: "0 14px" },
  loginWrap: { padding: "12px 22px 0" },
  loginCard: { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 20, padding: "26px 22px", boxShadow: "0 6px 28px rgba(20,40,25,0.07)" },
  loginTitle: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 800, color: C.ink, marginBottom: 4 },
  loginIntro: { color: C.inkSoft, fontSize: 13, lineHeight: 1.45, marginBottom: 20 },
  card: { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 18, padding: 22, margin: "0 14px", boxShadow: "0 4px 20px rgba(20,40,25,0.05)" },
  label: { color: C.inkSoft, fontSize: 12.5, marginBottom: 7, fontWeight: 700 },
  in: { width: "100%", background: C.soft, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 15px", color: C.ink, fontSize: 16, outline: "none", marginBottom: 14, transition: "border-color .15s, background .15s" },
  btn: { width: "100%", background: C.green, color: C.white, border: "none", borderRadius: 12, padding: 15, fontWeight: 800, fontSize: 15, cursor: "pointer", marginBottom: 9, transition: "opacity .15s, transform .05s" },
  btnLoading: { opacity: .65, cursor: "wait" },
  btn2: { width: "100%", background: C.white, color: C.green, border: `1.5px solid ${C.green}`, borderRadius: 12, padding: 12.5, fontWeight: 800, fontSize: 14, cursor: "pointer" },
  hint: { color: C.inkSoft, fontSize: 12, marginTop: 10, lineHeight: 1.45 },
  userbar: { display: "flex", alignItems: "center", padding: "4px 18px 8px", fontSize: 14 },
  ghost: { marginLeft: "auto", background: "transparent", border: `1px solid ${C.line}`, color: C.inkSoft, borderRadius: 8, padding: "4px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 },
  tabs: { display: "flex", gap: 6, padding: "2px 14px 8px" },
  tab: { flex: 1, background: C.surface, border: `1px solid ${C.line}`, color: C.inkSoft, borderRadius: 11, padding: "10px 4px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  tabOn: { background: C.green, color: C.white, borderColor: C.green },
  syncBar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px 8px", fontSize: 11.5 },
  syncBtn: { background: C.greenSoft, border: "none", color: C.greenDark, borderRadius: 8, padding: "4px 12px", fontSize: 11.5, fontWeight: 800, cursor: "pointer" },
  rodadaBar: { display: "flex", gap: 6, padding: "0 14px 8px" },
  visaoBar: { display: "flex", gap: 6, padding: "0 14px 8px" },
  visaoBtn: { flex: 1, background: C.surface, border: `1px solid ${C.line}`, color: C.inkSoft, borderRadius: 9, padding: "8px 4px", fontSize: 12.5, fontWeight: 800, cursor: "pointer" },
  visaoOn: { background: C.greenSoft, color: C.greenDark, borderColor: C.green },
  dayHoje: { color: C.green },
  grpTag: { color: C.inkSoft, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: .4, margin: "0 2px 4px" },
  rodadaBtn: { flex: 1, background: C.surface, border: `1px solid ${C.line}`, color: C.inkSoft, borderRadius: 9, padding: "7px 4px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  rodadaOn: { background: C.ink, color: C.white, borderColor: C.ink },
  note: { color: C.inkSoft, fontSize: 12.5, margin: "4px 4px 12px", lineHeight: 1.4 },
  empty: { color: C.inkSoft, textAlign: "center", padding: 30 },
  groupHead: { color: C.greenDark, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 15, fontWeight: 800, margin: "16px 2px 8px", letterSpacing: -0.3 },
  match: { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 14px", marginBottom: 9, boxShadow: "0 2px 8px rgba(20,40,25,0.03)" },
  mTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 },
  dt: { color: C.inkSoft, fontSize: 10.5, textTransform: "capitalize", fontWeight: 600 },
  lock: { color: C.red, fontSize: 9.5, fontWeight: 800, background: "#fbeae6", borderRadius: 6, padding: "2px 7px" },
  noPts: { color: C.inkSoft, fontSize: 9.5, fontWeight: 800, background: C.soft, borderRadius: 6, padding: "2px 7px" },
  savedTag: { color: C.green, fontSize: 9.5, fontWeight: 800, background: C.greenSoft, borderRadius: 6, padding: "2px 7px" },
  othersWrap: { marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.line}` },
  othersToggle: { width: "100%", background: C.soft, border: "none", borderRadius: 9, padding: "9px", color: C.greenDark, fontSize: 12, fontWeight: 800, cursor: "pointer" },
  othersList: { display: "flex", flexDirection: "column", gap: 4, marginTop: 8 },
  otherRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "3px 6px", borderRadius: 7 },
  otherMe: { background: C.greenSoft },
  otherName: { flex: 1, color: C.ink, fontWeight: 600 },
  otherScore: { color: C.ink, fontWeight: 800, fontFamily: "'Bricolage Grotesque', sans-serif" },
  otherPts: { width: 32, textAlign: "right", fontWeight: 800, fontSize: 12 },
  mRow: { display: "flex", alignItems: "center", gap: 8 },
  team: { flex: 1, fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, minWidth: 0 },
  flag: { fontSize: 18, lineHeight: 1 },
  sc: { width: 44, height: 44, textAlign: "center", background: C.soft, border: `1px solid ${C.line}`, borderRadius: 11, color: C.ink, fontSize: 19, fontWeight: 800, outline: "none" },
  scShow: { width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: C.greenSoft, borderRadius: 11, color: C.greenDark, fontSize: 19, fontWeight: 800 },
  x: { color: C.inkSoft, fontWeight: 700, fontSize: 13 },
  resLine: { marginTop: 9, paddingTop: 9, borderTop: `1px solid ${C.line}`, fontSize: 12.5, color: C.inkSoft, display: "flex", alignItems: "center", gap: 8, fontWeight: 600 },
  badge: { marginLeft: "auto", color: C.white, fontSize: 11.5, fontWeight: 800, padding: "3px 10px", borderRadius: 20 },
  rk: { display: "flex", alignItems: "center", gap: 11, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 13, padding: "11px 14px", marginBottom: 7, boxShadow: "0 2px 8px rgba(20,40,25,0.03)" },
  rkMe: { borderColor: C.green, boxShadow: `0 0 0 1.5px ${C.green}` },
  rkPos: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 17, fontWeight: 800, width: 26, textAlign: "center", color: C.inkSoft },
  rkPosTop: { color: C.green },
  rkName: { fontWeight: 700, fontSize: 15 },
  rkMeta: { marginLeft: "auto", color: C.inkSoft, fontSize: 10.5, fontWeight: 600 },
  rkPts: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 23, color: C.green, fontWeight: 800, minWidth: 34, textAlign: "right" },
  footer: { position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 480, margin: "0 auto", background: C.surface, borderTop: `1px solid ${C.line}`, padding: "8px 14px 7px", cursor: "pointer" },
  footerHint: { textAlign: "center", fontSize: 9.5, color: C.green, fontWeight: 700, marginTop: 4, letterSpacing: .2 },
  modalBg: { position: "fixed", inset: 0, background: "rgba(10,20,12,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 60 },
  modal: { background: C.white, borderRadius: 20, maxWidth: 420, width: "100%", maxHeight: "86vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" },
  modalHead: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: `1px solid ${C.line}` },
  modalTitle: { margin: 0, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 19, fontWeight: 800, color: C.ink },
  modalX: { background: C.soft, border: "none", borderRadius: 9, width: 32, height: 32, fontSize: 20, color: C.inkSoft, cursor: "pointer", lineHeight: 1 },
  modalBody: { padding: "16px 18px", overflowY: "auto" },
  modalFoot: { padding: "12px 18px", borderTop: `1px solid ${C.line}` },
  modalBtn: { width: "100%", background: C.green, color: C.white, border: "none", borderRadius: 11, padding: 13, fontWeight: 800, fontSize: 14.5, cursor: "pointer" },
  helpSub: { fontSize: 14, color: C.ink, margin: "18px 0 7px", fontWeight: 800 },
  helpP: { fontSize: 13, color: C.inkSoft, lineHeight: 1.55, margin: "0 0 4px" },
  helpNote: { fontSize: 12.5, color: C.inkSoft, lineHeight: 1.5, margin: "10px 0 0", background: C.soft, borderRadius: 9, padding: "10px 12px" },
  ptList: { display: "flex", flexDirection: "column", gap: 2, margin: "4px 0" },
  ptRow: { display: "flex", alignItems: "center", gap: 10, padding: "9px 4px", borderBottom: `1px solid ${C.line}` },
  ptDot: { width: 11, height: 11, borderRadius: "50%", flexShrink: 0 },
  ptName: { flex: 1, fontSize: 13, color: C.ink, fontWeight: 600 },
  ptVal: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 18, fontWeight: 800, color: C.green },
  exBox: { background: C.soft, borderRadius: 11, padding: "10px 14px", marginBottom: 4 },
  exRow: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, color: C.ink, padding: "4px 0" },
  sb: { display: "flex", justifyContent: "space-around", gap: 6, fontSize: 10.5, color: C.inkSoft, textAlign: "center", flexWrap: "wrap", fontWeight: 600 },
};
