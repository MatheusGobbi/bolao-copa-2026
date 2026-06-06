import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase, ADMIN_PASSWORD, TRAVA_MINUTOS } from "./config";
import { JOGOS_BRASIL, ELENCO_INICIAL } from "./dados-paroquia";
import { bandeira } from "./jogos";

const C = {
  bg: "#f4f6f4", surface: "#ffffff", soft: "#eef1ee", line: "#e2e7e2",
  ink: "#15281b", inkSoft: "#5b6b5f", green: "#1f8a4c", greenDark: "#136336",
  greenSoft: "#e6f3eb", gold: "#c8941f", goldSoft: "#fbf2dc", red: "#c2452f", white: "#fff",
};

function fmtData(iso) {
  const d = new Date(iso); if (isNaN(d)) return "data a definir";
  return d.toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function fechado(iso, res) {
  if (res && res.casa != null && res.fora != null) return true;
  const t = new Date(iso).getTime(); if (isNaN(t)) return false;
  return Date.now() >= t - TRAVA_MINUTOS * 60 * 1000;
}
const sameSet = (a, b) => { const A = [...new Set(a)].sort(), B = [...new Set(b)].sort(); return A.length === B.length && A.every((x, i) => x === B[i]); };
const inter = (a, b) => a.filter(x => b.includes(x)).length;

export default function Paroquia({ nome, isAdmin }) {
  const [tab, setTab] = useState("palpites");
  const [elenco, setElenco] = useState(ELENCO_INICIAL);
  const [palpites, setPalpites] = useState({});        // meus: { jogoId: {casa,fora,marcadores[]} }
  const [palpitesTodos, setPalpitesTodos] = useState({});
  const [resultados, setResultados] = useState({});    // { jogoId: {casa,fora,marcadores[]} }
  const [usuarios, setUsuarios] = useState([]);
  const [, force] = useState(0);

  const carregar = useCallback(async () => {
    const { data: el } = await supabase.from("elenco").select("*").order("ordem", { ascending: true });
    if (el && el.length) setElenco(el.map(e => ({ id: e.id, nome: e.nome, posicao: e.posicao })));
    else {
      const semente = ELENCO_INICIAL.map((e, i) => ({ ...e, ordem: i }));
      await supabase.from("elenco").upsert(semente, { onConflict: "id" });
    }
    const { data: us } = await supabase.from("usuarios").select("nome");
    if (us) setUsuarios(us.map(u => u.nome));
    const { data: pal } = await supabase.from("palpites_paroquia").select("*");
    if (pal) {
      const todos = {};
      for (const p of pal) { (todos[p.nome] = todos[p.nome] || {})[p.jogo_id] = { casa: p.casa, fora: p.fora, marcadores: p.marcadores || [] }; }
      setPalpitesTodos(todos);
      setPalpites(todos[nome] || {});
    }
    const { data: res } = await supabase.from("resultados_paroquia").select("*");
    if (res) { const m = {}; for (const r of res) m[r.jogo_id] = { casa: r.casa, fora: r.fora, marcadores: r.marcadores || [] }; setResultados(m); }
  }, [nome]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { const t = setInterval(() => force(n => n + 1), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(carregar, 25000); return () => clearInterval(t); }, [carregar]);

  async function salvarPalpite(jogoId, patch) {
    const atual = palpites[jogoId] || { casa: null, fora: null, marcadores: [] };
    const novo = { ...atual, ...patch };
    setPalpites(p => ({ ...p, [jogoId]: novo }));
    await supabase.from("palpites_paroquia").upsert(
      { nome, jogo_id: jogoId, casa: novo.casa, fora: novo.fora, marcadores: novo.marcadores, atualizado_em: new Date().toISOString() },
      { onConflict: "nome,jogo_id" });
  }
  function toggleMarcador(jogoId, jid) {
    const atual = palpites[jogoId] || { casa: null, fora: null, marcadores: [] };
    const ms = atual.marcadores || [];
    const novo = ms.includes(jid) ? ms.filter(x => x !== jid) : [...ms, jid];
    salvarPalpite(jogoId, { marcadores: novo });
  }
  async function salvarResultado(jogoId, patch) {
    const atual = resultados[jogoId] || { casa: null, fora: null, marcadores: [] };
    const novo = { ...atual, ...patch };
    setResultados(r => ({ ...r, [jogoId]: novo }));
    await supabase.from("resultados_paroquia").upsert(
      { jogo_id: jogoId, casa: novo.casa, fora: novo.fora, marcadores: novo.marcadores, atualizado_em: new Date().toISOString() },
      { onConflict: "jogo_id" });
  }
  function toggleResMarcador(jogoId, jid) {
    const atual = resultados[jogoId] || { casa: null, fora: null, marcadores: [] };
    const ms = atual.marcadores || [];
    const novo = ms.includes(jid) ? ms.filter(x => x !== jid) : [...ms, jid];
    salvarResultado(jogoId, { marcadores: novo });
  }

  // edição do elenco (admin)
  const [novoNome, setNovoNome] = useState("");
  async function addJogador() {
    const n = novoNome.trim(); if (!n) return;
    const id = "j" + Date.now().toString().slice(-6);
    await supabase.from("elenco").upsert({ id, nome: n, posicao: "", ordem: elenco.length }, { onConflict: "id" });
    setNovoNome(""); carregar();
  }
  async function editarJogador(id, nome) { await supabase.from("elenco").update({ nome }).eq("id", id); carregar(); }
  async function removerJogador(id) { await supabase.from("elenco").delete().eq("id", id); carregar(); }

  const nomeJogador = (id) => (elenco.find(e => e.id === id) || {}).nome || "?";

  // Ranking da paróquia: critério principal = nº de placares exatos; desempate = autores certos
  const ranking = useMemo(() => {
    return usuarios.map(jogador => {
      const pal = palpitesTodos[jogador] || {};
      let exatos = 0, autores = 0, marcadores = 0;
      for (const jg of JOGOS_BRASIL) {
        const r = resultados[jg.id]; const p = pal[jg.id];
        if (!r || r.casa == null || r.fora == null || !p || p.casa == null || p.fora == null) continue;
        if (+p.casa === +r.casa && +p.fora === +r.fora) exatos++;
        autores += inter(p.marcadores || [], r.marcadores || []);
        if (sameSet(p.marcadores || [], r.marcadores || [])) marcadores++;
      }
      return { jogador, exatos, autores, marcadores };
    }).sort((a, b) => b.exatos - a.exatos || b.autores - a.autores || b.marcadores - a.marcadores || a.jogador.localeCompare(b.jogador));
  }, [usuarios, palpitesTodos, resultados]);

  return (
    <div>
      <nav style={S.tabs}>
        {[["palpites","Palpites"],["ranking","Ranking"],["regras","Regras"], ...(isAdmin ? [["admin","Admin"]] : [])].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ ...S.tab, ...(tab === k ? S.tabOn : {}) }}>{l}</button>
        ))}
      </nav>

      <main style={S.wrap}>
        {tab === "palpites" && (
          <div className="fade">
            <p style={S.note}>Para cada jogo do Brasil: dê o placar e marque quem você acha que faz gol pelo Brasil. Salva sozinho.</p>
            {JOGOS_BRASIL.map(jg => {
              const p = palpites[jg.id] || { casa: null, fora: null, marcadores: [] };
              const res = resultados[jg.id];
              const fch = fechado(jg.iso, res);
              const brasilCasa = jg.casa === "Brasil";
              return (
                <div key={jg.id} style={S.match}>
                  <div style={S.mTop}><span style={S.dt}>{fmtData(jg.iso)}</span>{fch && <span style={S.lock}>fechado</span>}</div>
                  <div style={S.mRow}>
                    <span style={S.team}><span style={S.flag}>{bandeira(jg.casa)}</span>{jg.casa}</span>
                    <input type="number" min="0" style={{ ...S.sc, opacity: fch ? .45 : 1 }} value={p.casa ?? ""} disabled={fch} onChange={e => salvarPalpite(jg.id, { casa: e.target.value === "" ? null : +e.target.value })} />
                    <span style={S.x}>×</span>
                    <input type="number" min="0" style={{ ...S.sc, opacity: fch ? .45 : 1 }} value={p.fora ?? ""} disabled={fch} onChange={e => salvarPalpite(jg.id, { fora: e.target.value === "" ? null : +e.target.value })} />
                    <span style={{ ...S.team, justifyContent: "flex-end", textAlign: "right" }}>{jg.fora}<span style={S.flag}>{bandeira(jg.fora)}</span></span>
                  </div>
                  <div style={S.markTitle}>Quem marca pelo Brasil?</div>
                  <div style={S.chips}>
                    {elenco.filter(e => e.nome && e.nome !== "(editar)").map(e => {
                      const on = (p.marcadores || []).includes(e.id);
                      return (
                        <button key={e.id} disabled={fch}
                          onClick={() => toggleMarcador(jg.id, e.id)}
                          style={{ ...S.chip, ...(on ? S.chipOn : {}), opacity: fch ? .5 : 1 }}>
                          {e.nome}
                        </button>
                      );
                    })}
                  </div>
                  {res && res.casa != null && (
                    <div style={S.resLine}>
                      Final {res.casa} × {res.fora}
                      {res.marcadores?.length > 0 && <span style={{ marginLeft: 6 }}>· marcou: {res.marcadores.map(nomeJogador).join(", ")}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === "ranking" && (
          <div className="fade">
            <p style={S.note}>Vence quem acerta o placar exato. Desempate: autores dos gols do Brasil. · {ranking.length} participante(s)</p>
            {ranking.length === 0 && <p style={S.empty}>Nenhum participante ainda.</p>}
            <div style={S.rkHeadRow}><span style={{width:24}}></span><span style={{flex:1}}></span><span style={S.rkH}>exatos</span><span style={S.rkH}>autores</span></div>
            {ranking.map((r, i) => (
              <div key={r.jogador} style={{ ...S.rk, ...(r.jogador === nome ? S.rkMe : {}) }}>
                <span style={{ ...S.rkPos, ...(i < 3 ? { color: C.green } : {}) }}>{i + 1}</span>
                <span style={S.rkName}>{r.jogador}</span>
                <span style={S.rkStat}>{r.exatos}</span>
                <span style={S.rkStat}>{r.autores}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "regras" && (
          <div className="fade">
            <div style={S.rulesCard}>
              <h3 style={S.rulesH}>Bolão Solidário do Brasil</h3>
              <p style={S.rulesP}>Torça, participe e ajude a nossa paróquia! Festa de Santo Antônio — Paróquia Santo Antônio.</p>
              <div style={S.valueBox}>
                <div><div style={S.valueLbl}>Valor da participação</div><div style={S.valueBig}>R$ 5,00</div></div>
                <div style={S.split}><div><b style={{color:C.green}}>70%</b> paróquia</div><div><b style={{color:C.gold}}>30%</b> premiação</div></div>
              </div>
              <h4 style={S.rulesSub}>Como funciona</h4>
              <p style={S.rulesP}>Dê seu palpite do placar de cada partida do Brasil e informe quais jogadores você acha que farão gol pela seleção.</p>
              <h4 style={S.rulesSub}>Critério de vencedor</h4>
              <p style={S.rulesP}>O principal critério é o acerto do placar exato. Todos que acertarem o placar entram entre os possíveis vencedores.</p>
              <h4 style={S.rulesSub}>Desempate</h4>
              <p style={S.rulesP}>1) Quem acertar mais autores dos gols do Brasil. 2) Quem acertar a maior quantidade de jogadores que marcaram. 3) Se persistir empate, o prêmio é dividido igualmente. Consideram-se apenas os gols marcados pela seleção brasileira.</p>
              <h4 style={S.rulesSub}>Disposições</h4>
              <p style={S.rulesP}>Bolão de caráter recreativo e solidário. Não serão aceitos palpites após o início da partida. A comissão é responsável pela conferência dos palpites. O controle dos pagamentos é feito pela comissão, fora do aplicativo.</p>
            </div>
          </div>
        )}

        {tab === "admin" && isAdmin && (
          <div className="fade">
            <p style={S.note}>Lançar resultados reais (placar + quem marcou pelo Brasil).</p>
            {JOGOS_BRASIL.map(jg => {
              const r = resultados[jg.id] || { casa: null, fora: null, marcadores: [] };
              return (
                <div key={jg.id} style={S.match}>
                  <div style={S.mTop}><span style={S.dt}>{jg.casa} × {jg.fora}</span></div>
                  <div style={S.mRow}>
                    <span style={S.team}>{jg.casa}</span>
                    <input type="number" min="0" style={S.sc} value={r.casa ?? ""} placeholder="–" onChange={e => salvarResultado(jg.id, { casa: e.target.value === "" ? null : +e.target.value })} />
                    <span style={S.x}>×</span>
                    <input type="number" min="0" style={S.sc} value={r.fora ?? ""} placeholder="–" onChange={e => salvarResultado(jg.id, { fora: e.target.value === "" ? null : +e.target.value })} />
                    <span style={{ ...S.team, justifyContent: "flex-end", textAlign: "right" }}>{jg.fora}</span>
                  </div>
                  <div style={S.markTitle}>Marcaram pelo Brasil:</div>
                  <div style={S.chips}>
                    {elenco.filter(e => e.nome && e.nome !== "(editar)").map(e => {
                      const on = (r.marcadores || []).includes(e.id);
                      return <button key={e.id} onClick={() => toggleResMarcador(jg.id, e.id)} style={{ ...S.chip, ...(on ? S.chipOn : {}) }}>{e.nome}</button>;
                    })}
                  </div>
                </div>
              );
            })}

            <div style={{ ...S.match, marginTop: 18 }}>
              <div style={S.markTitle}>Elenco do Brasil (editar)</div>
              {elenco.map(e => (
                <div key={e.id} style={S.elRow}>
                  <input style={S.elIn} defaultValue={e.nome} onBlur={ev => ev.target.value !== e.nome && editarJogador(e.id, ev.target.value)} />
                  <button style={S.elDel} onClick={() => removerJogador(e.id)}>×</button>
                </div>
              ))}
              <div style={S.elRow}>
                <input style={S.elIn} placeholder="adicionar jogador…" value={novoNome} onChange={e => setNovoNome(e.target.value)} onKeyDown={e => e.key === "Enter" && addJogador()} />
                <button style={{ ...S.chip, ...S.chipOn }} onClick={addJogador}>+</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const S = {
  wrap: { padding: "0 14px" },
  tabs: { display: "flex", gap: 6, padding: "2px 14px 8px" },
  tab: { flex: 1, background: C.surface, border: `1px solid ${C.line}`, color: C.inkSoft, borderRadius: 11, padding: "10px 4px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  tabOn: { background: C.green, color: C.white, borderColor: C.green },
  note: { color: C.inkSoft, fontSize: 12.5, margin: "4px 4px 12px", lineHeight: 1.4 },
  empty: { color: C.inkSoft, textAlign: "center", padding: 30 },
  match: { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 14px", marginBottom: 9, boxShadow: "0 2px 8px rgba(20,40,25,0.03)" },
  mTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 },
  dt: { color: C.inkSoft, fontSize: 10.5, textTransform: "capitalize", fontWeight: 600 },
  lock: { color: C.red, fontSize: 9.5, fontWeight: 800, background: "#fbeae6", borderRadius: 6, padding: "2px 7px" },
  mRow: { display: "flex", alignItems: "center", gap: 8 },
  team: { flex: 1, fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, minWidth: 0 },
  flag: { fontSize: 18, lineHeight: 1 },
  sc: { width: 44, height: 44, textAlign: "center", background: C.soft, border: `1px solid ${C.line}`, borderRadius: 11, color: C.ink, fontSize: 19, fontWeight: 800, outline: "none" },
  x: { color: C.inkSoft, fontWeight: 700, fontSize: 13 },
  markTitle: { color: C.inkSoft, fontSize: 11.5, fontWeight: 700, margin: "12px 0 7px" },
  chips: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: { background: C.soft, border: `1px solid ${C.line}`, color: C.ink, borderRadius: 20, padding: "6px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  chipOn: { background: C.green, color: C.white, borderColor: C.green },
  resLine: { marginTop: 10, paddingTop: 9, borderTop: `1px solid ${C.line}`, fontSize: 12, color: C.inkSoft, fontWeight: 600 },
  rkHeadRow: { display: "flex", alignItems: "center", gap: 10, padding: "0 14px 4px" },
  rkH: { width: 48, textAlign: "center", fontSize: 10, color: C.inkSoft, fontWeight: 700, textTransform: "uppercase" },
  rk: { display: "flex", alignItems: "center", gap: 10, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 13, padding: "11px 14px", marginBottom: 7, boxShadow: "0 2px 8px rgba(20,40,25,0.03)" },
  rkMe: { borderColor: C.green, boxShadow: `0 0 0 1.5px ${C.green}` },
  rkPos: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 17, fontWeight: 800, width: 24, textAlign: "center", color: C.inkSoft },
  rkName: { fontWeight: 700, fontSize: 15, flex: 1 },
  rkStat: { width: 48, textAlign: "center", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 18, fontWeight: 800, color: C.green },
  rulesCard: { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: 20, boxShadow: "0 4px 20px rgba(20,40,25,0.05)" },
  rulesH: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, color: C.green, margin: "0 0 6px", fontWeight: 800 },
  rulesSub: { fontSize: 14, color: C.ink, margin: "16px 0 4px", fontWeight: 800 },
  rulesP: { fontSize: 13, color: C.inkSoft, lineHeight: 1.55, margin: 0 },
  valueBox: { background: C.goldSoft, borderRadius: 12, padding: 14, margin: "12px 0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 },
  valueLbl: { fontSize: 11, color: C.gold, fontWeight: 700, textTransform: "uppercase" },
  valueBig: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 28, color: C.greenDark, fontWeight: 800 },
  split: { display: "flex", gap: 14, fontSize: 13, color: C.inkSoft, fontWeight: 600 },
  elRow: { display: "flex", gap: 8, marginTop: 7, alignItems: "center" },
  elIn: { flex: 1, background: C.soft, border: `1px solid ${C.line}`, borderRadius: 9, padding: "9px 11px", color: C.ink, fontSize: 14, outline: "none" },
  elDel: { background: "#fbeae6", border: "none", color: C.red, borderRadius: 9, width: 34, height: 34, fontSize: 18, fontWeight: 800, cursor: "pointer" },
};
