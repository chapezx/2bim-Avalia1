// script.js
// O desenho agora e gerado no servidor, pela Pages Function /api/desenho.
// Esta pagina so faz o login com o Google, envia o numero e o id_token
// e exibe o SVG recebido. A validacao do numero e do token e do servidor.

const formulario = document.getElementById("formulario");
const campoNumero = document.getElementById("numero");
const area = document.getElementById("desenho");
const mensagem = document.getElementById("mensagem");
const usuario = document.getElementById("usuario");
const botaoBaixar = document.getElementById("baixar");

let idToken = "";
let svgAtual = "";

// Le o e-mail do token apenas para mostrar na tela.
// Quem confia no e-mail e o servidor, que verifica o token no Google.
function emailDoToken(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(json).email || "";
  } catch {
    return "";
  }
}

// Chamada pelo Google Identity Services apos o login (data-callback="aoEntrar").
window.aoEntrar = (resposta) => {
  idToken = resposta.credential;
  const email = emailDoToken(idToken);
  usuario.textContent = email ? `Conectado como ${email}` : "Conectado.";
  mensagem.textContent = "";
};

function limparDesenho() {
  svgAtual = "";
  area.innerHTML = "";
  botaoBaixar.hidden = true;
}

async function mensagemDeErro(resposta) {
  let detalhe = "";
  try {
    detalhe = (await resposta.json()).erro || "";
  } catch {
    // corpo sem JSON: usa a mensagem padrao abaixo
  }

  if (resposta.status === 400) {
    return `Erro 400: ${detalhe || "número inválido. Digite um inteiro entre 1 e 100."}`;
  }
  if (resposta.status === 401) {
    return `Erro 401: ${detalhe || "não autorizado."} Entre com a sua conta Google e tente de novo.`;
  }
  return `Erro ${resposta.status}: ${detalhe || "não foi possível gerar o desenho."}`;
}

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mensagem.textContent = "";

  // Envia o que foi digitado; o servidor decide se e valido (400).
  const valor = campoNumero.value.trim();
  const corpo = valor === "" ? {} : { numero: Number(valor) };

  const cabecalhos = { "Content-Type": "application/json" };
  if (idToken) {
    cabecalhos.Authorization = `Bearer ${idToken}`;
  }

  let resposta;
  try {
    resposta = await fetch("/api/desenho", {
      method: "POST",
      headers: cabecalhos,
      body: JSON.stringify(corpo),
    });
  } catch {
    limparDesenho();
    mensagem.textContent = "Falha de rede: não foi possível falar com o servidor.";
    return;
  }

  if (!resposta.ok) {
    limparDesenho();
    mensagem.textContent = await mensagemDeErro(resposta);
    return;
  }

  svgAtual = await resposta.text();
  area.innerHTML = svgAtual;
  botaoBaixar.hidden = false;
});

botaoBaixar.addEventListener("click", () => {
  const arquivo = new Blob([svgAtual], { type: "image/svg+xml" });
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = "exemplo.svg";
  link.click();
  URL.revokeObjectURL(url);
});
