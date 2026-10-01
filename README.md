# Desenho Assinado

Página que recebe um número inteiro entre 1 e 100 e devolve uma figura em SVG, assinada com o e-mail da conta Google usada no login.

A figura é a tabuada modular no círculo: 240 pontos igualmente espaçados numa circunferência, com cada ponto `i` ligado ao ponto `(k * i) mod 240`, em que `k = número + 1`. O número 1 produz uma cardioide, o 2 uma nefroide, e cada valor gera uma figura diferente.

## Como funciona

O desenho é gerado no servidor, por uma Pages Function. O navegador faz login com o Google (Google Identity Services), recebe um `id_token` e o envia junto com o número para `/api/desenho`. O servidor verifica o token em `https://oauth2.googleapis.com/tokeninfo` e assina o desenho com o campo `email` da resposta. O e-mail nunca é enviado pelo formulário.

```
public/
  index.html          formulário com o número e o botão de login do Google
  style.css           aparência da página
  script.js           envia número e token com fetch e exibe o SVG
lib/
  desenho.js          gera o SVG (função pura, sem DOM), fora da área pública
functions/
  api/desenho.js      Pages Function que implementa o contrato da API
evidencias/
  exemplo.svg         desenho gerado pelo site publicado
```

## Contrato da API

| Item      | Exigência |
|-----------|-----------|
| Rota      | `POST /api/desenho` |
| Corpo     | JSON no formato `{"numero": 42}` |
| Cabeçalho | `Authorization: Bearer <id_token>` |
| 200       | SVG, `Content-Type: image/svg+xml`, assinado com o e-mail do token |
| 400       | Corpo ausente, JSON inválido, `numero` ausente, não inteiro ou fora de 1 a 100 |
| 401       | Token ausente, inválido, expirado, `aud` diferente do Client ID ou e-mail não verificado |
| 405       | Qualquer método diferente de `POST` |

As verificações seguem a ordem: método (405), corpo (400), token (401).

## Publicação no Cloudflare Pages

Framework preset: `None`. Build command: vazio. Build output directory: `public`.

Variável de ambiente (Settings > Variables and Secrets): `GOOGLE_CLIENT_ID` com o Client ID do OAuth Client do Google.

## Identificação (preencha após o fork)

Nome: Vitória Faranhas Braga
RA: 2026109204
URL: https://2bim-avalia1-desenho-assinado.pages.dev
