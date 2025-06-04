// utils.js - Funções Utilitárias da Extensão Facilita

// Importa as funções mais complexas de processamento de template do módulo dedicado
import {
  processTemplateContentRecursive as actualProcessTemplateContentRecursive,
  escapeHTML as actualEscapeHTML,
  escapeRegExp as actualEscapeRegExp,
  formatarNumeroComModificador,
  processarPlaceholderNumerico, // Embora possa não ser chamada diretamente daqui, é parte do utils original
  processarDataFormatada,
  gerarHTMLPreVisualizacao,    // Se for usada fora do popup.js
  inspecionarPlaceholders,     // Se for usada fora do popup.js
  gerarSugestoesPlaceholders,  // Se for usada fora do popup.js
  clonarTemplate               // Se for usada fora do popup.js
} from './modules/templateManagerUtils.js';

/**
 * Escapa caracteres HTML especiais numa string.
 * Reexporta a função do templateManagerUtils para manter a API.
 * @param {string} str - A string a ser escapada.
 * @returns {string} - A string com caracteres HTML escapados.
 */
export function escapeHTML(str) {
  return actualEscapeHTML(str);
}

/**
 * Escapa caracteres especiais de expressões regulares numa string.
 * Reexporta a função do templateManagerUtils para manter a API.
 * @param {string} string - A string a ser escapada.
 * @returns {string} - A string com caracteres de regex escapados.
 */
export function escapeRegExp(string) {
  return actualEscapeRegExp(string);
}

/**
 * Função de compatibilidade para processTemplateContentRecursive.
 * Mantém a assinatura original para compatibilidade com código existente (se houver),
 * mas delega para a nova implementação em templateManagerUtils.js.
 *
 * @param {string} htmlContent - Conteúdo HTML bruto do template.
 * @param {Array<object>} allTemplates - Lista de todos os modelos salvos.
 * @param {Set<string>} processingStack - Para detecção de ciclo de invocação.
 * @param {object} customConstants - Objeto com as constantes personalizadas e seus valores.
 * @param {Array<string>} reusableVariableNames - Array com os NOMES das variáveis reutilizáveis definidas.
 * @returns {Promise<object>} - Objeto com: processedText, requiredVars, requiredInputs, finalUniqueReusableVarNames.
 */
export async function processTemplateContentRecursive(
    htmlContent,
    allTemplates, // Espera formato: [{id, name, content, ...}]
    processingStack,
    customConstants,       // Espera formato: { "NOME_CONSTANTE": "valor" }
    reusableVariableNames  // Espera formato: ["NOME_VAR_REUTILIZAVEL"]
) {
  // Chama a implementação real do templateManagerUtils.js
  // A função actualProcessTemplateContentRecursive já lida com a obtenção de dados da aba e clipboard.
  return actualProcessTemplateContentRecursive(
      htmlContent,
      allTemplates,
      processingStack,
      customConstants,
      reusableVariableNames
  );
}


/**
 * Função simplificada para processar templates (para uso geral, como no popup.js original do Template-Manager).
 * Esta função adapta a chamada para a processTemplateContentRecursive mais completa.
 * @param {string} content - Conteúdo do template.
 * @param {object} options - Opções de processamento.
 * @param {object} options.variables - Valores para placeholders {VAR:Label} e {INPUT:Prompt}.
 * @param {Array<object>} options.constants - Lista de constantes [{nome, valor}].
 * @param {Array<object>} options.templates - Lista de todos os templates [{id, name, content}].
 * @param {Array<string>} options.reusableVariableNames - Nomes de variáveis reutilizáveis.
 * @param {object} options.reusableVariableValues - Valores para variáveis reutilizáveis.
 * @returns {Promise<string>} - Texto processado.
 */
export async function processTemplateForCopy(content, options = {}) {
  const {
    variables = {}, // Valores para {VAR:Label} e {INPUT:Prompt}
    constants = [], // Array de {nome, valor}
    templates = [], // Array de {id, name, content}
    reusableVariableNames = [], // Array de nomes
    reusableVariableValues = {} // Objeto {NOME_VAR: valor}
  } = options;

  // Converte o array de constantes para o formato de objeto esperado por processTemplateContentRecursive
  const customConstantsObject = constants.reduce((obj, item) => {
    obj[item.nome] = item.valor;
    return obj;
  }, {});

  // Processa o template para obter o texto com placeholders automáticos e de constantes resolvidos,
  // e para identificar as variáveis necessárias.
  const processedResult = await actualProcessTemplateContentRecursive(
    content,
    templates,
    new Set(), // Novo stack de processamento para esta cópia
    customConstantsObject,
    reusableVariableNames
  );

  let finalContent = processedResult.processedText;

  // 1. Substitui Variáveis Reutilizáveis com os valores fornecidos
  processedResult.finalUniqueReusableVarNames.forEach(varName => {
    if (reusableVariableValues.hasOwnProperty(varName)) {
      const placeholderRegex = new RegExp(escapeRegExp(`{${varName}}`), 'g');
      finalContent = finalContent.replace(placeholderRegex, escapeHTML(reusableVariableValues[varName]));
    }
  });

  // 2. Substitui {VAR:Label} e {INPUT:Prompt} com os valores fornecidos em `variables`
  // As chaves em `variables` devem corresponder ao `label` do placeholder.
  [...processedResult.requiredVars, ...processedResult.requiredInputs].forEach(varInfo => {
    const varLabel = varInfo.label; // "Nome do Cliente" de {VAR:Nome do Cliente}
    if (variables.hasOwnProperty(varLabel)) {
      const placeholderRegex = new RegExp(escapeRegExp(varInfo.placeholder), 'g');
      let valueToInsert = variables[varLabel];

      // Verifica se há modificador de formatação
      const placeholderParts = varInfo.placeholder.slice(1, -1).split(':'); // Remove {} e divide por :
      // Ex: VAR:ValorTotal:extenso -> ["VAR", "ValorTotal", "extenso"]
      // Ex: INPUT:Detalhes -> ["INPUT", "Detalhes"]
      if (placeholderParts.length > 2) {
        const modifier = placeholderParts.slice(2).join(':'); // Pega tudo após o segundo ':' como modificador
        valueToInsert = formatarNumeroComModificador(valueToInsert, modifier);
      }

      if (varInfo.placeholder.startsWith("{INPUT:")) {
        // Para {INPUT:...}, o conteúdo pode ser multilinha e já HTML, então não escapa.
        // Ou, se for texto puro, precisa ser convertido para HTML (ex: quebras de linha para <br>)
        // Assumindo que `valueToInsert` para INPUT pode ser texto com quebras de linha.
        const textWithBreaks = escapeHTML(valueToInsert).replace(/\n/g, '<br>');
        finalContent = finalContent.replace(placeholderRegex, textWithBreaks);
      } else {
        finalContent = finalContent.replace(placeholderRegex, escapeHTML(valueToInsert));
      }
    }
  });

  return finalContent;
}


// Reexporta funções que podem ser úteis globalmente, se necessário,
// ou podem ser chamadas diretamente de seus módulos.
export {
  formatarNumeroComModificador,
  processarDataFormatada
};

console.log("Facilita utils.js loaded.");
