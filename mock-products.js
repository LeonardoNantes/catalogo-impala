// ============================================================
// PRODUTOS DE EXEMPLO (MOCK)
// ============================================================
// Só usados se o Supabase não estiver configurado ainda, ou se
// a conexão falhar — assim o catálogo nunca fica em branco.
// Mesma estrutura da tabela real: codigo, descricao, colecao,
// fracao (tamanho do blister), preco_unitario, preco_total, imagem_url.

const MOCK_PRODUCTS = [
  { codigo: 112897, descricao: "CREMOSO AFETO (BLISTER 7,5ML)", colecao: "A COR DA MODA", fracao: 6, preco_unitario: 3.83, preco_total: 22.98, imagem_url: "https://placehold.co/400x400/c2185b/ffffff?text=112897" },
  { codigo: 111683, descricao: "CREMOSO ALENTO (BLISTER 7,5ML)", colecao: "A COR DA MODA", fracao: 6, preco_unitario: 3.83, preco_total: 22.98, imagem_url: "https://placehold.co/400x400/e91e63/ffffff?text=111683" },
  { codigo: 113618, descricao: "CREMOSO DERRETE NA BOCA (BLISTER 7,5ML)", colecao: "CACAU SHOW", fracao: 6, preco_unitario: 4.45, preco_total: 26.70, imagem_url: "https://placehold.co/400x400/ad1457/ffffff?text=113618" },
  { codigo: 113623, descricao: "CREMOSO EXPLOSÃO DE CACAU (BLISTER 7,5ML)", colecao: "CACAU SHOW", fracao: 6, preco_unitario: 4.45, preco_total: 26.70, imagem_url: "https://placehold.co/400x400/f06292/ffffff?text=113623" },
  { codigo: 112565, descricao: "BASE BLISTER (BLISTER 8ML)", colecao: "GEL PLUS", fracao: 3, preco_unitario: 20.94, preco_total: 62.82, imagem_url: "https://placehold.co/400x400/9c27b0/ffffff?text=112565" },
  { codigo: 108361, descricao: "ENDURECEDORA CASCO CAVALO (BLISTER 7,5ML)", colecao: "BASE / TRATAMENTO", fracao: 6, preco_unitario: 3.73, preco_total: 22.38, imagem_url: "https://placehold.co/400x400/c2185b/ffffff?text=108361" },
];
