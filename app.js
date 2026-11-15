// ============================================================
// LÓGICA DO CATÁLOGO — versão do site COMPARTILHADO (tela do catálogo com
// abas de coleção + tela do carrinho e WhatsApp) — reconhece o vendedor por
// ?v= ou domínio antigo
// ============================================================

// codigo -> { produto, quantidade }
// "quantidade" aqui é número de UNIDADES (não caixas) — cada clique no +/-
// soma ou tira a "fração" daquele produto (produto.fracao), igual sempre
// funcionou no Impala. O preço usado nas contas é sempre o preco_unitario.
const carrinho = new Map();
let TODOS_PRODUTOS = [];
let PRODUTOS_POR_COLECAO = new Map(); // colecao -> [produtos] (na ordem da planilha)
let VENDEDOR_ATUAL = null; // { nome, whatsapp, foto_url, area, ... } do vendedor resolvido nesse acesso
let SLUG_VENDEDOR_ATUAL = null; // slug usado pra separar o carrinho guardado no celular por vendedor

// ---------- Estado da tela do catálogo (abas) ----------
// Antes eram 2 telas (cards de coleção → grade da coleção); agora é uma tela
// só, com uma aba por coleção no topo — igual ao Nadir. As abas ficam na
// MESMA ORDEM que os cards de coleção já ficavam (ordem da planilha),
// decisão do Leonardo — diferente do Nadir, que usa ordem alfabética.
let COLECOES = []; // nomes das coleções, na ordem da planilha
let ABA_ATIVA = null; // coleção da aba aberta
let BUSCA = ""; // texto da busca já normalizado ("" = sem busca)
let ORDENACAO = "padrao"; // "padrao" (ordem da planilha) | "menor" | "maior" preço
let POSICAO_ROLAGEM = 0; // onde a lista estava ao abrir o carrinho, pra voltar no mesmo ponto

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
  // A barra fixa "Ir para o carrinho" só aparece na tela do catálogo (os
  // botões Buscar/PDF/Imagem já ficam dentro do cabeçalho dela).
  document.getElementById("barra-ir-carrinho").hidden = idTela !== "tela-inicial";
  document.getElementById("menu-ordenar").hidden = true;
  window.scrollTo(0, 0);
}

// ---------- Cabeçalho: parte que é igual pra todo mundo (marca) ----------
function iniciarCabecalhoMarca() {
  document.getElementById("nome-catalogo").textContent = CONFIG.nomeCatalogo;
  document.getElementById("vendedor-slogan").textContent = CONFIG.vendedorPadrao.slogan;
  document.getElementById("vendedor-foto").src = CONFIG.vendedorPadrao.foto;
  document.documentElement.style.setProperty("--cor-primaria", CONFIG.corPrimaria);
  document.documentElement.style.setProperty("--cor-destaque", CONFIG.corDestaque);
  document.documentElement.style.setProperty("--cor-dourada", CONFIG.corDourada);
  document.title = CONFIG.nomeCatalogo;
  // (O slogan da marca e o "Solicitar Catálogo" saíram da tela — mesma
  // decisão tomada no Nadir.)
}

// ---------- Cabeçalho: parte que depende do vendedor identificado ----------
function preencherCabecalhoVendedor(vendedor) {
  document.getElementById("vendedor-nome").textContent = vendedor.nome || "Vendedor";
  if (vendedor.foto_url) {
    document.getElementById("vendedor-foto").src = vendedor.foto_url;
  }
}

// ---------- Tela do catálogo: abas de coleção ----------
function agruparPorColecao(produtos) {
  const mapa = new Map();
  produtos.forEach((p) => {
    if (!mapa.has(p.colecao)) mapa.set(p.colecao, []);
    mapa.get(p.colecao).push(p);
  });
  return mapa;
}

// Uma aba por coleção, na mesma ordem em que os produtos chegam da planilha
// (só coleções que têm produto ativo aparecem, porque a lista vem dos
// próprios produtos carregados). Os produtos DENTRO de cada aba continuam
// na ordem da planilha (coluna "ordem") — essa é a ordem "Padrão" do botão
// de ordenar.
function renderizarAbas() {
  const nav = document.getElementById("categoria-tabs");
  nav.innerHTML = "";
  COLECOES.forEach((colecao) => {
    const aba = document.createElement("button");
    aba.type = "button";
    aba.className = "categoria-tab" + (colecao === ABA_ATIVA ? " ativa" : "");
    aba.textContent = colecao;
    aba.addEventListener("click", () => trocarAba(colecao));
    nav.appendChild(aba);
  });
  centralizarAbaAtiva(nav);
}

// A aba escolhida desliza sempre pro meio da barra, pra dar pra ver as
// abas de trás e as da frente conforme o cliente vai tocando.
function centralizarAbaAtiva(nav) {
  const ativa = nav.querySelector(".categoria-tab.ativa");
  if (!ativa) return;
  const alvo = ativa.offsetLeft - (nav.clientWidth - ativa.clientWidth) / 2;
  nav.scrollTo({ left: Math.max(0, alvo), behavior: "smooth" });
}

function trocarAba(colecao) {
  ABA_ATIVA = colecao;
  if (document.getElementById("barra-busca").classList.contains("aberta")) fecharBusca(false);
  // A ordenação por preço vale só pra aba em que foi escolhida: trocou de
  // aba, volta pro padrão.
  ORDENACAO = "padrao";
  atualizarMenuOrdenar();
  renderizarAbas();
  renderizarLista();
  window.scrollTo(0, 0);
}

// ---------- Busca (lupa) — procura em todas as coleções ----------
// Ignora acento e maiúscula/minúscula; com várias palavras, o produto
// precisa ter todas (em qualquer ordem) na descrição, código ou cód. de barras.
function normalizarBusca(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
}

function produtoBateComBusca(produto) {
  const alvo = normalizarBusca(`${produto.descricao} ${produto.codigo} ${produto.codigo_barras || ""}`);
  return BUSCA.split(/\s+/).every((palavra) => alvo.includes(palavra));
}

function abrirBusca() {
  document.getElementById("barra-busca").classList.add("aberta");
  document.getElementById("btn-busca").classList.add("ativo");
  document.getElementById("campo-busca").focus();
}

function fecharBusca(redesenhar = true) {
  document.getElementById("barra-busca").classList.remove("aberta");
  document.getElementById("btn-busca").classList.remove("ativo");
  document.getElementById("campo-busca").value = "";
  document.getElementById("categoria-tabs").classList.remove("em-busca");
  BUSCA = "";
  if (redesenhar) renderizarLista();
}

// ---------- Ordenar por preço ----------
function atualizarMenuOrdenar() {
  document.getElementById("btn-ordenar").classList.toggle("ativo", ORDENACAO !== "padrao");
  document.querySelectorAll("#menu-ordenar button").forEach((btn) => {
    btn.classList.toggle("selecionada", btn.dataset.ordenacao === ORDENACAO);
  });
}

// ---------- Lista de produtos da aba aberta (ou do resultado da busca) ----------
function produtosVisiveis() {
  const lista = BUSCA
    ? TODOS_PRODUTOS.filter(produtoBateComBusca)
    : [...(PRODUTOS_POR_COLECAO.get(ABA_ATIVA) || [])];
  if (ORDENACAO === "menor") lista.sort((a, b) => Number(a.preco_unitario) - Number(b.preco_unitario));
  else if (ORDENACAO === "maior") lista.sort((a, b) => Number(b.preco_unitario) - Number(a.preco_unitario));
  return lista;
}

function renderizarLista() {
  const produtos = produtosVisiveis();
  const resumo = document.getElementById("busca-resumo");
  if (BUSCA) {
    resumo.hidden = false;
    resumo.textContent = `${produtos.length} ${produtos.length === 1 ? "produto encontrado" : "produtos encontrados"} em todas as coleções`;
  } else {
    resumo.hidden = true;
  }

  if (produtos.length === 0) {
    const grade = document.getElementById("grade-produtos");
    grade.innerHTML = `<p class="sem-itens">${BUSCA ? "Nenhum produto encontrado." : "Nenhum produto disponível no momento."}</p>`;
    return;
  }
  renderizarGradeProdutos(produtos);
}

// ---------- Foto ampliada (toque na foto do produto) ----------
function abrirFotoAmpliada(url) {
  document.getElementById("foto-zoom-img").src = url;
  document.getElementById("foto-zoom-fundo").hidden = false;
}

function fecharFotoAmpliada() {
  document.getElementById("foto-zoom-fundo").hidden = true;
  document.getElementById("foto-zoom-img").removeAttribute("src");
}

// Liga os botões da tela do catálogo (abas, busca, ordenar, carrinho, zoom).
function configurarTelaCatalogo() {
  document.getElementById("btn-busca").addEventListener("click", () => {
    document.getElementById("barra-busca").classList.contains("aberta") ? fecharBusca() : abrirBusca();
  });
  document.getElementById("btn-fechar-busca").addEventListener("click", () => fecharBusca());
  document.getElementById("campo-busca").addEventListener("input", (e) => {
    BUSCA = normalizarBusca(e.target.value);
    document.getElementById("categoria-tabs").classList.toggle("em-busca", !!BUSCA);
    renderizarLista();
    window.scrollTo(0, 0);
  });

  const menuOrdenar = document.getElementById("menu-ordenar");
  document.getElementById("btn-ordenar").addEventListener("click", (e) => {
    e.stopPropagation();
    menuOrdenar.hidden = !menuOrdenar.hidden;
  });
  menuOrdenar.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      ORDENACAO = btn.dataset.ordenacao;
      atualizarMenuOrdenar();
      menuOrdenar.hidden = true;
      renderizarLista();
      window.scrollTo(0, 0);
    });
  });
  // Com o menu aberto, tocar fora dele SÓ fecha o menu — o toque não passa
  // pro que estiver embaixo (senão o cliente poderia, sem querer, somar
  // uma unidade num "+" ou abrir uma foto só tentando fechar o menu).
  document.addEventListener("click", (e) => {
    if (!menuOrdenar.hidden && !menuOrdenar.contains(e.target)) {
      menuOrdenar.hidden = true;
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
  atualizarMenuOrdenar();

  document.getElementById("btn-ir-carrinho").addEventListener("click", abrirCarrinho);

  document.getElementById("foto-zoom-fundo").addEventListener("click", (e) => {
    if (e.target.id === "foto-zoom-fundo" || e.target.id === "foto-zoom-fechar") fecharFotoAmpliada();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.getElementById("foto-zoom-fundo").hidden) fecharFotoAmpliada();
  });
}

// ---------- Tela: produtos da aba aberta ----------
function criarCardProduto(produto) {
  const card = document.createElement("article");
  card.className = "produto-card";
  card.dataset.codigo = produto.codigo;

  const quantidadeAtual = carrinho.get(produto.codigo)?.quantidade || 0;
  if (quantidadeAtual > 0) card.classList.add("produto-card-selecionado");

  card.innerHTML = `
    <div class="produto-imagem-wrap" title="Toque pra ampliar a foto">
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
  card.querySelector(".produto-imagem-wrap").addEventListener("click", () => abrirFotoAmpliada(produto.imagem_url));

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
  atualizarBarraCarrinho();
  salvarCarrinhoNoCelular();
  // Ele continuou mexendo no carrinho depois de um envio anterior — esquece
  // aquele envio, pra pergunta "você já enviou?" não aparecer mais por ele.
  limparFlagEnviado();
}

// Barra fixa de baixo: "Ir para o carrinho (N itens)", ou desabilitada
// quando nada foi marcado. N = total de unidades marcadas (mesmo número que
// o antigo contador do botão flutuante mostrava).
function atualizarBarraCarrinho() {
  let total = 0;
  carrinho.forEach((item) => (total += item.quantidade));
  const btn = document.getElementById("btn-ir-carrinho");
  btn.disabled = total === 0;
  btn.textContent = total === 0
    ? "Nenhum item selecionado"
    : `Ir para o carrinho (${total} ${total === 1 ? "item" : "itens"})`;
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
  atualizarBarraCarrinho();
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
  POSICAO_ROLAGEM = window.scrollY;
  renderizarPainelCarrinho();
  mostrarTela("tela-carrinho");
}

function voltarDoCarrinho() {
  // Redesenha a lista pra refletir mudanças de quantidade feitas no
  // carrinho, e volta pro mesmo ponto da lista onde o cliente estava.
  renderizarLista();
  mostrarTela("tela-inicial", "voltar");
  window.scrollTo(0, POSICAO_ROLAGEM);
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
  // Ordem das abas = mesma ordem em que as coleções aparecem nos produtos
  // carregados (ordem da planilha) — igual já era nos cards de coleção.
  COLECOES = [...PRODUTOS_POR_COLECAO.keys()];
  ABA_ATIVA = COLECOES[0] || null;

  // Recupera o carrinho guardado no celular pra ESSE vendedor (se tiver).
  restaurarCarrinhoDoCelular();
  atualizarBarraCarrinho();

  statusMsg.hidden = true;
  configurarTelaCatalogo();
  renderizarLista();

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
  // As abas são desenhadas depois que a tela aparece, pra conseguir medir a
  // largura delas e centralizar a aba ativa.
  renderizarAbas();

  // Se o cliente voltou pra página depois de já ter enviado um pedido (ex:
  // abriu o link de novo direto do WhatsApp), pergunta se já enviou.
  verificarPerguntaReenvio();

  // Tour guiado: tocar na foto do vendedor abre o passo a passo; na 1ª
  // visita naquele celular aparece a dica "Toque na minha foto...".
  iniciarTourGuiado();
}

// ============================================================
// TOUR GUIADO (toque na foto do vendedor)
// ============================================================
// O próprio vendedor "explica" o catálogo: a tela escurece, só o item da vez
// fica aceso, e um balão de fala com a fotinha dele explica pra que serve.
// Pensado pro cliente final (o link é o mesmo pra cliente e vendedor).
// - Abre a qualquer momento tocando na foto do vendedor (tem um "?" no canto).
// - Na 1ª visita naquele celular, aparece só uma dica "Toque na minha foto e
//   eu te mostro como funciona" — ela some no 1º toque e não volta mais.
// O tour não mexe no carrinho nem em nada do catálogo: só mostra e explica.
const CHAVE_DICA_FOTO = "impala-dica-foto-vista";
let TOUR_ATIVO = false;
let TOUR_PASSO = 0;
let TOUR_PASSOS = [];
let DICA_FOTO_ABERTA = false;

function tourLerStorage(chave) { try { return localStorage.getItem(chave); } catch (e) { return null; } }
function tourGravarStorage(chave, valor) { try { localStorage.setItem(chave, valor); } catch (e) { /* modo privado: segue sem guardar */ } }

function primeiroNomeVendedor() {
  const nome = (VENDEDOR_ATUAL && VENDEDOR_ATUAL.nome) || document.getElementById("vendedor-nome").textContent || "";
  return String(nome).trim().split(/\s+/)[0] || "seu vendedor";
}

// Os 7 passos — textos na voz do vendedor (sem "o"/"a" antes do nome, pra
// servir pra vendedor e vendedora). Iguais aos do Nadir, só o passo 5 muda (aqui o + soma a
// quantidade mínima do produto, em unidades) — aprovados em 14/11/2026.
function montarPassosTour() {
  return [
    {
      alvo: () => document.getElementById("vendedor-foto-wrap"), redondo: true,
      texto: () => `Oi! Eu sou <b>${escaparHtml(primeiroNomeVendedor())}</b> e vou te mostrar rapidinho como fazer seu pedido aqui.`,
    },
    {
      alvo: () => document.getElementById("categoria-tabs"),
      texto: () => `Aqui ficam as <b>coleções</b>. Toque numa aba ou arraste pro lado para ver as outras.`,
    },
    {
      alvo: () => document.getElementById("btn-ordenar"), redondo: true,
      texto: () => `Aqui você organiza os produtos por <b>menor</b> ou <b>maior preço</b>.`,
    },
    {
      alvo: () => document.getElementById("btn-busca").closest(".acao-cabecalho"),
      texto: () => `Procurando algo específico? Toque na <b>lupa</b> e busque pelo nome ou pelo código do produto.`,
    },
    {
      alvo: () => document.querySelector("#grade-produtos .produto-card"),
      texto: () => `Toque no <b>+</b> para adicionar. Cada toque soma a <b>quantidade mínima</b> do produto (por exemplo, 6 unidades), e o número mostra o <b>total de unidades</b>. Toque na foto para ver o produto maior.`,
    },
    {
      alvo: () => document.getElementById("btn-ir-carrinho"), botaoCarrinho: true,
      texto: () => `Aqui embaixo você acompanha quantos itens já escolheu. Sua seleção fica <b>guardada</b>, mesmo se você fechar a página.`,
    },
    {
      alvo: () => document.getElementById("btn-ir-carrinho"), botaoCarrinho: true,
      texto: () => `Quando terminar, toque aqui para ver seu <b>carrinho</b> e me enviar o pedido.`,
    },
  ];
}

function escaparHtml(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Dica de 1ª visita ----------
function posicionarDicaFoto() {
  const dica = document.getElementById("dica-foto");
  const r = document.getElementById("vendedor-foto-wrap").getBoundingClientRect();
  const left = Math.max(10, r.left - 4);
  dica.style.left = left + "px";
  dica.style.top = (r.bottom + 12) + "px";
  dica.style.setProperty("--seta-x", (r.left + r.width / 2 - left) + "px");
}

function mostrarDicaFoto() {
  // Não atrapalha se já tem outra coisa na frente (tour, pergunta, foto ampliada)
  if (TOUR_ATIVO || document.getElementById("tela-inicial").hidden) return;
  if (!document.getElementById("modal-reenvio").hidden || !document.getElementById("foto-zoom-fundo").hidden) return;
  posicionarDicaFoto();
  document.getElementById("dica-foto").classList.add("visivel");
  document.getElementById("vendedor-foto-wrap").classList.add("pulsando");
  DICA_FOTO_ABERTA = true;
}

function esconderDicaFoto() {
  if (!DICA_FOTO_ABERTA) return;
  DICA_FOTO_ABERTA = false;
  document.getElementById("dica-foto").classList.remove("visivel");
  document.getElementById("vendedor-foto-wrap").classList.remove("pulsando");
  tourGravarStorage(CHAVE_DICA_FOTO, "1");
}

// ---------- Tour ----------
// Mini tour da tela do carrinho (foto do vendedor ao lado do "Enviar").
// Decisões do Leonardo em 14/11/2026: 5 passos, sem dica de 1ª visita aqui
// (o "?" na foto basta, porque o cliente já aprendeu na tela principal).
function montarPassosTourCarrinho() {
  return [
    {
      alvo: () => document.querySelector("#lista-carrinho .carrinho-item .qtd-seletor"),
      texto: () => `Aqui você ajusta as <b>quantidades</b>. Se tirar tudo no <b>−</b>, o item sai do pedido.`,
    },
    {
      alvo: () => document.getElementById("btn-limpar-carrinho"),
      texto: () => `Quer recomeçar? Aqui você <b>apaga tudo</b> de uma vez.`,
    },
    {
      alvo: () => document.querySelector("#tela-carrinho .carrinho-loja"),
      texto: () => `Tem mais de uma loja? Escreva aqui <b>para qual loja</b> é o pedido.`,
    },
    {
      alvo: () => document.getElementById("btn-pdf-pedido"),
      texto: () => `Aqui você baixa seu pedido em <b>PDF</b>, se preferir.`,
    },
    {
      alvo: () => document.getElementById("btn-enviar-pedido"),
      texto: () => `Tudo certo? Toque aqui e seu pedido chega direto no meu <b>WhatsApp</b>.`,
    },
  ];
}

function iniciarTour() {
  esconderDicaFoto();
  if (TOUR_ATIVO) return;
  // Deixa a tela "limpa" antes de começar: sem busca, sem menu, lá no topo
  if (BUSCA || document.getElementById("barra-busca").classList.contains("aberta")) fecharBusca();
  document.getElementById("menu-ordenar").hidden = true;
  window.scrollTo(0, 0);
  abrirTour(montarPassosTour());
}

function iniciarTourCarrinho() {
  if (TOUR_ATIVO) return;
  window.scrollTo(0, 0);
  abrirTour(montarPassosTourCarrinho());
}

function abrirTour(passos) {
  // Pula passos cujo item não existe na tela (ex: coleção sem produto,
  // carrinho vazio)
  TOUR_PASSOS = passos.filter((p) => {
    const alvo = p.alvo();
    return Array.isArray(alvo) ? alvo.length > 0 : !!alvo;
  });
  if (TOUR_PASSOS.length === 0) return;

  TOUR_ATIVO = true;
  TOUR_PASSO = 0;
  document.getElementById("tour-nome").textContent = primeiroNomeVendedor();
  document.getElementById("tour-mini-foto").src = document.getElementById("vendedor-foto").src;
  document.getElementById("tour-bloqueio").hidden = false;
  document.getElementById("tour-destaque").hidden = false;
  document.getElementById("tour-balao").hidden = false;
  mostrarPassoTour();
}

function encerrarTour() {
  TOUR_ATIVO = false;
  document.getElementById("tour-bloqueio").hidden = true;
  document.getElementById("tour-destaque").hidden = true;
  document.getElementById("tour-balao").hidden = true;
  simularBotaoCarrinho(false);
}

// Nos passos do carrinho, com nada marcado, o botão aparece como
// "Ir para o carrinho" em vez do cinza "Nenhum item selecionado" (decisão
// do Leonardo). Ao sair do passo/tour, volta ao normal.
function simularBotaoCarrinho(ligar) {
  const btn = document.getElementById("btn-ir-carrinho");
  if (ligar && btn.disabled) {
    btn.classList.add("tour-simulado");
    btn.textContent = "Ir para o carrinho";
  } else if (!ligar && btn.classList.contains("tour-simulado")) {
    btn.classList.remove("tour-simulado");
    atualizarBarraCarrinho();
  }
}

function mostrarPassoTour() {
  const passo = TOUR_PASSOS[TOUR_PASSO];
  const ultimo = TOUR_PASSO === TOUR_PASSOS.length - 1;
  simularBotaoCarrinho(!!passo.botaoCarrinho);
  document.getElementById("tour-texto").innerHTML = passo.texto();
  document.getElementById("tour-contador").textContent = `${TOUR_PASSO + 1} de ${TOUR_PASSOS.length}`;
  document.getElementById("tour-proximo").textContent = ultimo ? "Entendi! 👍" : "Próximo →";
  document.getElementById("tour-pular").style.visibility = ultimo ? "hidden" : "visible";
  posicionarPassoTour();
}

function posicionarPassoTour() {
  if (!TOUR_ATIVO) return;
  const passo = TOUR_PASSOS[TOUR_PASSO];
  const el = passo.alvo();
  if (!el) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 6;
  const destaque = document.getElementById("tour-destaque");

  // Passo sem item pra apontar: tela escurecida e balão no meio
  if (passo.centro) {
    destaque.classList.add("sem-anel");
    Object.assign(destaque.style, { left: vw / 2 + "px", top: vh / 2 + "px", width: "0px", height: "0px" });
    const balaoC = document.getElementById("tour-balao");
    const caixaC = document.getElementById("tour-caixa");
    const larguraC = Math.min(360, vw - 24);
    balaoC.style.width = larguraC + "px";
    caixaC.classList.remove("seta-cima", "seta-baixo");
    caixaC.classList.add("sem-seta");
    balaoC.style.left = (vw - larguraC) / 2 + "px";
    balaoC.style.top = Math.max(10, (vh - balaoC.offsetHeight) / 2) + "px";
    return;
  }
  destaque.classList.remove("sem-anel");
  document.getElementById("tour-caixa").classList.remove("sem-seta");

  // O alvo pode ser um item só ou uma lista (ex: botões PDF + Imagem juntos)
  let r;
  if (Array.isArray(el)) {
    const rs = el.map((e) => e.getBoundingClientRect());
    const left = Math.min(...rs.map((x) => x.left));
    const top = Math.min(...rs.map((x) => x.top));
    const right = Math.max(...rs.map((x) => x.right));
    const bottom = Math.max(...rs.map((x) => x.bottom));
    r = { left, top, right, bottom, width: right - left, height: bottom - top };
  } else {
    r = el.getBoundingClientRect();
  }

  // Recorte iluminado em volta do item
  let dl, dt, dw, dh;
  if (passo.redondo) {
    const lado = Math.max(r.width, r.height) + pad * 2;
    dl = r.left + r.width / 2 - lado / 2;
    dt = r.top + r.height / 2 - lado / 2;
    dw = dh = lado;
    destaque.style.borderRadius = "50%";
  } else {
    dl = r.left - pad;
    dt = r.top - pad;
    dw = r.width + pad * 2;
    dh = r.height + pad * 2;
    destaque.style.borderRadius = "14px";
  }
  Object.assign(destaque.style, { left: dl + "px", top: dt + "px", width: dw + "px", height: dh + "px" });

  // Balão: embaixo do item se couber, senão em cima
  const balao = document.getElementById("tour-balao");
  const caixa = document.getElementById("tour-caixa");
  const largura = Math.min(360, vw - 24);
  const recuoCaixa = 46 + 8; // fotinha + espaço até o balão de fala
  balao.style.width = largura + "px";
  const altura = balao.offsetHeight;
  const espacoAbaixo = vh - (dt + dh);
  let top;
  caixa.classList.remove("seta-cima", "seta-baixo");
  if (espacoAbaixo > altura + 24) {
    top = dt + dh + 14;
    caixa.classList.add("seta-cima");
  } else {
    top = Math.max(10, dt - altura - 14);
    caixa.classList.add("seta-baixo");
  }
  const centroX = dl + dw / 2;
  const larguraCaixa = largura - recuoCaixa;
  const left = Math.min(Math.max(12, centroX - recuoCaixa - larguraCaixa / 2), vw - largura - 12);
  balao.style.left = left + "px";
  balao.style.top = top + "px";
  caixa.style.setProperty("--seta-x", Math.min(Math.max(18, centroX - left - recuoCaixa), larguraCaixa - 22) + "px");
}

// Liga tudo — chamado no fim do iniciar(), quando o catálogo já está na tela
function iniciarTourGuiado() {
  const ligarFoto = (el, acao) => {
    el.addEventListener("click", acao);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); acao(); }
    });
  };
  ligarFotoComToqueEscondido(document.getElementById("vendedor-foto-wrap"));
  ligarFoto(document.getElementById("carrinho-foto-wrap"), iniciarTourCarrinho);
  ligarMenuVendedor();
  // A foto do carrinho é a mesma do cabeçalho (já carregada a esta altura)
  document.getElementById("carrinho-foto").src = document.getElementById("vendedor-foto").src;
  document.getElementById("tour-pular").addEventListener("click", encerrarTour);
  document.getElementById("tour-proximo").addEventListener("click", () => {
    if (TOUR_PASSO >= TOUR_PASSOS.length - 1) { encerrarTour(); return; }
    TOUR_PASSO++;
    mostrarPassoTour();
  });
  window.addEventListener("resize", () => {
    posicionarPassoTour();
    if (DICA_FOTO_ABERTA) posicionarDicaFoto();
  });
  // Qualquer toque na tela já some com a dica de 1ª visita
  document.addEventListener("pointerdown", esconderDicaFoto, true);

  if (!tourLerStorage(CHAVE_DICA_FOTO)) setTimeout(mostrarDicaFoto, 900);
}


// ============================================================
// MENU DO VENDEDOR (toque escondido) + TUTORIAL DO VENDEDOR
// ============================================================
// Ideia do Leonardo (14/11/2026): o link é o mesmo pra cliente e vendedor,
// então o "modo vendedor" abre por um toque escondido: SEGURAR a foto do
// vendedor por 3 segundos (um anel dourado vai enchendo). Abre um menu com
// "Copiar meu link" (o vendedor não perde mais o próprio link) e
// "Tutorial do vendedor". Toque rápido na foto continua abrindo o tour do
// cliente. Soltou antes dos 3s (depois de um toque longo)? Não acontece nada.
const TEMPO_SEGURAR_MS = 3000;
const TOQUE_RAPIDO_MS = 600;

function ligarFotoComToqueEscondido(foto) {
  let timer = null;
  let inicio = 0;
  let abriuMenu = false;
  let xIni = 0;
  let yIni = 0;

  const cancelar = () => {
    clearTimeout(timer);
    timer = null;
    foto.classList.remove("segurando");
  };

  foto.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    abriuMenu = false;
    inicio = Date.now();
    xIni = e.clientX;
    yIni = e.clientY;
    foto.classList.add("segurando");
    timer = setTimeout(() => {
      timer = null;
      abriuMenu = true;
      foto.classList.remove("segurando");
      try { if (navigator.vibrate) navigator.vibrate(40); } catch (erro) { /* sem vibração */ }
      abrirMenuVendedor();
    }, TEMPO_SEGURAR_MS);
  });

  // Arrastou o dedo (rolando a tela)? Cancela.
  foto.addEventListener("pointermove", (e) => {
    if (timer && Math.hypot(e.clientX - xIni, e.clientY - yIni) > 12) cancelar();
  });

  foto.addEventListener("pointerup", () => {
    const foiRapido = timer && Date.now() - inicio < TOQUE_RAPIDO_MS;
    cancelar();
    if (foiRapido && !abriuMenu) iniciarTour();
  });
  foto.addEventListener("pointercancel", cancelar);
  foto.addEventListener("pointerleave", () => { if (timer) cancelar(); });

  // Segurar a foto não pode abrir o menu do navegador ("Salvar imagem" etc)
  foto.addEventListener("contextmenu", (e) => e.preventDefault());

  // Teclado: Enter/espaço abre o tour do cliente
  foto.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); iniciarTour(); }
  });
}

function posicionarMenuVendedor() {
  const menu = document.getElementById("menu-vendedor");
  const r = document.getElementById("vendedor-foto-wrap").getBoundingClientRect();
  const largura = menu.offsetWidth || 230;
  const left = Math.min(Math.max(10, r.left - 4), window.innerWidth - largura - 10);
  menu.style.left = left + "px";
  menu.style.top = (r.bottom + 14) + "px";
  menu.style.setProperty("--seta-x", (r.left + r.width / 2 - left) + "px");
}

function abrirMenuVendedor() {
  esconderDicaFoto();
  if (TOUR_ATIVO) return;
  window.scrollTo(0, 0);
  document.getElementById("menu-vendedor-fundo").hidden = false;
  document.getElementById("menu-vendedor").hidden = false;
  posicionarMenuVendedor();
}

function fecharMenuVendedor() {
  document.getElementById("menu-vendedor-fundo").hidden = true;
  document.getElementById("menu-vendedor").hidden = true;
}

let TIMER_AVISO_VENDEDOR = null;
function mostrarAvisoVendedor(texto, ms = 2600) {
  const aviso = document.getElementById("aviso-vendedor");
  aviso.textContent = texto;
  aviso.classList.add("mostrar");
  clearTimeout(TIMER_AVISO_VENDEDOR);
  TIMER_AVISO_VENDEDOR = setTimeout(() => aviso.classList.remove("mostrar"), ms);
}

// O link copiado é o MESMO link que o cliente usa (o link normal do
// vendedor, com o ?v= dele) — não existe link especial de vendedor.
function linkDoVendedor() {
  return window.location.href.split("#")[0];
}

async function copiarLinkDoVendedor() {
  const link = linkDoVendedor();
  let copiou = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(link);
      copiou = true;
    }
  } catch (erro) { /* tenta o jeito antigo abaixo */ }
  if (!copiou) {
    try {
      const campo = document.createElement("textarea");
      campo.value = link;
      campo.setAttribute("readonly", "");
      campo.style.position = "fixed";
      campo.style.opacity = "0";
      document.body.appendChild(campo);
      campo.select();
      copiou = document.execCommand("copy");
      campo.remove();
    } catch (erro) { copiou = false; }
  }
  fecharMenuVendedor();
  if (copiou) {
    mostrarAvisoVendedor("Link copiado! Agora é só colar no WhatsApp.");
  } else {
    // Celular não deixou copiar sozinho: mostra o link pra copiar à mão
    mostrarAvisoVendedor("Seu link: " + link, 8000);
  }
}

function eIphone() {
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

// Os 6 passos do tutorial do vendedor — mesmos textos nos 5 catálogos
// (aprovados pelo Leonardo em 14/11/2026).
function montarPassosTourVendedor() {
  const salvarTela = eIphone()
    ? `No <b>Safari</b>, toque em <b>Compartilhar</b> (o quadradinho com a setinha ↑) e escolha <b>Adicionar à Tela de Início</b>. Assim seu catálogo fica no celular, com o ícone dele, e você nunca perde seu link!`
    : `No navegador, toque nos <b>3 pontinhos ⋮</b> lá em cima e escolha <b>Adicionar à tela inicial</b> (ou <b>Instalar app</b>). Assim seu catálogo fica no celular, com o ícone dele, e você nunca perde seu link!`;
  return [
    {
      alvo: () => document.getElementById("vendedor-foto-wrap"), redondo: true,
      texto: () => `Oi, <b>${escaparHtml(primeiroNomeVendedor())}</b>! Este é o seu <b>modo vendedor</b>, com dicas só pra você. Seus clientes não veem isso.`,
    },
    {
      alvo: () => [document.getElementById("btn-exportar-pdf-ofertas"), document.getElementById("btn-exportar-imagem-ofertas")]
        .map((b) => b && b.closest(".acao-cabecalho")).filter(Boolean),
      texto: () => `Escolha os produtos que quer oferecer e toque em <b>PDF</b> ou <b>Imagem</b>. Sai pronto, com a sua foto e os preços, pra mandar aos clientes. A <b>Imagem</b> cabe até <b>16 produtos</b>; no <b>PDF</b> você coloca quantos quiser.`,
    },
    {
      alvo: () => document.getElementById("btn-ir-carrinho"), botaoCarrinho: true,
      texto: () => `Tem cliente que faz o pedido pelo <b>computador</b> e não tem o WhatsApp aberto ali? Oriente ele a usar o botão <b>PDF do pedido</b>, dentro do carrinho: ele baixa o pedido e te manda por onde for mais fácil.`,
    },
    {
      alvo: () => document.getElementById("vendedor-foto-wrap"), redondo: true,
      texto: () => `Sempre que precisar do seu link, <b>segure a sua foto</b> e toque em <b>Copiar meu link</b>. Aí é só colar no WhatsApp.`,
    },
    {
      alvo: () => document.body, centro: true,
      texto: () => salvarTela,
    },
    {
      alvo: () => document.getElementById("vendedor-foto-wrap"), redondo: true,
      texto: () => `Seus clientes aprendem a usar o catálogo <b>tocando na sua foto</b>. Avise eles!`,
    },
  ];
}

function iniciarTourVendedor() {
  fecharMenuVendedor();
  if (TOUR_ATIVO) return;
  if (BUSCA || document.getElementById("barra-busca").classList.contains("aberta")) fecharBusca();
  window.scrollTo(0, 0);
  abrirTour(montarPassosTourVendedor());
}

function ligarMenuVendedor() {
  document.getElementById("btn-copiar-link").addEventListener("click", copiarLinkDoVendedor);
  document.getElementById("btn-tour-vendedor").addEventListener("click", iniciarTourVendedor);
  document.getElementById("btn-fechar-menu-vendedor").addEventListener("click", fecharMenuVendedor);
  document.getElementById("menu-vendedor-fundo").addEventListener("click", fecharMenuVendedor);
  window.addEventListener("resize", () => {
    if (!document.getElementById("menu-vendedor").hidden) posicionarMenuVendedor();
  });
}

document.addEventListener("DOMContentLoaded", iniciar);
