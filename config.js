// ============================================================
// CONFIGURAÇÃO DO CATÁLOGO — edite este arquivo para personalizar
// ============================================================
// Este é o ÚNICO arquivo que muda de um vendedor para outro.
// Para criar o catálogo de outro vendedor, copie a pasta inteira
// e troque só os valores aqui embaixo.
// (a exceção é o arquivo plataforma.js, que NÃO muda entre vendedores)

const CONFIG = {
  // ---- Identificador único deste catálogo (marca + vendedor) ----
  // Usado pra checar na tabela "vendedores" se este catálogo está ativo
  // (assinatura em dia) ou pausado. Cada vendedor de cada marca tem o seu.
  vendedorId: "impala-leonardo",

  // ---- Marca / catálogo ----
  marca: "Impala",
  nomeCatalogo: "Loja Impala",
  sloganMarca: "💅 Impala, a cor da sua moda! 💅",

  // ---- Dados do vendedor (aparecem no cabeçalho e no link do WhatsApp) ----
  vendedor: {
    nome: "Leonardo Nantes",
    slogan: "O seu Vendedor!",
    foto: "assets/vendedor-foto.jpg",
    // Número de WhatsApp no formato internacional, só números (DDI 55 + DDD + número)
    whatsapp: "5547997375295",
  },

  // ---- Cores da marca (usadas no cabeçalho e nos botões) ----
  corPrimaria: "#1a1a2e", // fundo do cabeçalho
  corDestaque: "#e91e63", // botão de enviar pedido, destaques
  corDourada: "#d4af37", // borda discreta da foto do vendedor

  // Paleta dos cards de coleção — tons de rosa/magenta/dourado da Impala,
  // alternados entre os cards pra dar variedade sem fugir da marca.
  paletaCards: ["#c2185b", "#e91e63", "#ad1457", "#f06292", "#9c27b0"],

  // ---- Supabase ----
  // Deixe em branco ("") enquanto o Supabase não estiver configurado.
  // O app funciona com produtos de exemplo (mock) até essas credenciais
  // serem preenchidas — assim dá pra testar o catálogo sem depender do banco.
  supabase: {
    url: "https://eubbzefshftafjjcirna.supabase.co",
    anonKey: "sb_publishable_GZ-duizLJSQSVcdYejzWGQ_wdNUu8vA",
    tabela: "impala", // nome da tabela de produtos da Impala no Supabase
    bucketImagens: "produtos-impala", // bucket público com as fotos, nomeadas pelo código
  },
};
