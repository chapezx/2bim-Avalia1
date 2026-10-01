// functions/api/desenho.js
// Pages Function da rota /api/desenho.
//
// Contrato:
//   POST /api/desenho
//   Cabecalho: Authorization: Bearer <id_token>
//   Corpo:     {"numero": 42}
//
//   200  SVG (image/svg+xml) assinado com o e-mail do token
//   400  corpo ausente, JSON invalido, numero ausente, nao inteiro ou fora de 1..100
//   401  token ausente, invalido, expirado, aud diferente ou e-mail nao verificado
//   405  qualquer metodo diferente de POST
//
// As verificacoes seguem a ordem: metodo (405), corpo (400), token (401).
// O e-mail da assinatura vem sempre da resposta do Google, nunca do cliente.

import { gerarDesenho, numeroValido } from "../../lib/desenho.js";

const TOKENINFO = "https://oauth2.googleapis.com/tokeninfo?id_token=";

function erro(status, mensagem, cabecalhos = {}) {
  return new Response(JSON.stringify({ erro: mensagem }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...cabecalhos,
    },
  });
}

// Le o corpo como JSON e devolve o numero, ou null se o corpo for invalido.
async function lerNumero(request) {
  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return null; // corpo ausente ou JSON invalido
  }
  if (corpo === null || typeof corpo !== "object" || Array.isArray(corpo)) {
    return null;
  }
  return numeroValido(corpo.numero) ? corpo.numero : null;
}

// Extrai o token do cabecalho "Authorization: Bearer <token>".
function lerToken(request) {
  const cabecalho = request.headers.get("Authorization") || "";
  const partes = cabecalho.match(/^Bearer\s+(\S+)\s*$/i);
  return partes ? partes[1] : null;
}

// Valida o id_token no Google e devolve o e-mail, ou null se for rejeitado.
async function verificarToken(token, clientId) {
  if (!token || !clientId) return null;

  let resposta;
  try {
    resposta = await fetch(TOKENINFO + encodeURIComponent(token));
  } catch {
    return null;
  }
  if (resposta.status !== 200) return null; // invalido ou expirado

  let dados;
  try {
    dados = await resposta.json();
  } catch {
    return null;
  }

  if (dados.aud !== clientId) return null;
  if (String(dados.email_verified) !== "true") return null;
  if (typeof dados.email !== "string" || dados.email === "") return null;

  return dados.email;
}

export async function onRequest({ request, env }) {
  // 1. Metodo
  if (request.method !== "POST") {
    return erro(405, "Metodo nao permitido. Use POST.", { Allow: "POST" });
  }

  // 2. Corpo
  const numero = await lerNumero(request);
  if (numero === null) {
    return erro(400, "Requisicao invalida: envie um JSON com um numero inteiro entre 1 e 100.");
  }

  // 3. Token
  const email = await verificarToken(lerToken(request), env.GOOGLE_CLIENT_ID);
  if (email === null) {
    return erro(401, "Nao autorizado: faca login com uma conta Google valida.");
  }

  return new Response(gerarDesenho(numero, email), {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store",
    },
  });
}
