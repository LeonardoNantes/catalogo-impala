// ============================================================
// Função serverless (Vercel) — serve a rota "/" do catálogo Impala
// ============================================================
// Motivo de existir: o WhatsApp (e a maioria dos apps de mensagem) não
// executa o JavaScript da página pra montar a prévia do link (o card com
// imagem+título+descrição) — ele só lê o HTML bruto que o servidor manda.
// Como o catálogo é uma SPA sem backend, essa função serve o HTML real
// (catalogo-base.html) trocando o marcador __OG_TITLE__ pelo nome do
// vendedor identificado no link, ANTES de responder.
//
// IMPORTANTE: pra essa rota realmente ser chamada, não pode existir nenhum
// arquivo chamado "index.html" na raiz do repositório — o Vercel serve
// esse nome direto pra rota "/" por cima de qualquer rewrite do
// vercel.json. Por isso o HTML real da página se chama
// "catalogo-base.html", e o index.html antigo precisa ser APAGADO (não só
// substituído) do repositório.
//
// Sem nenhuma biblioteca/instalação: o repositório não tem processo de
// build nem package.json, então a consulta ao Supabase aqui é feita direto
// por fetch na API REST (mesma URL/chave pública que o app já usa).

const SUPABASE_URL = "https://eubbzefshftafjjcirna.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_GZ-duizLJSQSVcdYejzWGQ_wdNUu8vA";

// Mesma lógica de identificação de vendedor que o app já usa no navegador
// (ver resolverVendedorId em supabase-client.js): prioridade pro parâmetro
// ?v=slug; se não tiver, consulta a tabela "dominios_antigos" pelo domínio
// usado (vendedor que já tinha catálogo próprio antes da migração).
async function resolverSlug(req) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const vParam = url.searchParams.get("v");
  if (vParam) return vParam.trim();

  const dominio = req.headers.host;
  try {
    const resposta = await fetch(
      `${SUPABASE_URL}/rest/v1/dominios_antigos?dominio=eq.${encodeURIComponent(dominio)}&select=slug`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (!resposta.ok) return null;
    const linhas = await resposta.json();
    return linhas[0]?.slug || null;
  } catch (erro) {
    console.error("[Impala/api/catalogo] Erro ao resolver vendedor pelo domínio:", erro);
    return null;
  }
}

async function buscarNomeVendedor(slug) {
  if (!slug) return null;
  try {
    const resposta = await fetch(
      `${SUPABASE_URL}/rest/v1/vendedores?slug=eq.${encodeURIComponent(slug)}&select=nome`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (!resposta.ok) return null;
    const linhas = await resposta.json();
    return linhas[0]?.nome || null;
  } catch (erro) {
    console.error("[Impala/api/catalogo] Erro ao buscar nome do vendedor:", erro);
    return null;
  }
}

module.exports = async (req, res) => {
  try {
    const slug = await resolverSlug(req);
    const nomeVendedor = await buscarNomeVendedor(slug);

    const titulo = nomeVendedor ? `Catálogo Impala - ${nomeVendedor}` : "Catálogo Impala";

    const fs = require("fs");
    const path = require("path");
    const htmlBruto = fs.readFileSync(path.join(process.cwd(), "catalogo-base.html"), "utf-8");
    const htmlFinal = htmlBruto.replaceAll("__OG_TITLE__", titulo);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(htmlFinal);
  } catch (erro) {
    console.error("[Impala/api/catalogo] Erro ao montar a página:", erro);
    // Em caso de erro, não deixa o catálogo fora do ar — serve o HTML base
    // sem o título personalizado.
    try {
      const fs = require("fs");
      const path = require("path");
      const htmlBruto = fs.readFileSync(path.join(process.cwd(), "catalogo-base.html"), "utf-8");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(htmlBruto.replaceAll("__OG_TITLE__", "Catálogo Impala"));
    } catch (erroFinal) {
      res.status(500).send("Erro ao carregar o catálogo.");
    }
  }
};
