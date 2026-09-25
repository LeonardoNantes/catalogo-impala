// ============================================================
// CONEXÃO COM O SUPABASE — versão do site COMPARTILHADO
// ============================================================
// Busca os produtos reais no Supabase. Se as credenciais em config.js
// ainda não foram preenchidas (ou der algum erro de conexão), o app
// usa os produtos de exemplo (MOCK_PRODUCTS) automaticamente — assim
// o catálogo nunca fica em branco.

// Monta o link público da foto a partir do código do produto.
// Padrão confirmado no bucket do Leonardo:
// {url}/storage/v1/object/public/{bucket}/{codigo}.jpg
function montarUrlImagem(codigo) {
  const { url, bucketImagens } = CONFIG.supabase;
  return `${url}/storage/v1/object/public/${bucketImagens}/${codigo}.jpg`;
}

// ---------- Descobrir QUEM é o vendedor a partir do link usado ----------
// Prioridade 1: parâmetro ?v=slug na URL — usado por vendedores cadastrados
// DEPOIS da migração pro site único (mesmo padrão do "Ofertas da Semana").
// Prioridade 2: domínio antigo (ex: catalogo-impala-wesley.vercel.app),
// consultado na tabela "dominios_antigos" — usado pelos vendedores que já
// tinham catálogo próprio individual antes da migração, pra não precisar
// trocar o link que já está com os clientes deles.
// Retorna o slug (string) ou null se não conseguir identificar ninguém.
async function resolverVendedorId() {
  const params = new URLSearchParams(window.location.search);
  const vParam = params.get("v");
  if (vParam) return vParam.trim();

  const { url, anonKey } = CONFIG.supabase;
  if (!url || !anonKey) return null;

  try {
    const client = window.supabase.createClient(url, anonKey);
    const dominio = window.location.hostname;
    const { data, error } = await client
      .from("dominios_antigos")
      .select("slug")
      .eq("dominio", dominio)
      .maybeSingle();

    if (error || !data) return null;
    return data.slug;
  } catch (erro) {
    console.error("[Impala] Erro ao resolver vendedor pelo domínio:", erro);
    return null;
  }
}

// Busca na tabela "vendedores" os dados desse vendedor: se está ativo
// (assinatura em dia), qual é a ÁREA de preço dele (SC, PR, etc.), e os
// dados que aparecem no cabeçalho (nome, foto, whatsapp).
// "encontrado: false" quer dizer que o slug não existe na tabela - nesse
// caso mostramos a tela de "catálogo não encontrado", NÃO o catálogo
// normal (diferente do padrão antigo, porque aqui não temos mais nenhum
// dado fixo de vendedor pra usar como retaguarda).
async function buscarStatusVendedor(vendedorId) {
  const { url, anonKey } = CONFIG.supabase;
  const semDados = { encontrado: false, ativo: true, area: "SC", foto_url: null, nome: "", whatsapp: "" };

  if (!url || !anonKey || !vendedorId) return semDados;

  try {
    const client = window.supabase.createClient(url, anonKey);
    const { data, error } = await client
      .from("vendedores")
      .select("ativo, area, foto_url, nome, whatsapp")
      .eq("slug", vendedorId)
      .maybeSingle();

    if (error) {
      // Erro de rede/conexão: não temos como saber quem é o vendedor,
      // então mostramos a tela de "não encontrado" (não dá pra abrir o
      // catálogo sem nome/whatsapp de ninguém pra usar).
      console.error("[Impala] Erro ao checar status do vendedor:", error);
      return semDados;
    }
    if (!data) return semDados; // slug realmente não existe na tabela

    return {
      encontrado: true,
      ativo: data.ativo !== false,
      area: data.area || "SC",
      foto_url: data.foto_url || null,
      nome: data.nome || "",
      whatsapp: data.whatsapp || "",
    };
  } catch (erro) {
    console.error("[Impala] Erro ao checar status do vendedor:", erro);
    return semDados;
  }
}

// "area" é a área de preço do vendedor logado (vem de buscarStatusVendedor).
async function buscarProdutos(area) {
  const { url, anonKey, tabela } = CONFIG.supabase;

  const semSupabaseConfigurado = !url || !anonKey;
  if (semSupabaseConfigurado) {
    console.info("[Impala] Supabase não configurado ainda — usando produtos de exemplo.");
    return MOCK_PRODUCTS;
  }

  try {
    const client = window.supabase.createClient(url, anonKey);
    const { data, error } = await client
      .from(tabela)
      .select("*")
      .eq("ativo", true)
      .eq("area", area || "SC")
      .order("colecao", { ascending: true })
      .order("descricao", { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) {
      console.warn("[Impala] Supabase conectou mas não retornou produtos — usando exemplo.");
      return MOCK_PRODUCTS;
    }

    // Liga cada produto à sua foto no bucket pelo código (1 código = 1 imagem),
    // a menos que a linha já tenha um imagem_url específico preenchido na tabela.
    return data.map((produto) => ({
      ...produto,
      imagem_url: produto.imagem_url || montarUrlImagem(produto.codigo),
    }));
  } catch (erro) {
    console.error("[Impala] Erro ao buscar produtos no Supabase:", erro);
    return MOCK_PRODUCTS;
  }
}
