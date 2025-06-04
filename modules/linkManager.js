// modules/linkManager.js - Facilita Extensão
// Gerenciamento de links salvos e painel de links rápidos.

const LINKS_SALVOS_STORAGE_KEY = 'facilita_linksSalvos';

/**
 * Carrega os links salvos do armazenamento local.
 * @returns {Promise<Array<object>>} Array de objetos de link [{id, nome, url, categoria}].
 */
export async function carregarLinksSalvos() {
  return new Promise((resolve) => {
    chrome.storage.local.get([LINKS_SALVOS_STORAGE_KEY], (result) => {
      const links = result[LINKS_SALVOS_STORAGE_KEY] || [];
      resolve(links);
    });
  });
}

/**
 * Salva a lista completa de links no armazenamento local.
 * @param {Array<object>} links - Array de links a serem salvos.
 * @returns {Promise<void>}
 */
async function _salvarListaCompletaLinks(links) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [LINKS_SALVOS_STORAGE_KEY]: links }, () => {
      if (chrome.runtime.lastError) {
        console.error("Erro ao salvar lista de links:", chrome.runtime.lastError);
        return reject(chrome.runtime.lastError);
      }
      resolve();
    });
  });
}

/**
 * Adiciona um novo link salvo.
 * @param {object} linkData - Objeto contendo {nome, url, categoria (opcional)}.
 * @returns {Promise<Array<object>>} Array atualizado de links salvos.
 * @throws {Error} Se nome ou URL não forem fornecidos.
 */
export async function adicionarLinkSalvo(linkData) {
  if (!linkData || !linkData.nome || !linkData.url) {
    throw new Error(chrome.i18n.getMessage("feedbackLinkNameURLRequired") || 'Nome e URL são obrigatórios para o link.');
  }

  let urlFormatada = linkData.url.trim();
  if (!urlFormatada.startsWith('http://') && !urlFormatada.startsWith('https://')) {
    urlFormatada = 'https://' + urlFormatada;
  }
  // Validação simples de URL
  try {
    new URL(urlFormatada);
  } catch (_) {
    throw new Error(chrome.i18n.getMessage("feedbackErrorImporting", ["URL inválida."]) || 'URL inválida.');
  }


  const novoLink = {
    id: Date.now().toString() + "_" + Math.random().toString(36).substring(2, 9),
    nome: linkData.nome.trim(),
    url: urlFormatada,
    categoria: (linkData.categoria || chrome.i18n.getMessage("categoryOther") || 'Outros').trim().toLowerCase()
  };

  const linksAtuais = await carregarLinksSalvos();
  linksAtuais.push(novoLink);
  await _salvarListaCompletaLinks(linksAtuais);
  return linksAtuais;
}

/**
 * Remove um link salvo pelo ID.
 * @param {string} id - ID do link a ser removido.
 * @returns {Promise<Array<object>>} Array atualizado de links salvos.
 */
export async function removerLinkSalvo(id) {
  const linksAtuais = await carregarLinksSalvos();
  const linksAtualizados = linksAtuais.filter(link => link.id !== id);
  await _salvarListaCompletaLinks(linksAtualizados);
  return linksAtualizados;
}

/**
 * Edita um link salvo existente.
 * @param {string} id - ID do link a ser editado.
 * @param {object} linkDataAtualizado - Objeto com os dados atualizados {nome, url, categoria}.
 * @returns {Promise<Array<object>>} Array atualizado de links salvos.
 * @throws {Error} Se o link não for encontrado ou dados inválidos.
 */
export async function editarLinkSalvo(id, linkDataAtualizado) {
    if (!linkDataAtualizado || !linkDataAtualizado.nome || !linkDataAtualizado.url) {
        throw new Error(chrome.i18n.getMessage("feedbackLinkNameURLRequired") || 'Nome e URL são obrigatórios para o link.');
    }

    let urlFormatada = linkDataAtualizado.url.trim();
    if (!urlFormatada.startsWith('http://') && !urlFormatada.startsWith('https://')) {
        urlFormatada = 'https://' + urlFormatada;
    }
    try {
        new URL(urlFormatada);
    } catch (_) {
        throw new Error(chrome.i18n.getMessage("feedbackErrorImporting", ["URL inválida."]) || 'URL inválida.');
    }

    const linksAtuais = await carregarLinksSalvos();
    const index = linksAtuais.findIndex(link => link.id === id);

    if (index === -1) {
        throw new Error("Link não encontrado para edição.");
    }

    linksAtuais[index] = {
        ...linksAtuais[index],
        nome: linkDataAtualizado.nome.trim(),
        url: urlFormatada,
        categoria: (linkDataAtualizado.categoria || chrome.i18n.getMessage("categoryOther") || 'Outros').trim().toLowerCase()
    };

    await _salvarListaCompletaLinks(linksAtuais);
    return linksAtuais;
}


/**
 * Retorna a lista de links rápidos pré-definidos.
 * Categorias: "tjsp", "legislacao", "tribunais", "consultas", "outros".
 * @returns {Array<object>} Array de objetos de link [{nome, url, categoria, icon (opcional SVG string)}].
 */
export function obterLinksPredefinidos() {
  const linkIconSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
  const tjspIconSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z"></path><circle cx="12" cy="12" r="3"></circle></svg>'; // Ícone genérico para justiça
  const lawIconSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>'; // Ícone de documento/lei

  return [
    // TJSP
    { nome: chrome.i18n.getMessage("linkNameTJSPPortal") || "Portal e-SAJ TJSP", url: "https://esaj.tjsp.jus.br/", categoria: "tjsp", icon: tjspIconSVG },
    { nome: chrome.i18n.getMessage("linkNameTJSP1Grau") || "Consulta Processos 1º Grau", url: "https://esaj.tjsp.jus.br/cpopg/open.do", categoria: "tjsp", icon: tjspIconSVG },
    { nome: chrome.i18n.getMessage("linkNameTJSP2Grau") || "Consulta Processos 2º Grau", url: "https://esaj.tjsp.jus.br/cposg/open.do", categoria: "tjsp", icon: tjspIconSVG },
    { nome: chrome.i18n.getMessage("linkNameTJSPPeticionamento") || "Peticionamento Eletrônico", url: "https://esaj.tjsp.jus.br/petpg/abrirNovaPeticao.do", categoria: "tjsp", icon: tjspIconSVG },
    { nome: chrome.i18n.getMessage("linkNameTJSPJurisprudencia") || "Consulta Jurisprudência", url: "https://esaj.tjsp.jus.br/cjsg/consultaCompleta.do", categoria: "tjsp", icon: tjspIconSVG },
    { nome: chrome.i18n.getMessage("linkNameTJSPDJE") || "DJE TJSP", url: "https://www.dje.tjsp.jus.br/cdje/index.do", categoria: "tjsp", icon: tjspIconSVG },
    { nome: chrome.i18n.getMessage("linkNameTJSPCustas") || "Portal de Custas", url: "https://www.tjsp.jus.br/PortalCustas", categoria: "tjsp", icon: tjspIconSVG },

    // Legislação
    { nome: chrome.i18n.getMessage("linkNamePlanaltoLegislacao") || "Planalto - Legislação", url: "http://www4.planalto.gov.br/legislacao/", categoria: "legislacao", icon: lawIconSVG },
    { nome: chrome.i18n.getMessage("linkNameCodigoCivil") || "Código Civil", url: "http://www.planalto.gov.br/ccivil_03/leis/2002/l10406.htm", categoria: "legislacao", icon: lawIconSVG },
    { nome: chrome.i18n.getMessage("linkNameCPC") || "Código de Processo Civil", url: "http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm", categoria: "legislacao", icon: lawIconSVG },
    { nome: chrome.i18n.getMessage("linkNameConstituicao") || "Constituição Federal", url: "http://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm", categoria: "legislacao", icon: lawIconSVG },

    // Tribunais Superiores e Outros
    { nome: chrome.i18n.getMessage("linkNameCNJ") || "CNJ", url: "https://www.cnj.jus.br/", categoria: "tribunais", icon: linkIconSVG },
    { nome: chrome.i18n.getMessage("linkNameSTF") || "STF", url: "https://portal.stf.jus.br/", categoria: "tribunais", icon: linkIconSVG },
    { nome: chrome.i18n.getMessage("linkNameSTJ") || "STJ", url: "https://www.stj.jus.br/", categoria: "tribunais", icon: linkIconSVG },

    // Consultas Úteis
    { nome: chrome.i18n.getMessage("linkNameReceitaCPF") || "Consulta CPF - Receita", url: "https://servicos.receita.fazenda.gov.br/servicos/cpf/consultasituacao/consultapublica.asp", categoria: "consultas", icon: linkIconSVG },
    { nome: chrome.i18n.getMessage("linkNameCorreiosCEP") || "Busca CEP - Correios", url: "https://buscacepinter.correios.com.br/app/endereco/index.php", categoria: "consultas", icon: linkIconSVG },

    // Outros
    { nome: chrome.i18n.getMessage("linkNameOABSP") || "OAB SP", url: "https://www.oabsp.org.br/", categoria: "outros", icon: linkIconSVG },
    { nome: chrome.i18n.getMessage("linkNameAASP") || "AASP", url: "https://www.aasp.org.br/", categoria: "outros", icon: linkIconSVG }
  ];
}


console.log("Facilita linkManager.js loaded.");
