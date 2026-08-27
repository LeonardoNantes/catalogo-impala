// ============================================================
// CONEXÃO COM O SUPABASE
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

// Confere na tabela "vendedores" se este catálogo está ativo (assinatura em dia).
// Por segurança, qualquer situação incerta (sem config, erro de rede, linha não
// encontrada) deixa o catálogo ATIVO — só pausa quando a gente tem certeza que
// o vendedor foi marcado como inativo de propósito.
async function verificarVendedorAtivo() {
  const { url, anonKey } = CONFIG.supabase;
  const vendedorId = CONFIG.vendedorId;

  if (!url || !anonKey || !vendedorId) return true;

  try {
    const client = window.supabase.createClient(url, anonKey);
    const { data, error } = await client
      .from("vendedores")
      .select("ativo")
      .eq("slug", vendedorId)
      .maybeSingle();

    if (error || !data) return true;
    return data.ativo !== false;
  } catch (erro) {
    console.error("[Impala] Erro ao checar status do vendedor:", erro);
    return true;
  }
}

async function buscarProdutos() {
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
