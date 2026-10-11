export async function onRequestGet({ env, request }) {
  const nome = new URL(request.url).searchParams.get("nome");
  const { results } = await env.DB.prepare("SELECT * FROM notas WHERE aluno = ?").bind(nome).all();
  return Response.json(results);
}