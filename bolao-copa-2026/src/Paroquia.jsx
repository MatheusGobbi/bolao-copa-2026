import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase, ADMIN_PASSWORD, TRAVA_MINUTOS } from "./config";
import { JOGOS_BRASIL, ELENCO_INICIAL } from "./dados-paroquia";
import { bandeira } from "./jogos";

const C = {
  bg: "#f4f6f4", surface: "#ffffff", soft: "#eef1ee", line: "#e2e7e2",
  ink: "#15281b", inkSoft: "#5b6b5f", green: "#1f8a4c", greenDark: "#136336",
  greenSoft: "#e6f3eb", gold: "#c8941f", goldSoft: "#fbf2dc", red: "#c2452f", white: "#fff",
};
const GOL_CONTRA = "OG"; // id especial para "gol contra"
const ORDEM_POS = ["Goleiro", "Zagueiro", "Lateral", "Volante", "Meio-campo", "Atacante", "Outros"];
const GRUPO_POS = { Goleiro: "Goleiros", Zagueiro: "Defensores", Lateral: "Defensores", Volante: "Meio-campo", "Meio-campo": "Meio-campo", Atacante: "Atacantes", Outros: "Outros" };

function fmtData(iso) {
  const d = new Date(iso); if (isNaN(d)) return "data a definir";
  return d.toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function fechado(iso, res) {
  if (res && res.casa != null && res.fora != null) return true;
  const t = new Date(iso).getTime(); if (isNaN(t)) return false;
  return Date.now() >= t - TRAVA_MINUTOS * 60 * 1000;
}
// conta ocorrências em duas listas (multiset) — quantos coincidem
function interMulti(a, b) {
  const cont = {}; let n = 0;
  for (const x of b) cont[x] = (cont[x] || 0) + 1;
  for (const x of a) if (cont[x] > 0) { n++; cont[x]--; }
  return n;
}
function sameMulti(a, b) {
  if (a.length !== b.length) return false;
  const ca = {}, cb = {};
  for (const x of a) ca[x] = (ca[x] || 0) + 1;
  for (const x of b) cb[x] = (cb[x] || 0) + 1;
  return Object.keys(ca).length === Object.keys(cb).length && Object.keys(ca).every(k => ca[k] === cb[k]);
}
// gols do Brasil dado um palpite/resultado e o jogo (Brasil pode ser casa ou fora)
function golsBrasil(jg, r) {
  if (!r || r.casa == null || r.fora == null) return null;
  return jg.casa === "Brasil" ? +r.casa : +r.fora;
}

export default function Paroquia({ nome, isAdmin }) {
  const [tab, setTab] = useState("palpites");
  const [elenco, setElenco] = useState(ELENCO_INICIAL);
  const [palpites, setPalpites] = useState({});
  const [palpitesTodos, setPalpitesTodos] = useState({});
  const [resultados, setResultados] = useState({});
  const [usuarios, setUsuarios] = useState([]);
  const [comprovante, setComprovante] = useState(null); // {jogo, palpite}
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
      for (const p of pal) { (todos[p.nome] = todos[p.nome] || {})[p.jogo_id] = { casa: p.casa, fora: p.fora, marcadores: p.marcadores || [], confirmado: p.confirmado }; }
      setPalpitesTodos(todos);
      setPalpites(todos[nome] || {});
    }
    const { data: res } = await supabase.from("resultados_paroquia").select("*");
    if (res) { const m = {}; for (const r of res) m[r.jogo_id] = { casa: r.casa, fora: r.fora, marcadores: r.marcadores || [] }; setResultados(m); }
  }, [nome]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { const t = setInterval(() => force(n => n + 1), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(carregar, 25000); return () => clearInterval(t); }, [carregar]);

  async function gravar(jogoId, novo) {
    setPalpites(p => ({ ...p, [jogoId]: novo }));
    await supabase.from("palpites_paroquia").upsert(
      { nome, jogo_id: jogoId, casa: novo.casa, fora: novo.fora, marcadores: novo.marcadores, confirmado: novo.confirmado || false, atualizado_em: new Date().toISOString() },
      { onConflict: "nome,jogo_id" });
  }
  function setPlacar(jg, campo, valor) {
    const atual = palpites[jg.id] || { casa: null, fora: null, marcadores: [], confirmado: false };
    const v = valor === "" ? null : +valor;
    const novo = { ...atual, [campo]: v, confirmado: false };
    // se reduziu os gols do Brasil, corta marcadores excedentes
    const gb = golsBrasil(jg, novo);
    if (gb != null && novo.marcadores.length > gb) novo.marcadores = novo.marcadores.slice(0, gb);
    gravar(jg.id, novo);
  }
  function addMarcador(jg, jid) {
    const atual = palpites[jg.id] || { casa: null, fora: null, marcadores: [], confirmado: false };
    const gb = golsBrasil(jg, atual);
    if (gb == null) return;
    if (atual.marcadores.length >= gb) return; // já atingiu o nº de gols
    gravar(jg.id, { ...atual, marcadores: [...atual.marcadores, jid], confirmado: false });
  }
  function removeMarcador(jg, idx) {
    const atual = palpites[jg.id] || { casa: null, fora: null, marcadores: [], confirmado: false };
    const ms = [...atual.marcadores]; ms.splice(idx, 1);
    gravar(jg.id, { ...atual, marcadores: ms, confirmado: false });
  }
  async function confirmar(jg) {
    const atual = palpites[jg.id]; if (!atual) return;
    const novo = { ...atual, confirmado: true };
    await gravar(jg.id, novo);
    setComprovante({ jogo: jg, palpite: novo });
  }

  // ---- resultados (admin) ----
  async function gravarRes(jogoId, novo) {
    setResultados(r => ({ ...r, [jogoId]: novo }));
    await supabase.from("resultados_paroquia").upsert(
      { jogo_id: jogoId, casa: novo.casa, fora: novo.fora, marcadores: novo.marcadores, atualizado_em: new Date().toISOString() },
      { onConflict: "jogo_id" });
  }
  function setResPlacar(jg, campo, valor) {
    const atual = resultados[jg.id] || { casa: null, fora: null, marcadores: [] };
    const v = valor === "" ? null : +valor;
    const novo = { ...atual, [campo]: v };
    const gb = golsBrasil(jg, novo);
    if (gb != null && novo.marcadores.length > gb) novo.marcadores = novo.marcadores.slice(0, gb);
    gravarRes(jg.id, novo);
  }
  function addResMarcador(jg, jid) {
    const atual = resultados[jg.id] || { casa: null, fora: null, marcadores: [] };
    const gb = golsBrasil(jg, atual);
    if (gb == null || atual.marcadores.length >= gb) return;
    gravarRes(jg.id, { ...atual, marcadores: [...atual.marcadores, jid] });
  }
  function removeResMarcador(jg, idx) {
    const atual = resultados[jg.id] || { casa: null, fora: null, marcadores: [] };
    const ms = [...atual.marcadores]; ms.splice(idx, 1);
    gravarRes(jg.id, { ...atual, marcadores: ms });
  }

  // ---- elenco (admin) ----
  const [novoNome, setNovoNome] = useState("");
  const [novaPos, setNovaPos] = useState("Atacante");
  async function addJogador() {
    const n = novoNome.trim(); if (!n) return;
    const id = "j" + Date.now().toString().slice(-6);
    await supabase.from("elenco").upsert({ id, nome: n, posicao: novaPos, ordem: elenco.length }, { onConflict: "id" });
    setNovoNome(""); carregar();
  }
  async function editarJogador(id, nome) { await supabase.from("elenco").update({ nome }).eq("id", id); carregar(); }
  async function removerJogador(id) { await supabase.from("elenco").delete().eq("id", id); carregar(); }

  const nomeJogador = (id) => id === GOL_CONTRA ? "Gol contra" : ((elenco.find(e => e.id === id) || {}).nome || "?");

  // elenco agrupado por posição
  const elencoPorGrupo = useMemo(() => {
    const validos = elenco.filter(e => e.nome && e.nome !== "(editar)");
    const g = {};
    for (const e of validos) { const gp = GRUPO_POS[e.posicao] || "Outros"; (g[gp] = g[gp] || []).push(e); }
    const ordemGrupos = ["Goleiros", "Defensores", "Meio-campo", "Atacantes", "Outros"];
    return ordemGrupos.filter(k => g[k]).map(k => ({ grupo: k, jogadores: g[k] }));
  }, [elenco]);

  const ranking = useMemo(() => {
    return usuarios.map(jogador => {
      const pal = palpitesTodos[jogador] || {};
      let exatos = 0, autores = 0, marcadores = 0;
      for (const jg of JOGOS_BRASIL) {
        const r = resultados[jg.id]; const p = pal[jg.id];
        if (!r || r.casa == null || r.fora == null || !p || p.casa == null || p.fora == null) continue;
        if (+p.casa === +r.casa && +p.fora === +r.fora) exatos++;
        autores += interMulti(p.marcadores || [], r.marcadores || []);
        if (sameMulti(p.marcadores || [], r.marcadores || [])) marcadores++;
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
            <p style={S.note}>Dê o placar e escolha quem marca pelo Brasil — você pode escolher tantos jogadores quantos forem os gols. Depois confirme.</p>
            {JOGOS_BRASIL.map(jg => {
              const p = palpites[jg.id] || { casa: null, fora: null, marcadores: [], confirmado: false };
              const res = resultados[jg.id];
              const fch = fechado(jg.iso, res);
              const gb = golsBrasil(jg, p);
              const faltam = gb == null ? null : gb - p.marcadores.length;
              const completo = p.casa != null && p.fora != null && (gb === 0 || p.marcadores.length === gb);
              return (
                <div key={jg.id} style={S.match}>
                  <div style={S.mTop}>
                    <span style={S.dt}>{fmtData(jg.iso)}</span>
                    {fch ? <span style={S.lock}>fechado</span> : p.confirmado ? <span style={S.okTag}>✓ confirmado</span> : null}
                  </div>
                  <div style={S.mRow}>
                    <span style={S.team}><span style={S.flag}>{bandeira(jg.casa)}</span>{jg.casa}</span>
                    <input type="number" min="0" style={{ ...S.sc, opacity: fch ? .45 : 1 }} value={p.casa ?? ""} disabled={fch} onChange={e => setPlacar(jg, "casa", e.target.value)} />
                    <span style={S.x}>×</span>
                    <input type="number" min="0" style={{ ...S.sc, opacity: fch ? .45 : 1 }} value={p.fora ?? ""} disabled={fch} onChange={e => setPlacar(jg, "fora", e.target.value)} />
                    <span style={{ ...S.team, justifyContent: "flex-end", textAlign: "right" }}>{jg.fora}<span style={S.flag}>{bandeira(jg.fora)}</span></span>
                  </div>

                  {gb == null ? (
                    <div style={S.hintBox}>Preencha o placar para escolher os autores dos gols.</div>
                  ) : gb === 0 ? (
                    <div style={S.hintBox}>Você previu Brasil sem marcar gols — sem autores a escolher.</div>
                  ) : (
                    <>
                      <div style={S.markHead}>
                        <span>Autores dos gols do Brasil</span>
                        <span style={S.counter}>{p.marcadores.length} de {gb}</span>
                      </div>
                      {p.marcadores.length > 0 && (
                        <div style={S.selected}>
                          {p.marcadores.map((jid, i) => (
                            <button key={i} disabled={fch} onClick={() => removeMarcador(jg, i)} style={{ ...S.selChip, opacity: fch ? .6 : 1 }}>
                              {nomeJogador(jid)} <span style={S.xMark}>×</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {!fch && faltam > 0 && (
                        <div style={S.picker}>
                          <button onClick={() => addMarcador(jg, GOL_CONTRA)} style={{ ...S.chip, ...S.chipOG }}>+ Gol contra</button>
                          {elencoPorGrupo.map(({ grupo, jogadores }) => (
                            <div key={grupo} style={S.posGroup}>
                              <div style={S.posTitle}>{grupo}</div>
                              <div style={S.chips}>
                                {jogadores.map(e => (
                                  <button key={e.id} onClick={() => addMarcador(jg, e.id)} style={S.chip}>{e.nome}</button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {!fch && (
                    <button disabled={!completo} onClick={() => confirmar(jg)} style={{ ...S.confirmBtn, ...(completo ? {} : S.confirmOff) }}>
                      {p.confirmado ? "Ver comprovante" : "Confirmar palpite"}
                    </button>
                  )}

                  {res && res.casa != null && (
                    <div style={S.resLine}>
                      Final {res.casa} × {res.fora}
                      {res.marcadores?.length > 0 && <span> · marcou: {res.marcadores.map(nomeJogador).join(", ")}</span>}
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
              <p style={S.rulesP}>Dê seu palpite do placar de cada partida do Brasil e informe quais jogadores você acha que farão gol pela seleção (a quantidade igual ao número de gols previstos).</p>
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
            <p style={S.note}>Lançar resultados reais (placar + autores dos gols do Brasil).</p>
            {JOGOS_BRASIL.map(jg => {
              const r = resultados[jg.id] || { casa: null, fora: null, marcadores: [] };
              const gb = golsBrasil(jg, r);
              return (
                <div key={jg.id} style={S.match}>
                  <div style={S.mTop}><span style={S.dt}>{jg.casa} × {jg.fora}</span></div>
                  <div style={S.mRow}>
                    <span style={S.team}>{jg.casa}</span>
                    <input type="number" min="0" style={S.sc} value={r.casa ?? ""} placeholder="–" onChange={e => setResPlacar(jg, "casa", e.target.value)} />
                    <span style={S.x}>×</span>
                    <input type="number" min="0" style={S.sc} value={r.fora ?? ""} placeholder="–" onChange={e => setResPlacar(jg, "fora", e.target.value)} />
                    <span style={{ ...S.team, justifyContent: "flex-end", textAlign: "right" }}>{jg.fora}</span>
                  </div>
                  {gb > 0 && (
                    <>
                      <div style={S.markHead}><span>Autores ({r.marcadores.length} de {gb})</span></div>
                      {r.marcadores.length > 0 && (
                        <div style={S.selected}>
                          {r.marcadores.map((jid, i) => (
                            <button key={i} onClick={() => removeResMarcador(jg, i)} style={S.selChip}>{nomeJogador(jid)} <span style={S.xMark}>×</span></button>
                          ))}
                        </div>
                      )}
                      {r.marcadores.length < gb && (
                        <div style={S.picker}>
                          <button onClick={() => addResMarcador(jg, GOL_CONTRA)} style={{ ...S.chip, ...S.chipOG }}>+ Gol contra</button>
                          {elencoPorGrupo.map(({ grupo, jogadores }) => (
                            <div key={grupo} style={S.posGroup}>
                              <div style={S.posTitle}>{grupo}</div>
                              <div style={S.chips}>{jogadores.map(e => <button key={e.id} onClick={() => addResMarcador(jg, e.id)} style={S.chip}>{e.nome}</button>)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            <div style={{ ...S.match, marginTop: 18 }}>
              <div style={S.markHead}><span>Elenco do Brasil (editar)</span></div>
              {ORDEM_POS.map(pos => {
                const js = elenco.filter(e => e.posicao === pos);
                if (!js.length) return null;
                return (
                  <div key={pos}>
                    <div style={S.posTitle}>{pos}</div>
                    {js.map(e => (
                      <div key={e.id} style={S.elRow}>
                        <input style={S.elIn} defaultValue={e.nome} onBlur={ev => ev.target.value !== e.nome && editarJogador(e.id, ev.target.value)} />
                        <button style={S.elDel} onClick={() => removerJogador(e.id)}>×</button>
                      </div>
                    ))}
                  </div>
                );
              })}
              <div style={{ ...S.elRow, marginTop: 12 }}>
                <input style={S.elIn} placeholder="novo jogador…" value={novoNome} onChange={e => setNovoNome(e.target.value)} onKeyDown={e => e.key === "Enter" && addJogador()} />
                <select style={S.elSel} value={novaPos} onChange={e => setNovaPos(e.target.value)}>
                  {ORDEM_POS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <button style={{ ...S.chip, ...S.chipOn }} onClick={addJogador}>+</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {comprovante && <Comprovante data={comprovante} nome={nome} nomeJogador={nomeJogador} onClose={() => setComprovante(null)} />}
    </div>
  );
}

// ============ COMPROVANTE ============
function Comprovante({ data, nome, nomeJogador, onClose }) {
  const { jogo, palpite } = data;
  const ref = useRef(null);
  const dataHora = new Date().toLocaleString("pt-BR");
  const codigo = (nome + jogo.id + (palpite.casa ?? "") + (palpite.fora ?? "")).split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 1000000, 7).toString().padStart(6, "0");

  function baixarImagem() {
    const cv = document.createElement("canvas");
    const W = 720, H = 1000; cv.width = W; cv.height = H;
    const x = cv.getContext("2d");
    // fundo
    x.fillStyle = "#136336"; x.fillRect(0, 0, W, H);
    x.fillStyle = "#ffffff"; x.fillRect(28, 28, W - 56, H - 56);
    // cabeçalho
    x.fillStyle = "#136336"; x.font = "bold 46px Georgia, serif"; x.textAlign = "center";
    x.fillText("Bolão Solidário", W / 2, 110);
    x.font = "bold 26px Georgia, serif"; x.fillStyle = "#c8941f";
    x.fillText("COMPROVANTE DE PALPITE", W / 2, 150);
    x.strokeStyle = "#e2e7e2"; x.beginPath(); x.moveTo(60, 180); x.lineTo(W - 60, 180); x.stroke();
    // dados
    x.textAlign = "left"; x.fillStyle = "#5b6b5f"; x.font = "20px Arial";
    x.fillText("Participante", 60, 230);
    x.fillStyle = "#15281b"; x.font = "bold 30px Arial"; x.fillText(nome, 60, 266);
    x.fillStyle = "#5b6b5f"; x.font = "20px Arial"; x.fillText("Partida", 60, 320);
    x.fillStyle = "#15281b"; x.font = "bold 28px Arial"; x.fillText(`${jogo.casa}  ×  ${jogo.fora}`, 60, 356);
    // placar
    x.fillStyle = "#5b6b5f"; x.font = "20px Arial"; x.fillText("Seu palpite de placar", 60, 412);
    x.fillStyle = "#1f8a4c"; x.font = "bold 70px Georgia, serif"; x.textAlign = "center";
    x.fillText(`${palpite.casa}  ×  ${palpite.fora}`, W / 2, 490);
    // autores
    x.textAlign = "left"; x.fillStyle = "#5b6b5f"; x.font = "20px Arial"; x.fillText("Autores dos gols do Brasil", 60, 560);
    x.fillStyle = "#15281b"; x.font = "bold 24px Arial";
    const ms = palpite.marcadores.map(nomeJogador);
    if (ms.length === 0) x.fillText("—", 60, 598);
    else ms.forEach((m, i) => x.fillText(`${i + 1}.  ${m}`, 60, 598 + i * 38));
    // rodapé
    x.strokeStyle = "#e2e7e2"; x.beginPath(); x.moveTo(60, H - 150); x.lineTo(W - 60, H - 150); x.stroke();
    x.fillStyle = "#5b6b5f"; x.font = "18px Arial";
    x.fillText(`Código: ${codigo}`, 60, H - 110);
    x.fillText(`Emitido em: ${dataHora}`, 60, H - 80);
    x.fillStyle = "#c8941f"; x.font = "italic 18px Georgia, serif";
    x.fillText("Vai passar o 1º jogo do Brasil!", 60, H - 48);
    // download
    const a = document.createElement("a");
    a.download = `comprovante-${jogo.id}-${nome}.png`;
    a.href = cv.toDataURL("image/png"); a.click();
  }

  return (
    <div style={S.modalBg} onClick={onClose}>
      <div style={S.modal} ref={ref} onClick={e => e.stopPropagation()}>
        <div style={S.compHead}>
          <div style={S.compCheck}>✓</div>
          <h3 style={S.compTitle}>Palpite confirmado!</h3>
          <p style={S.compSub}>Guarde seu comprovante</p>
        </div>
        <div style={S.compBody}>
          <div style={S.compRow}><span style={S.compLbl}>Participante</span><b>{nome}</b></div>
          <div style={S.compRow}><span style={S.compLbl}>Partida</span><b>{jogo.casa} × {jogo.fora}</b></div>
          <div style={S.compPlacar}>{palpite.casa} × {palpite.fora}</div>
          <div style={S.compLbl}>Autores dos gols do Brasil</div>
          {palpite.marcadores.length === 0 ? <p style={{ margin: "4px 0", color: C.inkSoft }}>—</p> : (
            <ol style={S.compList}>{palpite.marcadores.map((jid, i) => <li key={i}>{nomeJogador(jid)}</li>)}</ol>
          )}
          <div style={S.compCode}>Código {codigo} · {dataHora}</div>
        </div>
        <div style={S.compBtns}>
          <button style={S.btn} onClick={baixarImagem}>Baixar imagem</button>
          <button style={S.btn2} onClick={onClose}>Fechar</button>
        </div>
      </div>
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
  okTag: { color: C.green, fontSize: 9.5, fontWeight: 800, background: C.greenSoft, borderRadius: 6, padding: "2px 7px" },
  mRow: { display: "flex", alignItems: "center", gap: 8 },
  team: { flex: 1, fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, minWidth: 0 },
  flag: { fontSize: 18, lineHeight: 1 },
  sc: { width: 44, height: 44, textAlign: "center", background: C.soft, border: `1px solid ${C.line}`, borderRadius: 11, color: C.ink, fontSize: 19, fontWeight: 800, outline: "none" },
  x: { color: C.inkSoft, fontWeight: 700, fontSize: 13 },
  hintBox: { marginTop: 10, padding: "9px 11px", background: C.soft, borderRadius: 9, color: C.inkSoft, fontSize: 12, fontWeight: 600 },
  markHead: { display: "flex", justifyContent: "space-between", alignItems: "center", margin: "13px 0 8px", color: C.ink, fontSize: 12.5, fontWeight: 800 },
  counter: { color: C.green, background: C.greenSoft, borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 800 },
  selected: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  selChip: { background: C.green, color: C.white, border: "none", borderRadius: 20, padding: "6px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" },
  xMark: { opacity: .8, marginLeft: 2 },
  picker: { background: C.soft, borderRadius: 11, padding: "10px 11px" },
  posGroup: { marginTop: 8 },
  posTitle: { color: C.inkSoft, fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: .5, margin: "6px 0 5px" },
  chips: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: { background: C.surface, border: `1px solid ${C.line}`, color: C.ink, borderRadius: 20, padding: "6px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  chipOn: { background: C.green, color: C.white, borderColor: C.green },
  chipOG: { borderColor: C.gold, color: C.gold, fontWeight: 800, marginBottom: 4 },
  confirmBtn: { width: "100%", marginTop: 12, background: C.green, color: C.white, border: "none", borderRadius: 11, padding: 13, fontWeight: 800, fontSize: 14.5, cursor: "pointer" },
  confirmOff: { background: C.line, color: C.inkSoft, cursor: "not-allowed" },
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
  elSel: { background: C.soft, border: `1px solid ${C.line}`, borderRadius: 9, padding: "9px", color: C.ink, fontSize: 13 },
  elDel: { background: "#fbeae6", border: "none", color: C.red, borderRadius: 9, width: 34, height: 34, fontSize: 18, fontWeight: 800, cursor: "pointer" },
  // modal comprovante
  modalBg: { position: "fixed", inset: 0, background: "rgba(10,20,12,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 },
  modal: { background: C.white, borderRadius: 20, maxWidth: 380, width: "100%", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" },
  compHead: { background: C.green, color: C.white, padding: "22px 20px", textAlign: "center" },
  compCheck: { width: 50, height: 50, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 8px" },
  compTitle: { margin: "0 0 2px", fontSize: 20, fontWeight: 800 },
  compSub: { margin: 0, fontSize: 12.5, opacity: .9 },
  compBody: { padding: 20 },
  compRow: { display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 8, color: C.ink },
  compLbl: { color: C.inkSoft, fontSize: 12.5, fontWeight: 600 },
  compPlacar: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 44, color: C.green, fontWeight: 800, textAlign: "center", margin: "8px 0 14px" },
  compList: { margin: "4px 0 0", paddingLeft: 20, color: C.ink, fontSize: 14, fontWeight: 600, lineHeight: 1.6 },
  compCode: { marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}`, color: C.inkSoft, fontSize: 11, textAlign: "center" },
  compBtns: { display: "flex", gap: 8, padding: "0 20px 20px" },
  btn: { flex: 1, background: C.green, color: C.white, border: "none", borderRadius: 11, padding: 12, fontWeight: 800, fontSize: 14, cursor: "pointer" },
  btn2: { flex: 1, background: C.white, color: C.green, border: `1.5px solid ${C.green}`, borderRadius: 11, padding: 11, fontWeight: 800, fontSize: 14, cursor: "pointer" },
};
