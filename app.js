// ============================================================
// LÓGICA DO CATÁLOGO — versão do site COMPARTILHADO (3 telas, coleções,
// carrinho e WhatsApp) — reconhece o vendedor por ?v= ou domínio antigo
// ============================================================

const carrinho = new Map(); // codigo -> { produto, quantidade }
let TODOS_PRODUTOS = [];
let PRODUTOS_POR_COLECAO = new Map(); // colecao -> [produtos]
let COLECAO_ATUAL = null; // colecao sendo exibida na tela 2
let VENDEDOR_ATUAL = null; // { nome, whatsapp, foto_url, area, ... } do vendedor resolvido nesse acesso
let SLUG_VENDEDOR_ATUAL = null; // slug usado pra separar o carrinho guardado no celular por vendedor

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
  // O carrinho flutuante aparece nas telas 1 e 2; os botões de PDF/Imagem
  // das ofertas aparecem só na tela inicial
  const btnCarrinho = document.getElementById("btn-carrinho");
  const acoesExportar = document.querySelector(".acoes-exportar");
  const telasSemCarrinho = ["tela-carrinho", "tela-pausado", "tela-nao-encontrado"];
  btnCarrinho.hidden = telasSemCarrinho.includes(idTela);
  acoesExportar.hidden = idTela !== "tela-inicial";
  window.scrollTo(0, 0);
}

// ---------- Cabeçalho: parte que é igual pra todo mundo (marca) ----------
function iniciarCabecalhoMarca() {
  document.getElementById("nome-catalogo").textContent = CONFIG.nomeCatalogo;
  document.getElementById("vendedor-slogan").textContent = CONFIG.vendedorPadrao.slogan;
  document.getElementById("vendedor-foto").src = CONFIG.vendedorPadrao.foto;
  document.getElementById("slogan-marca").textContent = CONFIG.sloganMarca;
  document.documentElement.style.setProperty("--cor-primaria", CONFIG.corPrimaria);
  document.documentElement.style.setProperty("--cor-destaque", CONFIG.corDestaque);
  document.documentElement.style.setProperty("--cor-dourada", CONFIG.corDourada);
  document.title = CONFIG.nomeCatalogo;

  const btnSolicitar = document.getElementById("btn-solicitar-catalogo");
  const texto = encodeURIComponent(PLATAFORMA.mensagemPadrao);
  btnSolicitar.href = `https://wa.me/${PLATAFORMA.whatsapp}?text=${texto}`;
}

// ---------- Cabeçalho: parte que depende do vendedor identificado ----------
function preencherCabecalhoVendedor(vendedor) {
  document.getElementById("vendedor-nome").textContent = vendedor.nome || "Vendedor";
  if (vendedor.foto_url) {
    document.getElementById("vendedor-foto").src = vendedor.foto_url;
  }
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

  if (qtdValorEl) qtdValorEl.textContent = nova;
  atualizarContadorCarrinho();
  salvarCarrinhoNoCelular();
  // Ele continuou mexendo no carrinho depois de um envio anterior — esquece
  // aquele envio, pra pergunta "você já enviou?" não aparecer mais por ele.
  limparFlagEnviado();
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
  executarLimpezaCarrinho();
}

// ---------- Carrinho guardado no celular (localStorage) ----------
// Guardamos só código do produto + quantidade, separado por vendedor (pela
// "slug" do link), pra sobreviver a um F5/atualização de página ou o
// cliente saindo pra atender uma ligação e voltando depois. O preço nunca
// é guardado — ele sempre vem de novo da lista de produtos carregada na
// hora, então nunca fica desatualizado. Se o navegador estiver em modo
// privado ou sem espaço, qualquer leitura/escrita aqui falha em silêncio e
// o catálogo continua funcionando normal, só sem guardar nada.
function chaveStorageCarrinho() {
  return `impala_carrinho_v1_${SLUG_VENDEDOR_ATUAL || "sem-vendedor"}`;
}

function chaveStorageEnviado() {
  return `impala_carrinho_enviado_v1_${SLUG_VENDEDOR_ATUAL || "sem-vendedor"}`;
}

function salvarCarrinhoNoCelular() {
  try {
    const itens = [...carrinho.values()].map(({ produto, quantidade }) => ({
      codigo: produto.codigo,
      quantidade,
    }));
    localStorage.setItem(chaveStorageCarrinho(), JSON.stringify(itens));
  } catch (erro) {
    // Modo privado, sem espaço, etc. — ignora e segue só na memória.
  }
}

// Lê o carrinho salvo e recoloca os itens, buscando cada produto de novo em
// TODOS_PRODUTOS (já carregado com o preço/estoque de hoje). Um código
// salvo que não existe mais na lista atual (produto saiu do catálogo) é
// simplesmente ignorado — some do carrinho sozinho.
function restaurarCarrinhoDoCelular() {
  try {
    const salvo = localStorage.getItem(chaveStorageCarrinho());
    if (!salvo) return;
    const itens = JSON.parse(salvo);
    if (!Array.isArray(itens)) return;

    const mapaProdutos = new Map(TODOS_PRODUTOS.map((p) => [p.codigo, p]));
    itens.forEach(({ codigo, quantidade }) => {
      const produto = mapaProdutos.get(codigo);
      if (produto && quantidade > 0) {
        carrinho.set(codigo, { produto, quantidade });
      }
    });
  } catch (erro) {
    // Ignora e segue com o carrinho vazio, igual a um cliente novo.
  }
}

function marcarPedidoEnviado() {
  try {
    localStorage.setItem(chaveStorageEnviado(), String(Date.now()));
  } catch (erro) {
    // Sem espaço/modo privado — a pergunta pós-envio simplesmente não vai
    // aparecer depois; não afeta o envio em si.
  }
}

function limparFlagEnviado() {
  try {
    localStorage.removeItem(chaveStorageEnviado());
  } catch (erro) {
    // nada a fazer
  }
}

// Usada tanto pela lixeira (depois do confirm() nativo que já existia)
// quanto pelo "Sim, limpar" da caixinha pós-envio — limpa carrinho, tela e
// o que está guardado no celular, tudo junto.
function executarLimpezaCarrinho() {
  carrinho.clear();
  atualizarContadorCarrinho();
  renderizarPainelCarrinho();
  salvarCarrinhoNoCelular();
  limparFlagEnviado();
}

// Checa se faz sentido perguntar "você já enviou esses itens?" — só
// pergunta se: tem um envio registrado, já passaram pelo menos 4s dele (pra
// não disparar à toa se a tela "piscar" logo depois do clique de enviar) e
// ainda tem itens no carrinho pra perguntar sobre.
function verificarPerguntaReenvio() {
  try {
    const enviadoEm = localStorage.getItem(chaveStorageEnviado());
    if (!enviadoEm) return;

    const passados = Date.now() - Number(enviadoEm);
    if (Number.isNaN(passados) || passados < 4000) return;

    if (carrinho.size === 0) {
      limparFlagEnviado();
      return;
    }

    document.getElementById("modal-reenvio").hidden = false;
  } catch (erro) {
    // Sem localStorage disponível — não tem o que perguntar.
  }
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
  const whatsappVendedor = VENDEDOR_ATUAL?.whatsapp;
  if (!whatsappVendedor) {
    alert("Não conseguimos identificar o WhatsApp deste vendedor. Recarregue a página e tente novamente.");
    return;
  }
  const texto = encodeURIComponent(montarTextoPedido());
  const url = `https://wa.me/${whatsappVendedor}?text=${texto}`;
  window.open(url, "_blank");
  marcarPedidoEnviado();
}

// ---------- Tela de pausado (assinatura em atraso) ----------
function configurarBotaoPausado() {
  const btn = document.getElementById("btn-pausado-whatsapp");
  const texto = encodeURIComponent(
    `Olá! Meu catálogo (${CONFIG.nomeCatalogo}) está pausado, gostaria de regularizar o acesso.`
  );
  btn.href = `https://wa.me/${PLATAFORMA.whatsapp}?text=${texto}`;
}

// ---------- Tela de "catálogo não encontrado" (link inválido/desconhecido) ----------
function configurarBotaoNaoEncontrado() {
  const btn = document.getElementById("btn-nao-encontrado-whatsapp");
  const texto = encodeURIComponent(
    `Olá! Abri um link de catálogo Impala (${window.location.href}) e apareceu "não encontrado". Pode me ajudar?`
  );
  btn.href = `https://wa.me/${PLATAFORMA.whatsapp}?text=${texto}`;
}

// ---------- Boot ----------
async function iniciar() {
  iniciarCabecalhoMarca();

  const carregando = document.getElementById("carregando-app");

  // 1) Descobre QUEM é o vendedor (via ?v= ou domínio antigo)
  const vendedorId = await resolverVendedorId();
  SLUG_VENDEDOR_ATUAL = vendedorId;
  if (!vendedorId) {
    carregando.hidden = true;
    configurarBotaoNaoEncontrado();
    mostrarTela("tela-nao-encontrado");
    return;
  }
  registrarAcesso(vendedorId);

  // 2) Busca os dados desse vendedor no Supabase
  const statusVendedor = await buscarStatusVendedor(vendedorId);
  if (!statusVendedor.encontrado) {
    carregando.hidden = true;
    configurarBotaoNaoEncontrado();
    mostrarTela("tela-nao-encontrado");
    return;
  }

  VENDEDOR_ATUAL = statusVendedor;
  preencherCabecalhoVendedor(statusVendedor);

  if (!statusVendedor.ativo) {
    carregando.hidden = true;
    configurarBotaoPausado();
    mostrarTela("tela-pausado");
    return;
  }

  const statusMsg = document.getElementById("status-msg");
  statusMsg.hidden = false;
  statusMsg.innerHTML = `<span class="spinner"></span> Carregando coleções...`;

  TODOS_PRODUTOS = await buscarProdutos(statusVendedor.area);
  PRODUTOS_POR_COLECAO = agruparPorColecao(TODOS_PRODUTOS);

  // Recupera o carrinho guardado no celular desse vendedor, se tiver.
  restaurarCarrinhoDoCelular();
  atualizarContadorCarrinho();

  statusMsg.hidden = true;
  renderizarCardsColecao();

  document.getElementById("btn-carrinho").addEventListener("click", abrirCarrinho);
  document.getElementById("btn-voltar-colecao").addEventListener("click", () => mostrarTela("tela-inicial", "voltar"));
  document.getElementById("btn-voltar-carrinho").addEventListener("click", voltarDoCarrinho);
  document.getElementById("btn-enviar-pedido").addEventListener("click", enviarPedidoWhatsapp);
  document.getElementById("btn-limpar-carrinho").addEventListener("click", limparCarrinho);

  // Caixinha "você já enviou esses itens?" — some depois de respondida.
  document.getElementById("btn-reenvio-limpar").addEventListener("click", () => {
    executarLimpezaCarrinho();
    document.getElementById("modal-reenvio").hidden = true;
  });
  document.getElementById("btn-reenvio-manter").addEventListener("click", () => {
    limparFlagEnviado();
    document.getElementById("modal-reenvio").hidden = true;
  });
  // Cobre tanto quando o navegador recarrega a página (ex: Android, depois
  // de voltar do WhatsApp) quanto quando ele só troca de aba/app e volta
  // sem recarregar nada (ex: iPhone) — nos dois casos checa se é hora de
  // perguntar.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") verificarPerguntaReenvio();
  });

  carregando.hidden = true;
  mostrarTela("tela-inicial");
  verificarPerguntaReenvio();
}

document.addEventListener("DOMContentLoaded", iniciar);
