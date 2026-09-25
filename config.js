// ============================================================
// CONFIGURAÇÃO DO CATÁLOGO — site COMPARTILHADO do Impala
// ============================================================
// Esta versão é diferente da versão "1 vendedor = 1 pasta" de antes:
// aqui NÃO existe mais vendedorId nem nome/whatsapp fixos. Cada acesso
// descobre sozinho quem é o vendedor (por ?v=slug na URL, ou pelo
// domínio antigo) e busca nome/foto/whatsapp dele no Supabase, na hora.
// Ver resolver-vendedor.js e supabase-client.js.

const CONFIG = {
  // ---- Marca / catálogo (igual pra todo mundo) ----
  marca: "Impala",
  nomeCatalogo: "Loja Impala",
  sloganMarca: "💅 Impala, a cor da sua moda! 💅",

  // ---- Vendedor: valores usados só nos primeiros instantes, antes de
  // carregar os dados reais do vendedor identificado pelo link ----
  vendedorPadrao: {
    slogan: "O seu Vendedor!",
    foto: "assets/vendedor-foto.jpg",
  },

  // ---- Cores da marca (usadas no cabeçalho e nos botões) ----
  corPrimaria: "#1a1a2e", // fundo do cabeçalho
  corDestaque: "#e91e63", // botão de enviar pedido, destaques
  corDourada: "#d4af37", // borda discreta da foto do vendedor

  // Paleta dos cards de coleção — tons de rosa/magenta/dourado da Impala,
  // alternados entre os cards pra dar variedade sem fugir da marca.
  paletaCards: ["#c2185b", "#e91e63", "#ad1457", "#f06292", "#9c27b0"],

  // ---- Supabase ----
  supabase: {
    url: "https://eubbzefshftafjjcirna.supabase.co",
    anonKey: "sb_publishable_GZ-duizLJSQSVcdYejzWGQ_wdNUu8vA",
    tabela: "impala", // nome da tabela de produtos da Impala no Supabase
    bucketImagens: "produtos-impala", // bucket público com as fotos, nomeadas pelo código
  },
};
