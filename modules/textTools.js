// modules/textTools.js - Facilita Extensão
// Ferramentas para manipulação e conversão de texto.

// A biblioteca extenso.js é carregada globalmente no popup.html via <script src="libs/extenso.min.js"></script>
// Portanto, a função `extenso` estará disponível no escopo global do popup.

/**
 * Converte um número para sua forma escrita por extenso.
 * @param {number|string} numero - O número a ser convertido.
 * @param {object} [opcoes={}] - Opções de formatação.
 * @param {boolean} [opcoes.moeda=false] - Se true, formata como valor monetário em Reais.
 * @param {boolean} [opcoes.feminino=false] - Se true, usa gênero feminino para números.
 * @returns {string} O número por extenso ou uma mensagem de erro.
 */
export function numeroParaExtenso(numero, opcoes = {}) {
  try {
    if (typeof extenso !== 'function') {
      console.warn('Biblioteca extenso.js não carregada ou não é uma função.');
      return String(numero) + (opcoes.moeda ? ' (extenso.js não disponível)' : '');
    }

    const { moeda = false, feminino = false } = opcoes;
    let extensoOptions = {};

    // A biblioteca extenso.js espera vírgula como separador decimal.
    const numeroFormatado = String(numero).replace('.', ',');

    if (moeda) {
      extensoOptions = {
        mode: 'currency',
        currency: { type: 'BRL' } // Define explicitamente para Real Brasileiro
      };
    } else {
      extensoOptions = {
        number: { gender: feminino ? 'f' : 'm' }
      };
    }
    return extenso(numeroFormatado, extensoOptions);
  } catch (error) {
    console.error("Erro ao converter número para extenso:", error);
    return `[Erro na conversão: ${error.message}]`;
  }
}

/**
 * Limpa o texto com base nas opções fornecidas.
 * @param {string} texto - O texto a ser limpo.
 * @param {object} opcoes - Opções de limpeza.
 * @param {boolean} [opcoes.unirParagrafos=false] - Unir parágrafos (remover quebras de linha extras, mantendo uma).
 * @param {boolean} [opcoes.removerEspacosDuplos=false] - Remover espaços múltiplos.
 * @param {boolean} [opcoes.removerEspacosBordas=false] - Remover espaços no início e fim de cada linha.
 * @param {boolean} [opcoes.converterMaiusculas=false] - Converter tudo para MAIÚSCULAS.
 * @param {boolean} [opcoes.converterMinusculas=false] - Converter tudo para minúsculas.
 * @param {boolean} [opcoes.converterTitulo=false] - Converter para Formato De Título.
 * @param {boolean} [opcoes.removerMarcadores=false] - Remover marcadores de lista (como *, -, 1.).
 * @returns {string} O texto limpo.
 */
export function limparTexto(texto, opcoes = {}) {
  let resultado = String(texto); // Garante que é uma string

  const {
    unirParagrafos = false,
    removerEspacosDuplos = false,
    removerEspacosBordas = false,
    converterMaiusculas = false,
    converterMinusculas = false,
    converterTitulo = false,
    removerMarcadores = false
  } = opcoes;

  // Unir parágrafos: substitui múltiplas quebras de linha por uma única,
  // depois substitui quebras de linha simples (que não são de parágrafo) por espaço.
  if (unirParagrafos) {
    resultado = resultado.replace(/\n\s*\n+/g, '\n'); // Reduz múltiplas quebras a uma
    resultado = resultado.replace(/(?<!\n)\n(?!\n)/g, ' '); // Quebras simples viram espaço
  }

  // Remover espaços nas bordas das linhas (trim em cada linha)
  if (removerEspacosBordas) {
    resultado = resultado.split('\n').map(linha => linha.trim()).join('\n');
  }

  // Remover espaços duplos (ou múltiplos) e substituí-los por um único espaço
  if (removerEspacosDuplos) {
    resultado = resultado.replace(/  +/g, ' ');
  }

  // Converter para TUDO MAIÚSCULAS
  if (converterMaiusculas) {
    resultado = resultado.toUpperCase();
  }

  // Converter para tudo minúsculas
  if (converterMinusculas && !converterMaiusculas) { // Evita conflito se ambas estiverem marcadas
    resultado = resultado.toLowerCase();
  }

  // Converter para Formato De Título (Primeira Letra de Cada Palavra Maiúscula)
  if (converterTitulo && !converterMaiusculas && !converterMinusculas) {
    resultado = resultado.toLowerCase().replace(/\b([a-zA-Zà-úÀ-Ú])/g, char => char.toUpperCase());
  }

  // Remover marcadores de lista (ex: *, -, 1., a.)
  if (removerMarcadores) {
    resultado = resultado.replace(/^[\s\t]*([*\-•–—]|\d+[.)]|[a-zA-Z][.)])\s+/gm, '');
  }

  return resultado.trim(); // Trim final no resultado completo
}

/**
 * Localiza e substitui texto.
 * @param {string} texto - O texto original.
 * @param {string} localizar - O texto a ser localizado.
 * @param {string} substituir - O texto substituto.
 * @param {boolean} [caseSensitive=true] - Se true, diferencia maiúsculas e minúsculas.
 * @returns {string} O texto com as substituições.
 */
export function localizarESubstituir(texto, localizar, substituir, caseSensitive = true) {
  if (!localizar) return texto; // Se não há o que localizar, retorna o texto original

  // Escapa caracteres especiais de regex no termo a ser localizado
  const localizarEscapado = localizar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const flags = caseSensitive ? 'g' : 'gi'; // 'g' para global, 'i' para case-insensitive
  const regex = new RegExp(localizarEscapado, flags);

  return texto.replace(regex, substituir);
}

/**
 * Ordena as linhas do texto alfabeticamente.
 * @param {string} texto - O texto a ser ordenado.
 * @param {string} ordem - "asc" para A-Z, "desc" para Z-A.
 * @returns {string} O texto com as linhas ordenadas.
 */
export function ordenarLinhas(texto, ordem = "asc") {
  const linhas = texto.split('\n');

  linhas.sort((a, b) => {
    // localeCompare para ordenação correta de caracteres acentuados
    const comparacao = a.localeCompare(b, 'pt-BR', { sensitivity: 'base', numeric: true });
    return ordem === 'desc' ? comparacao * -1 : comparacao;
  });

  return linhas.join('\n');
}

/**
 * Conta caracteres (com e sem espaços), palavras e linhas em um texto.
 * @param {string} texto - O texto a ser analisado.
 * @returns {object} Objeto com as contagens: { caracteresComEspacos, caracteresSemEspacos, palavras, linhas }.
 */
export function contarElementos(texto) {
  const caracteresComEspacos = texto.length;
  const caracteresSemEspacos = texto.replace(/\s/g, '').length;
  // Considera palavras como sequências de não-espaços, filtrando strings vazias após o split
  const palavras = texto.trim() === '' ? 0 : texto.trim().split(/[\s\n]+/).filter(Boolean).length;
  // Conta linhas baseado nas quebras de linha; um texto vazio ou sem quebra de linha tem 1 linha.
  const linhas = texto.trim() === '' && caracteresComEspacos === 0 ? 0 : texto.split('\n').length;

  return {
    caracteresComEspacos,
    caracteresSemEspacos,
    palavras,
    linhas
  };
}

console.log("Facilita textTools.js loaded.");
