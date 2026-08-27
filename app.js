// ============================================================
// LÓGICA DO CATÁLOGO — 3 telas, coleções, carrinho e WhatsApp
// ============================================================

const carrinho = new Map(); // codigo -> { produto, quantidade }
let TODOS_PRODUTOS = [];
let PRODUTOS_POR_COLECAO = new Map(); // colecao -> [produtos]
let COLECAO_ATUAL = null; // colecao sendo exibida na tela 2

// ---------- Formatação ----------
function formatarPreco(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ---------- Navegação entre telas ----------
function mostrarTela(idTela, direcao = "frente") {
  document.querySelectorAll(".tela").forEach((tela) => {
    const éAlvo = tela.id === idTela;
    tela.hidden = !éAlvo;
    tela.classList.remove("tela-anim-frente", "tela-anim-voltar");
    if (éAlvo) {
      void tela.offsetWidth; // força reflow pra reiniciar a animação
      tela.classList.add(direcao === "voltar" ? "tela-anim-voltar" : "tela-anim-frente");
    }
  });
  // O botão flutuante do carrinho só aparece nas telas 1 e 2
  const btnCarrinho = document.getElementById("btn-carrinho");
  btnCarrinho.hidden = idTela === "tela-carrinho" || idTela === "tela-pausado";
  window.scrollTo(0, 0);
}

// ---------- Cabeçalho e blocos fixos da tela inicial ----------
function iniciarCabecalho() {
  document.getElementById("nome-catalogo").textContent = CONFIG.nomeCatalogo;
  document.getElementById("vendedor-nome").textContent = CONFIG.vendedor.nome;
  document.getElementById("vendedor-slogan").textContent = CONFIG.vendedor.slogan;
  document.getElementById("vendedor-foto").src = CONFIG.vendedor.foto;
  document.getElementById("slogan-marca").textContent = CONFIG.sloganMarca;
  document.documentElement.style.setProperty("--cor-primaria", CONFIG.corPrimaria);
  document.documentElement.style.setProperty("--cor-destaque", CONFIG.corDestaque);
  document.documentElement.style.setProperty("--cor-dourada", CONFIG.corDourada);
  document.title = CONFIG.nomeCatalogo;

  const btnSolicitar = document.getElementById("btn-solicitar-catalogo");
  const texto = encodeURIComponent(PLATAFORMA.mensagemPadrao);
  btnSolicitar.href = `https://wa.me/${PLATAFORMA.whatsapp}?text=${texto}`;
}

// ---------- Tela 1: cards de coleção ----------
function agruparPorColecao(produtos) {
  const mapa = new Map();
  produtos.forEach((p) => {
    if (!mapa.has(p.colecao)) mapa.set(p.colecao, []);
    mapa.get(p.colecao).push(p);
  });
  return mapa;
}

function renderizarCardsColecao() {
  const grade = document.getElementById("grade-colecoes");
  grade.innerHTML = "";
  const paleta = CONFIG.paletaCards;
  let i = 0;

  for (const [colecao, produtos] of PRODUTOS_POR_COLECAO) {
    const cor = paleta[i % paleta.length];
    i++;

    const card = document.createElement("button");
    card.className = "colecao-card";
    card.style.setProperty("--cor-card", cor);
    card.innerHTML = `<span class="colecao-card-nome">${colecao}</span>`;
    card.addEventListener("click", () => abrirColecao(colecao));
    grade.appendChild(card);
  }
}

// ---------- Tela 2: produtos da coleção ----------
function abrirColecao(colecao) {
  COLECAO_ATUAL = colecao;
  document.getElementById("titulo-colecao").textContent = colecao;
  renderizarGradeProdutos(PRODUTOS_POR_COLECAO.get(colecao) || []);
  mostrarTela("tela-colecao");
}

function criarCardProduto(produto) {
  const card = document.createElement("article");
  card.className = "produto-card";
  card.dataset.codigo = produto.codigo;

  const quantidadeAtual = carrinho.get(produto.codigo)?.quantidade || 0;
  if (quantidadeAtual > 0) card.classList.add("produto-card-selecionado");

  card.innerHTML = `
    <div class="produto-imagem-wrap">
      <img class="produto-imagem" src="${produto.imagem_url}" alt="${produto.descricao}" loading="lazy" />
    </div>
    <div class="produto-info">
      <h3 class="produto-nome">${produto.descricao}</h3>
      <p class="produto-codigos">Código: ${produto.codigo}${produto.codigo_barras ? ` | Cod.Barra: ${produto.codigo_barras}` : ""}</p>
      <div class="produto-preco-qtd">
        <span class="produto-preco">${formatarPreco(Number(produto.preco_unitario))} cada</span>
        <div class="qtd-seletor">
          <button class="qtd-btn qtd-menos" aria-label="Diminuir quantidade">−</button>
          <span class="qtd-valor">${quantidadeAtual}</span>
          <button class="qtd-btn qtd-mais" aria-label="Aumentar quantidade">+</button>
        </div>
      </div>
    </div>
  `;

  const qtdValorEl = card.querySelector(".qtd-valor");
  const sincronizarDestaque = () => {
    const qtd = carrinho.get(produto.codigo)?.quantidade || 0;
    card.classList.toggle("produto-card-selecionado", qtd > 0);
  };
  card.querySelector(".qtd-mais").addEventListener("click", () => {
    alterarQuantidade(produto, produto.fracao, qtdValorEl);
    sincronizarDestaque();
  });
  card.querySelector(".qtd-menos").addEventListener("click", () => {
    alterarQuantidade(produto, -produto.fracao, qtdValorEl);
    sincronizarDestaque();
  });

  return card;
}

function renderizarGradeProdutos(produtos) {
  const grade = document.getElementById("grade-produtos");
  grade.innerHTML = "";
  const fragmento = document.createDocumentFragment();
  produtos.forEach((p) => fragmento.appendChild(criarCardProduto(p)));
  grade.appendChild(fragmento);
}

// ---------- Carrinho ----------
function alterarQuantidade(produto, delta, qtdValorEl) {
  const atual = carrinho.get(produto.codigo)?.quantidade || 0;
  const nova = Math.max(0, atual + delta);

  if (nova === 0) {
    carrinho.delete(produto.codigo);
  } else {
    carrinho.set(produto.codigo, { produto, quantidade: nova });
  }

  qtdValorEl.textContent = nova;
  atualizarContadorCarrinho();
}

function atualizarContadorCarrinho() {
  let total = 0;
  carrinho.forEach((item) => (total += item.quantidade));
  document.getElementById("carrinho-contagem").textContent = total;

  // Pequeno "pulso" no botão flutuante pra dar feedback visual ao adicionar/remover
  const btnCarrinho = document.getElementById("btn-carrinho");
  btnCarrinho.classList.remove("pulso");
  void btnCarrinho.offsetWidth;
  btnCarrinho.classList.add("pulso");
}

function calcularTotalCarrinho() {
  let total = 0;
  carrinho.forEach((item) => (total += item.quantidade * Number(item.produto.preco_unitario)));
  return total;
}

function renderizarPainelCarrinho() {
  const lista = document.getElementById("lista-carrinho");
  lista.innerHTML = "";

  if (carrinho.size === 0) {
    lista.innerHTML = `
      <div class="carrinho-vazio">
        <span class="carrinho-vazio-icone">🛍️</span>
        <p>Seu carrinho está vazio.<br>Escolha uma coleção e adicione seus produtos!</p>
      </div>
    `;
  } else {
    carrinho.forEach(({ produto, quantidade }) => {
      const subtotal = quantidade * Number(produto.preco_unitario);
      const linha = document.createElement("div");
      linha.className = "carrinho-item";
      linha.innerHTML = `
        <div class="carrinho-item-info">
          <p class="carrinho-item-nome">${produto.descricao}</p>
          <p class="carrinho-item-codigo">Cód. ${produto.codigo} · ${produto.colecao}</p>
          <p class="carrinho-item-preco">${quantidade} un. × ${formatarPreco(Number(produto.preco_unitario))} = ${formatarPreco(subtotal)}</p>
        </div>
        <div class="qtd-seletor">
          <button class="qtd-btn qtd-menos" aria-label="Diminuir quantidade">−</button>
          <span class="qtd-valor">${quantidade}</span>
          <button class="qtd-btn qtd-mais" aria-label="Aumentar quantidade">+</button>
        </div>
      `;
      const qtdValorEl = linha.querySelector(".qtd-valor");
      linha.querySelector(".qtd-mais").addEventListener("click", () => {
        alterarQuantidade(produto, produto.fracao, qtdValorEl);
        renderizarPainelCarrinho();
      });
      linha.querySelector(".qtd-menos").addEventListener("click", () => {
        alterarQuantidade(produto, -produto.fracao, qtdValorEl);
        renderizarPainelCarrinho();
      });
      lista.appendChild(linha);
    });
  }

  document.getElementById("carrinho-total-valor").textContent = formatarPreco(calcularTotalCarrinho());
}

function limparCarrinho() {
  if (carrinho.size === 0) return;
  const confirmar = confirm("Excluir todos os itens do carrinho?");
  if (!confirmar) return;
  carrinho.clear();
  atualizarContadorCarrinho();
  renderizarPainelCarrinho();
}

function abrirCarrinho() {
  renderizarPainelCarrinho();
  mostrarTela("tela-carrinho");
}

function voltarDoCarrinho() {
  // Recarrega a grade da coleção pra refletir mudanças de quantidade feitas no carrinho
  if (COLECAO_ATUAL) {
    renderizarGradeProdutos(PRODUTOS_POR_COLECAO.get(COLECAO_ATUAL) || []);
    mostrarTela("tela-colecao", "voltar");
  } else {
    mostrarTela("tela-inicial", "voltar");
  }
}

// ---------- Envio do pedido pelo WhatsApp ----------
// Formato definido pelo Leonardo:
// 📋 Pedido Loja Impala
// Loja: [nome da loja]
//
// • NOME DA COLEÇÃO
// Cód: XXXXXX | Qtd: N | R$XX.XX
//
// TOTAL DO PEDIDO: R$XXXX.XX
function montarTextoPedido() {
  const nomeLoja = document.getElementById("input-loja").value.trim();
  const linhas = [`📋 Pedido ${CONFIG.nomeCatalogo}`, `Loja: ${nomeLoja || "Não informada"}`, ""];

  const porColecao = new Map();
  carrinho.forEach(({ produto, quantidade }) => {
    if (!porColecao.has(produto.colecao)) porColecao.set(produto.colecao, []);
    porColecao.get(produto.colecao).push({ produto, quantidade });
  });

  for (const [colecao, itens] of porColecao) {
    linhas.push(`• ${colecao}`);
    itens.forEach(({ produto, quantidade }) => {
      const subtotal = quantidade * Number(produto.preco_unitario);
      linhas.push(`Cód: ${produto.codigo} | Qtd: ${quantidade} | ${formatarPreco(subtotal)}`);
    });
    linhas.push("");
  }

  linhas.push(`TOTAL DO PEDIDO: ${formatarPreco(calcularTotalCarrinho())}`);
  return linhas.join("\n");
}

function enviarPedidoWhatsapp() {
  if (carrinho.size === 0) {
    alert("Adicione pelo menos um produto antes de enviar o pedido.");
    return;
  }
  const texto = encodeURIComponent(montarTextoPedido());
  const url = `https://wa.me/${CONFIG.vendedor.whatsapp}?text=${texto}`;
  window.open(url, "_blank");
}

// ---------- Tela de pausado (assinatura em atraso) ----------
function configurarBotaoPausado() {
  const btn = document.getElementById("btn-pausado-whatsapp");
  const texto = encodeURIComponent(
    `Olá! Meu catálogo (${CONFIG.nomeCatalogo}) está pausado, gostaria de regularizar o acesso.`
  );
  btn.href = `https://wa.me/${PLATAFORMA.whatsapp}?text=${texto}`;
}

// ---------- Boot ----------
async function iniciar() {
  iniciarCabecalho();

  const carregando = document.getElementById("carregando-app");

  const vendedorAtivo = await verificarVendedorAtivo();
  if (!vendedorAtivo) {
    carregando.hidden = true;
    configurarBotaoPausado();
    mostrarTela("tela-pausado");
    return;
  }

  const statusMsg = document.getElementById("status-msg");
  statusMsg.hidden = false;
  statusMsg.innerHTML = `<span class="spinner"></span> Carregando coleções...`;

  TODOS_PRODUTOS = await buscarProdutos();
  PRODUTOS_POR_COLECAO = agruparPorColecao(TODOS_PRODUTOS);

  statusMsg.hidden = true;
  renderizarCardsColecao();

  document.getElementById("btn-carrinho").addEventListener("click", abrirCarrinho);
  document.getElementById("btn-voltar-colecao").addEventListener("click", () => mostrarTela("tela-inicial", "voltar"));
  document.getElementById("btn-voltar-carrinho").addEventListener("click", voltarDoCarrinho);
  document.getElementById("btn-enviar-pedido").addEventListener("click", enviarPedidoWhatsapp);
  document.getElementById("btn-limpar-carrinho").addEventListener("click", limparCarrinho);

  carregando.hidden = true;
  mostrarTela("tela-inicial");
}

document.addEventListener("DOMContentLoaded", iniciar);
