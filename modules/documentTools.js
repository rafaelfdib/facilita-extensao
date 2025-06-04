// modules/documentTools.js - Facilita Extensão
// Ferramentas para formatação de documentos e consulta de processos.

/**
 * Formata um número de CPF.
 * @param {string} cpf - O CPF a ser formatado (pode conter não números).
 * @returns {string} CPF formatado (ex: 123.456.789-00) ou o original se inválido.
 */
export function formatarCPF(cpf) {
  const cpfLimpo = String(cpf).replace(/\D/g, '');
  if (cpfLimpo.length !== 11) {
    return cpf; // Retorna original se não tiver 11 dígitos
  }
  return cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Remove a formatação de um CPF.
 * @param {string} cpf - O CPF formatado.
 * @returns {string} CPF sem formatação (apenas números).
 */
export function limparCPF(cpf) {
  return String(cpf).replace(/\D/g, '');
}

/**
 * Formata um número de CNPJ.
 * @param {string} cnpj - O CNPJ a ser formatado (pode conter não números).
 * @returns {string} CNPJ formatado (ex: 12.345.678/0001-90) ou o original se inválido.
 */
export function formatarCNPJ(cnpj) {
  const cnpjLimpo = String(cnpj).replace(/\D/g, '');
  if (cnpjLimpo.length !== 14) {
    return cnpj; // Retorna original se não tiver 14 dígitos
  }
  return cnpjLimpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Remove a formatação de um CNPJ.
 * @param {string} cnpj - O CNPJ formatado.
 * @returns {string} CNPJ sem formatação (apenas números).
 */
export function limparCNPJ(cnpj) {
  return String(cnpj).replace(/\D/g, '');
}

/**
 * Formata um número de RG (tentativa genérica, focada no formato SP como exemplo).
 * @param {string} rg - O RG a ser formatado (pode conter não números/letras).
 * @returns {string} RG formatado (ex: 12.345.678-X) ou o original se não reconhecido.
 */
export function formatarRG(rg) {
  const rgLimpo = String(rg).replace(/[^\dX]/gi, '').toUpperCase(); // Mantém X ou x, e números
  if (rgLimpo.length === 9) { // Formato SP: XX.XXX.XXX-X
    return `${rgLimpo.substring(0, 2)}.${rgLimpo.substring(2, 5)}.${rgLimpo.substring(5, 8)}-${rgLimpo.substring(8)}`;
  } else if (rgLimpo.length === 8) { // Formato SP antigo ou outros estados: X.XXX.XXX-X ou XX.XXX.XXX
     // Heurística simples, pode precisar de ajustes para outros estados
    if (isNaN(parseInt(rgLimpo.charAt(0)))) { // Se começar com letra (ex: SSP/SP)
        return rgLimpo; // Não formata, pois a lógica é complexa
    }
    // Tenta formato X.XXX.XXX-Y ou XX.XXX.XXY
    if (rgLimpo.length === 8 && !isNaN(parseInt(rgLimpo.charAt(7)))) { // Se o último é número
         return `${rgLimpo.substring(0,1)}.${rgLimpo.substring(1,4)}.${rgLimpo.substring(4,7)}-${rgLimpo.substring(7)}`;
    }
    return `${rgLimpo.substring(0, 2)}.${rgLimpo.substring(2, 5)}.${rgLimpo.substring(5, 8)}`;
  }
  // Para outros tamanhos, retorna o RG limpo ou o original se não for possível limpar
  return rgLimpo || rg;
}

/**
 * Remove a formatação de um RG.
 * @param {string} rg - O RG formatado.
 * @returns {string} RG sem formatação (apenas números e X).
 */
export function limparRG(rg) {
  return String(rg).replace(/[^\dX]/gi, '').toUpperCase();
}

/**
 * Formata um número de processo no padrão CNJ.
 * @param {string} processo - O número do processo (pode conter não números).
 * @returns {string} Processo formatado (NNNNNNN-DD.AAAA.J.TR.OOOO) ou o original se inválido.
 */
export function formatarProcessoCNJ(processo) {
  const processoLimpo = String(processo).replace(/\D/g, '');
  if (processoLimpo.length !== 20) {
    return processo; // Retorna original se não tiver 20 dígitos
  }
  return processoLimpo.replace(/(\d{7})(\d{2})(\d{4})(\d{1})(\d{2})(\d{4})/, '$1-$2.$3.$4.$5.$6');
}

/**
 * Remove a formatação de um processo CNJ.
 * @param {string} processo - O processo formatado.
 * @returns {string} Processo sem formatação (apenas números).
 */
export function limparProcessoCNJ(processo) {
  return String(processo).replace(/\D/g, '');
}

/**
 * Gera um link para consulta de processo no portal e-SAJ do TJSP.
 * @param {string} numeroProcesso - Número do processo (com ou sem formatação CNJ).
 * @param {string} instancia - Instância do processo ('1' para 1º Grau - CPOP, '2' para 2º Grau - CPSG).
 * @returns {string|null} URL para consulta do processo ou null se o número for inválido.
 */
export function gerarLinkConsultaProcessoTJSP(numeroProcesso, instancia) {
  const numeroLimpo = String(numeroProcesso).replace(/\D/g, '');

  if (numeroLimpo.length !== 20) {
    console.warn("Número de processo inválido para consulta TJSP (deve ter 20 dígitos).");
    return null;
  }

  // Extrai as partes do número CNJ
  const n1_7 = numeroLimpo.substring(0, 7);    // NNNNNNN
  const dv_2 = numeroLimpo.substring(7, 9);    // DD
  const ano_4 = numeroLimpo.substring(9, 13);   // AAAA
  const just_1 = numeroLimpo.substring(13, 14); // J
  const trib_2 = numeroLimpo.substring(14, 16); // TR
  const orig_4 = numeroLimpo.substring(16, 20); // OOOO

  const numeroDigitoAnoUnificado = `${n1_7}-${dv_2}.${ano_4}`; // Formato NNNNNNN-DD.AAAA
  const foroNumeroUnificado_param = orig_4; // OOOO
  const numeroCNJCompletoFormatado = `${n1_7}-${dv_2}.${ano_4}.${just_1}.${trib_2}.${orig_4}`;

  let baseUrl = "";
  let params = "";

  if (instancia === '1') { // 1º Grau (CPOP)
    baseUrl = "https://esaj.tjsp.jus.br/cpopg/search.do";
    params = `conversationId=&paginaConsulta=1&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=${numeroDigitoAnoUnificado}&foroNumeroUnificado=${foroNumeroUnificado_param}&dePesquisaNuUnificado=${encodeURIComponent(numeroCNJCompletoFormatado)}`;
  } else if (instancia === '2') { // 2º Grau (CPSG)
    baseUrl = "https://esaj.tjsp.jus.br/cposg/search.do";
    params = `conversationId=&paginaConsulta=1&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=${numeroDigitoAnoUnificado}&foroNumeroUnificado=${foroNumeroUnificado_param}&dePesquisaNuUnificado=${encodeURIComponent(numeroCNJCompletoFormatado)}`;
    // CPSG pode ter parâmetros adicionais, mas o básico é similar ao CPOP para busca por número.
  } else {
    console.warn("Instância inválida para consulta TJSP. Use '1' ou '2'.");
    return null;
  }

  return `${baseUrl}?${params}`;
}

console.log("Facilita documentTools.js loaded.");
