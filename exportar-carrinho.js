// ============================================================
// GERAR PDF / IMAGEM DO CARRINHO — tela inicial do Impala
// ============================================================
// Mesma lógica/visual já usada e aprovada no "Ofertas da Semana" (molde de
// fundo A4 + grade de cartões desenhada por cima), adaptada aqui pra
// exportar os itens que o cliente já colocou no carrinho, em vez da lista
// de "interesse" das ofertas. Cartão com foto cortada em quadrado (sem
// esticar), nome em itálico/negrito, etiqueta de preço ancorada no rodapé
// do cartão. Cor da etiqueta adaptada pro tom do Impala (antes era preta).
//
// Novidade em relação ao Ofertas da Semana: o cabeçalho do molde já traz a
// foto + nome do vendedor desenhados do lado esquerdo da logo, discretos,
// igual combinado com o Leonardo — esse é o padrão pensado pra valer
// também nos outros apps (Havaianas, Nadir), só o template visual muda.

const EXPORT_TEMPLATE_CAMINHO = "template-impala.jpg";
const EXPORT_TEMPLATE_LARGURA = 1414;
const EXPORT_TEMPLATE_ALTURA = 2000;
// Área em branco da imagem-modelo onde a grade de cartões pode ser
// desenhada sem cobrir a moldura (medida direto no arquivo do Leonardo).
// Atualizado pro molde novo, com o cabeçalho mais enxuto (logo termina
// por volta de y:127, bem antes do y:190 do molde antigo) — é esse
// espaço a mais que abriu lugar pra 4ª fileira de cartões.
const EXPORT_TEMPLATE_AREA = { esq: 40, dir: 1368, topo: 140, base: 1960 };
// Altura reservada no topo pra a foto + nome do vendedor, do lado
// esquerdo da logo "Catálogo Impala" (mesma altura do texto da logo).
const EXPORT_VENDEDOR_FOTO_Y_CENTRO = 80;
const EXPORT_VENDEDOR_FOTO_DIAMETRO = 100;
const EXPORT_VENDEDOR_INDENT = 22;
// A altura de cada cartão da Imagem é calculada a partir do conteúdo
// (foto + nome + código + etiqueta de preço), igual já é feito no PDF —
// em vez de dividir o espaço disponível em 3 fileiras fixas, que deixava
// uma sobra de espaço em branco embaixo de cada cartão. Com isso, o
// número de fileiras (e portanto o limite de itens por imagem) passa a
// ser calculado, não fixo em 12 — ver exportarCalcularGradePng().
const EXPORT_GRADE_PADCARD = 10;
const EXPORT_GRADE_GAP_FOTO_NOME = 20;
const EXPORT_GRADE_GAP_NOME_CODIGO = 16;
const EXPORT_GRADE_GAP_CODIGO_BADGE = 14;
const EXPORT_GRADE_LINHA_ALTURA_NOME = 18;
const EXPORT_GRADE_MAX_LINHAS_NOME = 2;
const EXPORT_GRADE_ALTURA_BADGE = 52;
// A foto do cartão fica um pouco mais baixa que larga (em vez de
// quadrada) — é o "encolher o cartão" que abre espaço pra 4ª fileira
// (16 itens por imagem em vez de 12), sem precisar mexer no tamanho dos
// cartões nem no espaço entre eles.
const EXPORT_GRADE_FATOR_ALTURA_FOTO = 0.93;
// Cor da etiqueta de preço nos cartões — tom roxo/vinho do próprio logo
// do Impala (puxado direto da palavra "Impala" na imagem-modelo), com o
// mesmo brilho dourado suave que já era usado na foto do vendedor no app.
const EXPORT_COR_BADGE = "#5c1f54";
const EXPORT_COR_NOME_VENDEDOR = "#5c1f54";

// ---------- Helpers de desenho (mesmos do Ofertas da Semana) ----------
function exportarDesenharRetanguloArredondado(ctx, x, y, largura, altura, raio) {
  ctx.beginPath();
  ctx.moveTo(x + raio, y);
  ctx.lineTo(x + largura - raio, y);
  ctx.arcTo(x + largura, y, x + largura, y + raio, raio);
  ctx.lineTo(x + largura, y + altura - raio);
  ctx.arcTo(x + largura, y + altura, x + largura - raio, y + altura, raio);
  ctx.lineTo(x + raio, y + altura);
  ctx.arcTo(x, y + altura, x, y + altura - raio, raio);
  ctx.lineTo(x, y + raio);
  ctx.arcTo(x, y, x + raio, y, raio);
  ctx.closePath();
}

function exportarDesenharImagemPreenchendo(ctx, img, x, y, largura, altura) {
  const razaoAlvo = largura / altura;
  const razaoFoto = img.width / img.height;
  let sx = 0, sy = 0, sLargura = img.width, sAltura = img.height;
  if (razaoFoto > razaoAlvo) {
    sLargura = img.height * razaoAlvo;
    sx = (img.width - sLargura) / 2;
  } else {
    sAltura = img.width / razaoAlvo;
    sy = (img.height - sAltura) / 2;
  }
  ctx.drawImage(img, sx, sy, sLargura, sAltura, x, y, largura, altura);
}

function exportarQuebrarTextoCanvas(ctx, texto, larguraMax, maxLinhas) {
  const palavras = String(texto || "").split(/\s+/).filter(Boolean);
  const linhas = [];
  let linhaAtual = "";
  palavras.forEach((palavra) => {
    const tentativa = linhaAtual ? `${linhaAtual} ${palavra}` : palavra;
    if (ctx.measureText(tentativa).width > larguraMax && linhaAtual) {
      linhas.push(linhaAtual);
      linhaAtual = palavra;
    } else {
      linhaAtual = tentativa;
    }
  });
  if (linhaAtual) linhas.push(linhaAtual);
  if (linhas.length === 0) return [""];
  if (linhas.length > maxLinhas) {
    const cortadas = linhas.slice(0, maxLinhas);
    let ultima = cortadas[maxLinhas - 1];
    while (ctx.measureText(ultima + "…").width > larguraMax && ultima.length > 1) {
      ultima = ultima.slice(0, -1);
    }
    cortadas[maxLinhas - 1] = ultima + "…";
    return cortadas;
  }
  return linhas;
}

function exportarCarregarImageElement(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function exportarCarregarImagemComoDataUrl(url) {
  try {
    const resposta = await fetch(url);
    if (!resposta.ok) return null;
    const blob = await resposta.blob();
    return await new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(leitor.result);
      leitor.onerror = () => reject(new Error("Falha ao ler imagem"));
      leitor.readAsDataURL(blob);
    });
  } catch (erro) {
    console.error("[Carrinho Impala] Não consegui carregar imagem:", erro);
    return null;
  }
}

function exportarFormatarPrecoSemPrefixo(valor) {
  return Number(valor).toFixed(2).replace(".", ",");
}

// ---------- Monta a lista de itens do carrinho, agrupada por coleção ----------
function exportarItensDoCarrinhoAgrupados() {
  const itens = Array.from(carrinho.values()).map((it) => it.produto);
  const porColecao = new Map();
  itens.forEach((item) => {
    if (!porColecao.has(item.colecao)) porColecao.set(item.colecao, []);
    porColecao.get(item.colecao).push(item);
  });
  const colecoesOrdenadas = Array.from(porColecao.keys()).sort((a, b) => a.localeCompare(b, "pt-BR"));
  return colecoesOrdenadas.map((colecao) => ({
    colecao,
    itens: porColecao.get(colecao).sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR")),
  }));
}

// ---------- Carrega template + fotos (produtos e vendedor) ----------
async function exportarCarregarRecursos(itensLista) {
  const dataUrlsPorCodigo = new Map();
  await Promise.all(
    itensLista
      .filter((i) => i.imagem_url)
      .map(async (i) => {
        const dataUrl = await exportarCarregarImagemComoDataUrl(i.imagem_url);
        if (dataUrl) dataUrlsPorCodigo.set(i.codigo, dataUrl);
      })
  );
  const imagensProdutos = new Map();
  await Promise.all(
    Array.from(dataUrlsPorCodigo.entries()).map(async ([codigo, dataUrl]) => {
      const img = await exportarCarregarImageElement(dataUrl);
      if (img) imagensProdutos.set(codigo, img);
    })
  );

  const fotoVendedorUrl = document.getElementById("vendedor-foto").src;
  const imagemVendedor = fotoVendedorUrl ? await exportarCarregarImageElement(fotoVendedorUrl) : null;
  const imagemTemplate = await exportarCarregarImageElement(EXPORT_TEMPLATE_CAMINHO);

  return { imagensProdutos, imagemVendedor, imagemTemplate };
}

// ---------- Desenha a grade de cartões (usada só pelo PNG) ----------
function exportarDesenharGradeDeCartoes(ctx, itens, imagensProdutos, opcoes) {
  const {
    colunas, areaEsq, areaTopo, larguraCard, alturaCard, gutterH, gutterV,
    padCard, larguraFoto, alturaImagem,
  } = opcoes;

  itens.forEach((item, indice) => {
    const coluna = indice % colunas;
    const linha = Math.floor(indice / colunas);
    const x = areaEsq + coluna * (larguraCard + gutterH);
    const y = areaTopo + linha * (alturaCard + gutterV);

    ctx.save();
    ctx.shadowColor = "rgba(20,18,14,0.18)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = "#FFFFFF";
    exportarDesenharRetanguloArredondado(ctx, x, y, larguraCard, alturaCard, 14);
    ctx.fill();
    ctx.restore();

    const imagemItem = imagensProdutos.get(item.codigo);
    if (imagemItem) {
      ctx.save();
      exportarDesenharRetanguloArredondado(ctx, x + padCard, y + padCard, larguraFoto, alturaImagem, 8);
      ctx.clip();
      exportarDesenharImagemPreenchendo(ctx, imagemItem, x + padCard, y + padCard, larguraFoto, alturaImagem);
      ctx.restore();
    } else {
      ctx.fillStyle = "#F4F3EE";
      exportarDesenharRetanguloArredondado(ctx, x + padCard, y + padCard, larguraFoto, alturaImagem, 8);
      ctx.fill();
    }

    const precoTexto = exportarFormatarPrecoSemPrefixo(item.preco_unitario);
    const alturaBadge = EXPORT_GRADE_ALTURA_BADGE;
    const larguraBadge = larguraFoto;
    const xBadge = x + padCard;
    const yBadge = y + alturaCard - padCard - alturaBadge;

    ctx.font = "400 9.5px 'Inter', sans-serif";
    const linhaCodigo = exportarQuebrarTextoCanvas(ctx, `Cód. ${item.codigo}`, larguraFoto, 1)[0];

    ctx.font = "italic 700 15px 'Playfair Display', serif";
    const linhasNome = exportarQuebrarTextoCanvas(ctx, item.descricao, larguraFoto, EXPORT_GRADE_MAX_LINHAS_NOME);

    const gapCodigoBadge = EXPORT_GRADE_GAP_CODIGO_BADGE;
    const gapNomeCodigo = EXPORT_GRADE_GAP_NOME_CODIGO;
    const linhaAlturaNome = EXPORT_GRADE_LINHA_ALTURA_NOME;

    const yCodigo = yBadge - gapCodigoBadge;
    const yUltimaLinhaNome = yCodigo - gapNomeCodigo;
    const yPrimeiraLinhaNome = yUltimaLinhaNome - (linhasNome.length - 1) * linhaAlturaNome;

    ctx.fillStyle = "#1E1E1E";
    ctx.font = "italic 700 15px 'Playfair Display', serif";
    linhasNome.forEach((linha, li) => ctx.fillText(linha, x + padCard, yPrimeiraLinhaNome + li * linhaAlturaNome));

    ctx.fillStyle = "#8A8A8A";
    ctx.font = "400 9.5px 'Inter', sans-serif";
    ctx.fillText(linhaCodigo, x + padCard, yCodigo);

    ctx.save();
    ctx.shadowColor = "rgba(212,175,55,0.45)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = EXPORT_COR_BADGE;
    exportarDesenharRetanguloArredondado(ctx, xBadge, yBadge, larguraBadge, alturaBadge, 10);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "700 10px 'Inter', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("R$", xBadge + 11, yBadge + 16);
    ctx.textAlign = "right";
    ctx.fillStyle = "#E9D9E5";
    ctx.fillText("unid", xBadge + larguraBadge - 11, yBadge + 16);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "italic 700 34px 'Playfair Display', serif";
    ctx.textAlign = "center";
    ctx.fillText(precoTexto, x + larguraCard / 2, yBadge + alturaBadge - 10);
    ctx.textAlign = "left";
  });
}

// ---------- Desenha a foto + nome do vendedor, do lado esquerdo da logo ----------
function exportarDesenharCabecalhoVendedorCanvas(ctx, imagemVendedor) {
  const diam = EXPORT_VENDEDOR_FOTO_DIAMETRO;
  const x = EXPORT_TEMPLATE_AREA.esq + EXPORT_VENDEDOR_INDENT;
  const yCentro = EXPORT_VENDEDOR_FOTO_Y_CENTRO;
  const y = yCentro - diam / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x + diam / 2, yCentro, diam / 2, 0, Math.PI * 2);
  ctx.closePath();
  if (imagemVendedor) {
    ctx.clip();
    exportarDesenharImagemPreenchendo(ctx, imagemVendedor, x, y, diam, diam);
  } else {
    ctx.fillStyle = "#F4F3EE";
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x + diam / 2, yCentro, diam / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const nomeVendedor = (document.getElementById("vendedor-nome").textContent || "").trim();
  if (nomeVendedor) {
    ctx.fillStyle = EXPORT_COR_NOME_VENDEDOR;
    ctx.font = "italic 700 30px 'Playfair Display', serif";
    ctx.textAlign = "left";
    ctx.fillText(nomeVendedor, x + diam + 18, yCentro + 10);
  }
}

// Calcula o tamanho da grade da Imagem a partir do conteúdo dos cartões
// (não mais 3 fileiras fixas) — devolve quantas fileiras cabem de verdade
// no espaço disponível, e portanto quantos itens cabem por imagem.
function exportarCalcularGradePng() {
  const colunas = 4;
  const gutterH = 30;
  const gutterV = 22;
  const padCard = EXPORT_GRADE_PADCARD;
  const { esq: areaEsq, dir: areaDir, topo: areaTopo, base: areaBase } = EXPORT_TEMPLATE_AREA;
  const larguraUtil = areaDir - areaEsq;
  const alturaUtil = areaBase - areaTopo;
  const larguraCard = (larguraUtil - gutterH * (colunas - 1)) / colunas;
  const larguraFoto = larguraCard - padCard * 2;
  const alturaImagem = larguraFoto * EXPORT_GRADE_FATOR_ALTURA_FOTO;

  // Altura do cartão = só o que o conteúdo realmente precisa (foto + nome
  // de até 2 linhas + código + etiqueta de preço), igual ao PDF — em vez
  // de dividir o espaço em 3 fileiras fixas (o que deixava uma sobra de
  // espaço em branco embaixo de cada cartão).
  const alturaBlocoTexto =
    EXPORT_GRADE_GAP_FOTO_NOME +
    EXPORT_GRADE_MAX_LINHAS_NOME * EXPORT_GRADE_LINHA_ALTURA_NOME +
    EXPORT_GRADE_GAP_NOME_CODIGO +
    EXPORT_GRADE_GAP_CODIGO_BADGE;
  const alturaCard = padCard + alturaImagem + alturaBlocoTexto + EXPORT_GRADE_ALTURA_BADGE + padCard;

  const linhasGrade = Math.max(1, Math.floor((alturaUtil + gutterV) / (alturaCard + gutterV)));

  return {
    colunas, gutterH, gutterV, padCard, areaEsq, areaTopo, alturaUtil,
    larguraCard, alturaCard, larguraFoto, alturaImagem,
    linhasGrade, limite: colunas * linhasGrade,
  };
}

// A Imagem (PNG) é uma folha de tamanho fixo (ao contrário do PDF, que só
// usa quantas páginas precisar), então quando o carrinho tem menos itens
// do que cabe na grade, sobra espaço em branco no final. Em vez de deixar
// essa sobra toda embaixo (carrinho "encostado" no topo) ou esticar o
// espaço entre as fileiras (o que deixava um vão enorme e esquisito entre
// elas), o espaço entre as fileiras fica sempre igual, e só o bloco
// inteiro é centralizado verticalmente — como um cartaz com poucos itens
// bem no meio da folha, em vez de grudado em cima ou com buracos no meio.
// Só pra Imagem — o PDF continua do jeito que já era.
function exportarAjustarEspacamentoPng(grade, totalItens) {
  const { colunas, gutterV, alturaCard, areaTopo, alturaUtil } = grade;
  const linhasReais = Math.max(1, Math.ceil(totalItens / colunas));

  const alturaBlocoGrade = linhasReais * alturaCard + (linhasReais - 1) * gutterV;
  const areaTopoAjustada = areaTopo + Math.max(0, (alturaUtil - alturaBlocoGrade) / 2);

  return { gutterV, areaTopo: areaTopoAjustada };
}

// ---------- Botão "Gerar Imagem" ----------
async function exportarGerarImagemCarrinho() {
  const grupos = exportarItensDoCarrinhoAgrupados();
  const todosItens = grupos.flatMap((g) => g.itens);

  if (todosItens.length === 0) {
    alert("Seu carrinho está vazio. Adicione itens antes de gerar a imagem.");
    return;
  }

  const {
    colunas, gutterH, gutterV, padCard, areaEsq, areaTopo, alturaUtil,
    larguraCard, alturaCard, larguraFoto, alturaImagem, limite,
  } = exportarCalcularGradePng();

  let itensParaImagem = todosItens;
  if (todosItens.length > limite) {
    itensParaImagem = todosItens.slice(0, limite);
    alert(
      `Seu carrinho tem mais de ${limite} itens — a imagem mostra só os ${limite} primeiros.\n\n` +
      `Pra ver a lista completa, gera o PDF.`
    );
  }

  const botao = document.getElementById("btn-exportar-imagem-ofertas");
  botao.disabled = true;
  try {
    const { imagensProdutos, imagemVendedor, imagemTemplate } = await exportarCarregarRecursos(itensParaImagem);

    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (erroFontes) { /* segue com a fonte padrão */ }
    }

    const canvas = document.createElement("canvas");
    canvas.width = EXPORT_TEMPLATE_LARGURA;
    canvas.height = EXPORT_TEMPLATE_ALTURA;
    const ctx = canvas.getContext("2d");

    if (imagemTemplate) {
      ctx.drawImage(imagemTemplate, 0, 0, EXPORT_TEMPLATE_LARGURA, EXPORT_TEMPLATE_ALTURA);
    } else {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, EXPORT_TEMPLATE_LARGURA, EXPORT_TEMPLATE_ALTURA);
    }

    exportarDesenharCabecalhoVendedorCanvas(ctx, imagemVendedor);

    const { gutterV: gutterVAjustado, areaTopo: areaTopoAjustada } = exportarAjustarEspacamentoPng(
      { colunas, gutterV, alturaCard, areaTopo, alturaUtil },
      itensParaImagem.length
    );

    exportarDesenharGradeDeCartoes(ctx, itensParaImagem, imagensProdutos, {
      colunas, areaEsq, areaTopo: areaTopoAjustada, larguraCard, alturaCard,
      gutterH, gutterV: gutterVAjustado, padCard, larguraFoto, alturaImagem,
    });

    const dataArquivo = new Date().toISOString().slice(0, 10);
    const link = document.createElement("a");
    link.download = `carrinho-impala-${dataArquivo}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (erro) {
    console.error("[Carrinho Impala] Erro ao gerar imagem:", erro);
    alert("Não consegui gerar a imagem. Tenta de novo.");
  } finally {
    botao.disabled = false;
  }
}

// ---------- Botão "Gerar PDF" ----------
async function exportarGerarPdfCarrinho() {
  const grupos = exportarItensDoCarrinhoAgrupados();
  const todosItens = grupos.flatMap((g) => g.itens);

  if (todosItens.length === 0) {
    alert("Seu carrinho está vazio. Adicione itens antes de gerar o PDF.");
    return;
  }

  const botao = document.getElementById("btn-exportar-pdf-ofertas");
  botao.disabled = true;

  try {
    const { imagensProdutos, imagemVendedor, imagemTemplate } = await exportarCarregarRecursos(todosItens);

    let templateDataUrl = null;
    if (imagemTemplate) {
      const canvasTemplate = document.createElement("canvas");
      canvasTemplate.width = imagemTemplate.width;
      canvasTemplate.height = imagemTemplate.height;
      canvasTemplate.getContext("2d").drawImage(imagemTemplate, 0, 0);
      templateDataUrl = canvasTemplate.toDataURL("image/jpeg", 0.92);
    }

    // Foto do vendedor + a moldura dourada, prontas como uma imagem circular
    // só (recortada aqui, porque o jsPDF não recorta imagem sozinho).
    let fotoVendedorDataUrl = null;
    if (imagemVendedor) {
      const diamPx = 240;
      const canvasFoto = document.createElement("canvas");
      canvasFoto.width = diamPx;
      canvasFoto.height = diamPx;
      const ctxFoto = canvasFoto.getContext("2d");
      ctxFoto.save();
      ctxFoto.beginPath();
      ctxFoto.arc(diamPx / 2, diamPx / 2, diamPx / 2, 0, Math.PI * 2);
      ctxFoto.closePath();
      ctxFoto.clip();
      exportarDesenharImagemPreenchendo(ctxFoto, imagemVendedor, 0, 0, diamPx, diamPx);
      ctxFoto.restore();
      fotoVendedorDataUrl = canvasFoto.toDataURL("image/png");
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const larguraPagina = 210;
    const alturaPagina = 297;

    const escalaX = larguraPagina / EXPORT_TEMPLATE_LARGURA;
    const escalaY = alturaPagina / EXPORT_TEMPLATE_ALTURA;
    const areaEsq = EXPORT_TEMPLATE_AREA.esq * escalaX;
    const areaDir = EXPORT_TEMPLATE_AREA.dir * escalaX;
    const areaTopo = EXPORT_TEMPLATE_AREA.topo * escalaY;
    const areaBase = EXPORT_TEMPLATE_AREA.base * escalaY;
    const margemX = areaEsq;
    const larguraUtil = areaDir - areaEsq;

    function desenharFundo() {
      if (templateDataUrl) {
        doc.addImage(templateDataUrl, "JPEG", 0, 0, larguraPagina, alturaPagina);
      }
    }

    function desenharCabecalhoVendedor() {
      const diamMm = EXPORT_VENDEDOR_FOTO_DIAMETRO * escalaX;
      const xFoto = (EXPORT_TEMPLATE_AREA.esq + EXPORT_VENDEDOR_INDENT) * escalaX;
      const yCentroMm = EXPORT_VENDEDOR_FOTO_Y_CENTRO * escalaY;
      const yFoto = yCentroMm - diamMm / 2;
      if (fotoVendedorDataUrl) {
        doc.addImage(fotoVendedorDataUrl, "PNG", xFoto, yFoto, diamMm, diamMm);
      }
      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(0.6);
      doc.circle(xFoto + diamMm / 2, yCentroMm, diamMm / 2, "S");

      const nomeVendedor = (document.getElementById("vendedor-nome").textContent || "").trim();
      if (nomeVendedor) {
        doc.setFont("helvetica", "bolditalic");
        doc.setFontSize(13);
        doc.setTextColor(92, 31, 84);
        doc.text(nomeVendedor, xFoto + diamMm + 4, yCentroMm + 1.6);
      }
    }

    desenharFundo();
    desenharCabecalhoVendedor();

    let y = areaTopo;

    const colunas = 4;
    const gutterH = 4;
    const gutterV = 7;
    const larguraCard = (larguraUtil - gutterH * (colunas - 1)) / colunas;
    const padCard = 2.2;
    const larguraFoto = larguraCard - padCard * 2;
    const alturaFoto = larguraFoto;
    const alturaBadge = 9.6;
    const alturaTextos = 12.5;
    const alturaCard = padCard + alturaFoto + alturaTextos + alturaBadge + padCard;

    const ladoFotoPx = Math.round(larguraFoto * (300 / 25.4));
    const fotosRecortadas = new Map();
    imagensProdutos.forEach((img, codigo) => {
      const canvasFoto = document.createElement("canvas");
      canvasFoto.width = ladoFotoPx;
      canvasFoto.height = ladoFotoPx;
      exportarDesenharImagemPreenchendo(canvasFoto.getContext("2d"), img, 0, 0, ladoFotoPx, ladoFotoPx);
      fotosRecortadas.set(codigo, canvasFoto.toDataURL("image/jpeg", 0.9));
    });

    grupos.forEach((grupo) => {
      if (y + 6 + alturaCard > areaBase) { doc.addPage(); desenharFundo(); desenharCabecalhoVendedor(); y = areaTopo + 6; }

      doc.setFont("helvetica", "bolditalic");
      doc.setFontSize(11);
      doc.setTextColor(173, 20, 87);
      doc.text(grupo.colecao.toUpperCase(), margemX, y);
      y += 5.5;

      let coluna = 0;
      grupo.itens.forEach((item) => {
        if (coluna === 0 && y + alturaCard > areaBase) {
          doc.addPage();
          desenharFundo();
          desenharCabecalhoVendedor();
          y = areaTopo + 6;
        }

        const x = margemX + coluna * (larguraCard + gutterH);

        doc.setDrawColor(225, 224, 218);
        doc.setFillColor(255, 255, 255);
        doc.setLineWidth(0.2);
        doc.roundedRect(x, y, larguraCard, alturaCard, 1.8, 1.8, "FD");

        const fotoDataUrl = fotosRecortadas.get(item.codigo);
        if (fotoDataUrl) {
          try {
            doc.addImage(fotoDataUrl, "JPEG", x + padCard, y + padCard, larguraFoto, alturaFoto);
          } catch (erro) {
            console.error("[Carrinho Impala] Erro ao inserir imagem no PDF:", erro);
          }
        } else {
          doc.setFillColor(244, 243, 238);
          doc.rect(x + padCard, y + padCard, larguraFoto, alturaFoto, "F");
        }

        const precoTexto = exportarFormatarPrecoSemPrefixo(item.preco_unitario);
        const larguraBadge = larguraFoto;
        const xBadge = x + padCard;
        const yBadge = y + alturaCard - padCard - alturaBadge;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.2);
        const linhaCodigo = doc.splitTextToSize(`Cód. ${item.codigo}`, larguraFoto)[0];

        doc.setFont("helvetica", "bolditalic");
        doc.setFontSize(8.3);
        const todasLinhasNome = doc.splitTextToSize(item.descricao, larguraFoto);
        const linhasNome = todasLinhasNome.slice(0, 2);
        if (todasLinhasNome.length > 2 && linhasNome[1].length > 1) {
          linhasNome[1] = linhasNome[1].slice(0, -1) + "…";
        }

        const gapCodigoBadge = 2.6;
        const gapNomeCodigo = 3.4;
        const linhaAlturaNome = 3.4;

        const yCodigo = yBadge - gapCodigoBadge;
        const yUltimaLinhaNome = yCodigo - gapNomeCodigo;
        const yPrimeiraLinhaNome = yUltimaLinhaNome - (linhasNome.length - 1) * linhaAlturaNome;

        doc.setTextColor(30, 30, 30);
        doc.setFont("helvetica", "bolditalic");
        doc.setFontSize(8.3);
        linhasNome.forEach((linha, li) => doc.text(linha, x + padCard, yPrimeiraLinhaNome + li * linhaAlturaNome));

        doc.setTextColor(130, 130, 130);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.2);
        doc.text(linhaCodigo, x + padCard, yCodigo);

        doc.setFillColor(92, 31, 84);
        doc.roundedRect(xBadge, yBadge, larguraBadge, alturaBadge, 1.6, 1.6, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.6);
        doc.setTextColor(255, 255, 255);
        doc.text("R$", xBadge + 2, yBadge + 3.4);
        doc.setTextColor(233, 217, 229);
        doc.text("unid", xBadge + larguraBadge - 2, yBadge + 3.4, { align: "right" });

        doc.setFont("helvetica", "bolditalic");
        doc.setFontSize(13.5);
        doc.setTextColor(255, 255, 255);
        doc.text(precoTexto, x + larguraCard / 2, yBadge + alturaBadge - 2, { align: "center" });

        coluna++;
        if (coluna === colunas) {
          coluna = 0;
          y += alturaCard + gutterV;
        }
      });

      if (coluna !== 0) y += alturaCard + gutterV;
      y += 3;
    });

    const dataArquivo = new Date().toISOString().slice(0, 10);
    doc.save(`carrinho-impala-${dataArquivo}.pdf`);
  } catch (erro) {
    console.error("[Carrinho Impala] Erro ao gerar PDF:", erro);
    alert("Não consegui gerar o PDF. Tenta de novo.");
  } finally {
    botao.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-exportar-imagem-ofertas").addEventListener("click", exportarGerarImagemCarrinho);
  document.getElementById("btn-exportar-pdf-ofertas").addEventListener("click", exportarGerarPdfCarrinho);
});
