# Bolão Copa 2026 — Guia de instalação (passo a passo)

Você vai colocar o bolão no ar de graça usando dois serviços: **Supabase** (banco de
dados, onde ficam contas/palpites/resultados) e **Vercel** (hospedagem, gera o link
público). Não precisa instalar servidor nem pagar nada.

Tempo estimado: ~25 minutos. Você não precisa saber programar — é seguir os cliques.

---

## PARTE 1 — Criar o banco de dados (Supabase)

1. Acesse https://supabase.com e clique em **Start your project** / **Sign in**.
   Pode entrar com sua conta do GitHub ou Google.
2. Clique em **New project**.
   - Dê um nome (ex: `bolao-copa`).
   - Crie uma senha de banco (anote em algum lugar — não é a senha do bolão).
   - Região: escolha **South America (São Paulo)** se aparecer.
   - Clique em **Create new project** e espere ~2 min até ficar pronto.
3. No menu lateral, abra **SQL Editor** → **New query**.
4. Abra o arquivo `supabase-setup.sql` (que veio neste pacote), copie TODO o conteúdo,
   cole na janela e clique em **Run**. Deve aparecer "Success".
   Isso cria as tabelas de usuários, palpites e resultados.
5. Agora pegue as chaves: menu lateral → **Project Settings** (engrenagem) → **API**.
   Você vai precisar de dois valores:
   - **Project URL** (algo como `https://abcdefgh.supabase.co`)
   - **anon public** (uma chave longa, em "Project API keys")
   Deixe essa aba aberta — vai usar no Parte 2.

---

## PARTE 2 — Configurar o código

1. Abra o arquivo `src/config.js` num editor de texto (o Bloco de Notas serve).
2. Substitua:
   - `https://SEU-PROJETO.supabase.co` pela sua **Project URL**.
   - `SUA_CHAVE_ANON_PUBLIC` pela chave **anon public**.
3. (Opcional) Ainda no `config.js`, troque a senha do admin (`ADMIN_PASSWORD`)
   e ajuste `TRAVA_MINUTOS` se quiser outro tempo de fechamento.
4. Salve o arquivo.

---

## PARTE 3 — Publicar o site (Vercel)

A forma mais fácil é pelo GitHub (assim dá pra atualizar depois com 1 clique).

### 3a. Subir o código para o GitHub
1. Crie uma conta em https://github.com (se não tiver).
2. Clique em **New repository**, dê um nome (ex: `bolao-copa`), deixe **Public**
   ou **Private**, e clique em **Create repository**.
3. Na página do repositório, clique em **uploading an existing file** e arraste
   TODOS os arquivos desta pasta (incluindo a pasta `src`). Clique em **Commit changes**.

### 3b. Conectar na Vercel
1. Acesse https://vercel.com e clique em **Sign up** — entre com a conta do GitHub.
2. Clique em **Add New → Project**, escolha o repositório `bolao-copa` e clique **Import**.
3. A Vercel detecta o Vite sozinho. Só clique em **Deploy** e espere ~1 min.
4. Pronto! Vai aparecer um link tipo `https://bolao-copa.vercel.app`.
   **Esse é o link que você manda no grupo dos colegas.**

---

## PARTE 4 — Usar com os colegas

1. Mande o link da Vercel no grupo.
2. Cada pessoa abre, digita **nome + senha** e clica em **CRIAR CONTA** (só na 1ª vez).
   Depois é só **ENTRAR** com nome + senha.
3. Cada um dá seus palpites — salvam sozinhos e aparecem no ranking de todos.
4. Os jogos e resultados vêm automaticamente da TheSportsDB ao abrir o app
   (ou clicando em "atualizar"). Palpites fecham 10 min antes de cada jogo.
5. Você, como organizador, tem o painel **Admin** (com a senha do `config.js`)
   para corrigir manualmente um placar caso a API atrase.

---

## Dúvidas comuns

**"Os jogos aparecem como 'A definir'."**
A tabela oficial da Copa depende de sorteio/classificação. Enquanto a base de dados
não publicar os confrontos, aparecem exemplos. Conforme a TheSportsDB atualiza, os
jogos reais entram sozinhos. Se o identificador da liga mudar, ajuste `LEAGUE_ID` no config.

**"Quero rodar no meu PC antes de publicar."**
Instale o Node.js (https://nodejs.org), abra o terminal na pasta e rode:
`npm install` e depois `npm run dev`. Abra o endereço que aparecer (ex: localhost:5173).

**"A senha é segura?"**
Não para coisas sérias — ela fica salva como texto no banco. Serve para impedir que
um colega edite o palpite do outro. Ninguém deve reusar uma senha importante aqui.

**"Como atualizo o app depois?"**
Edite os arquivos no GitHub (ou suba de novo) — a Vercel republicação sozinha.
