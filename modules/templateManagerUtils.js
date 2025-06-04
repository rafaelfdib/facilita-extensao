// modules/templateManagerUtils.js - Facilita Extensão
// Lógica avançada para processamento de templates.

// Importa a biblioteca extenso.js (deve estar globalmente acessível ou importada no popup.js e passada)
// Para uso dentro deste módulo, assumimos que `extenso` está no escopo global ou será injetado.

/**
 * Escapa caracteres HTML especiais numa string.
 * @param {string} str - A string a ser escapada.
 * @returns {string} - A string com caracteres HTML escapados.
 */
export function escapeHTML(str) {
  if (typeof str !== 'string') return str === null || str === undefined ? '' : String(str);
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Escapa caracteres especiais de expressões regulares numa string.
 * @param {string} string - A string a ser escapada.
 * @returns {string} - A string com caracteres de regex escapados.
 */
export function escapeRegExp(string) {
  if (typeof string !== 'string') return "";
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& significa a string correspondente inteira
}

/**
 * Converte um número para sua forma escrita por extenso usando a biblioteca extenso.js.
 * @param {number|string} numero - O número a ser convertido.
 * @param {object} [opcoes={}] - Opções de formatação.
 * @param {boolean} [opcoes.moeda=false] - Se true, formata como valor monetário em Reais.
 * @param {boolean} [opcoes.feminino=false] - Se true, usa gênero feminino para números.
 * @returns {string} O número por extenso ou uma mensagem de erro.
 */
function numeroParaExtensoLib(numero, opcoes = {}) {
  try {
    if (typeof extenso !== 'function') {
      console.warn('Biblioteca extenso.js não carregada. A conversão para extenso não funcionará.');
      return String(numero) + (opcoes.moeda ? ' (extenso.js não disponível)' : '');
    }
    const { moeda = false, feminino = false } = opcoes;
    let extensoOptions = {};
    if (moeda) {
      extensoOptions = { mode: 'currency', currency: { type: 'BRL' } };
    } else {
      extensoOptions = { number: { gender: feminino ? 'f' : 'm' } };
    }
    return extenso(String(numero).replace('.',','), extensoOptions); // extenso.js espera vírgula como decimal
  } catch (error) {
    console.error("Erro ao converter número para extenso:", error);
    return `[Erro Extenso: ${error.message}]`;
  }
}


/**
 * Formata um valor numérico com base em um modificador.
 * @param {number|string} valor - O valor a ser formatado.
 * @param {string} modificadorCompleto - O modificador completo (ex: "extenso", "decimal(2)", "moeda(USD,2)").
 * @returns {string} O valor formatado.
 */
export function formatarNumeroComModificador(valor, modificadorCompleto) {
  const valorNumerico = parseFloat(String(valor).replace(',', '.')); // Garante que o valor seja numérico

  if (isNaN(valorNumerico) && !modificadorCompleto.startsWith('extenso')) { // Permite extenso para strings numéricas
    return String(valor); // Retorna o valor original se não for um número (exceto para extenso)
  }

  const partesModificador = modificadorCompleto.match(/^([a-z_]+)(?:\(([^)]+)\))?$/i);
  if (!partesModificador) return String(valor); // Modificador inválido

  const tipoModificador = partesModificador[1].toLowerCase();
  const paramsString = partesModificador[2];
  const params = paramsString ? paramsString.split(',').map(p => p.trim()) : [];

  switch (tipoModificador) {
    case 'extenso':
      return numeroParaExtensoLib(valorNumerico, { moeda: false, feminino: false });
    case 'extenso_moeda':
      return numeroParaExtensoLib(valorNumerico, { moeda: true, feminino: false });
    case 'extenso_f':
      return numeroParaExtensoLib(valorNumerico, { moeda: false, feminino: true });
    case 'decimal':
      const casasDecimais = params[0] ? parseInt(params[0], 10) : 2;
      return valorNumerico.toLocaleString('pt-BR', { minimumFractionDigits: casasDecimais, maximumFractionDigits: casasDecimais });
    case 'milhar':
      return valorNumerico.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 20 }); // Mostra decimais se houver
    case 'moeda':
      const moedaCodigo = params[0] || 'BRL';
      const casasMoeda = params[1] ? parseInt(params[1], 10) : 2;
      try {
        return valorNumerico.toLocaleString('pt-BR', {
          style: 'currency',
          currency: moedaCodigo.toUpperCase(),
          minimumFractionDigits: casasMoeda,
          maximumFractionDigits: casasMoeda
        });
      } catch (e) {
        console.warn(`Código de moeda inválido: ${moedaCodigo}. Usando BRL.`);
        return valorNumerico.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: casasMoeda, maximumFractionDigits: casasMoeda });
      }
    case 'porcentagem':
      const casasPct = params[0] ? parseInt(params[0], 10) : 2;
      return (valorNumerico * 100).toLocaleString('pt-BR', { minimumFractionDigits: casasPct, maximumFractionDigits: casasPct }) + '%';
    default:
      return String(valor);
  }
}

/**
 * Processa placeholders de data com formato personalizado.
 * @param {string} formato - O formato desejado (ex: "DD/MM/YYYY 'às' HH:mm").
 * @returns {string} A data formatada.
 */
export function processarDataFormatada(formato) {
  const agora = new Date();
  let dataFormatada = formato;

  // Mapeamento de tokens para Intl.DateTimeFormat options
  const tokens = {
    'YYYY': { year: 'numeric' },
    'YY': { year: '2-digit' },
    'MMMM': { month: 'long' },
    'MMM': { month: 'short' },
    'MM': { month: '2-digit' },
    'M': { month: 'numeric' },
    'DD': { day: '2-digit' },
    'D': { day: 'numeric' },
    'dddd': { weekday: 'long' },
    'ddd': { weekday: 'short' },
    'HH': { hour: '2-digit', hour12: false },
    'H': { hour: 'numeric', hour12: false },
    'hh': { hour: '2-digit', hour12: true },
    'h': { hour: 'numeric', hour12: true },
    'mm': { minute: '2-digit' },
    'm': { minute: 'numeric' },
    'ss': { second: '2-digit' },
    's': { second: 'numeric' },
    'A': { dayPeriod: 'narrow', hour12: true }, // AM/PM
  };

  // Substitui os tokens mais longos primeiro para evitar conflitos (ex: MMMM antes de MM)
  Object.keys(tokens).sort((a, b) => b.length - a.length).forEach(token => {
    if (dataFormatada.includes(token)) {
      let valor;
      // Casos especiais para AM/PM
      if (token === 'A') {
        const tempHora = agora.getHours();
        valor = tempHora < 12 ? 'AM' : 'PM';
      } else {
        try {
            valor = new Intl.DateTimeFormat('pt-BR', tokens[token]).format(agora);
        } catch (e) {
            console.warn(`Erro ao formatar token de data '${token}':`, e);
            valor = token; // Mantém o token se houver erro
        }
      }
      dataFormatada = dataFormatada.replace(new RegExp(escapeRegExp(token), 'g'), valor);
    }
  });
  return dataFormatada;
}


/**
 * Processa o conteúdo HTML de um template de forma RECURSIVA.
 * @param {string} htmlContent - Conteúdo HTML bruto do template.
 * @param {Array<object>} allTemplates - Lista de todos os modelos salvos [{id, name, content}].
 * @param {Set<string>} processingStack - Para detecção de ciclo de invocação (passar new Set() na chamada inicial).
 * @param {object} customConstants - Objeto com as constantes personalizadas e seus valores { NOME_CONSTANTE: {value, format}, ... }.
 * @param {Array<string>} reusableVariableNames - Array com os NOMES das variáveis reutilizáveis definidas.
 * @returns {Promise<object>} - Objeto com: processedText, requiredVars, requiredInputs, finalUniqueReusableVarNames.
 */
export async function processTemplateContentRecursive(
    htmlContent,
    allTemplates,
    processingStack,
    customConstants,
    reusableVariableNames
) {
  const MAX_RECURSION_DEPTH = 10;
  if (processingStack.size > MAX_RECURSION_DEPTH) {
    throw new Error(chrome.i18n.getMessage("errorMaxInvocationDepth") || "Maximum template invocation depth reached.");
  }

  try {
    let currentText = htmlContent || "";

    // --- PASSO 1: Substituir Constantes Personalizadas ---
    if (customConstants && typeof customConstants === 'object') {
      for (const constName in customConstants) {
        const placeholderRegex = new RegExp(escapeRegExp(`{${constName}}`), "g");
        if (placeholderRegex.test(currentText)) {
          const constData = customConstants[constName];
          let constValue = constData.value;
          if (constData.format && constData.format !== 'texto') {
            constValue = formatarNumeroComModificador(constValue, constData.format);
          }
          currentText = currentText.replace(placeholderRegex, escapeHTML(constValue));
        }
      }
    }

    // --- PASSO 2: Substituir Placeholders Automáticos ---
    let pageUrl = `[${chrome.i18n.getMessage("pageDataUnavailable") || "Page data unavailable"}]`;
    let pageTitle = `[${chrome.i18n.getMessage("pageDataUnavailable") || "Page data unavailable"}]`;
    let clipboardText = `[${chrome.i18n.getMessage("clipboardDataUnavailable") || "Clipboard data unavailable"}]`;

    try {
      if (chrome.tabs && typeof chrome.tabs.query === 'function') {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab) {
          pageUrl = (activeTab.url && !activeTab.url.startsWith('chrome:') && !activeTab.url.startsWith('edge:')) ? activeTab.url : pageUrl;
          pageTitle = activeTab.title || pageTitle;
        }
      }
    } catch (e) { console.warn("Facilita (templateManagerUtils): Error getting tab data:", e); }

    try {
      if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        const permission = await navigator.permissions.query({ name: "clipboard-read" });
        if (permission.state === "granted" || permission.state === "prompt") {
          clipboardText = await navigator.clipboard.readText();
        } else {
          clipboardText = `[${chrome.i18n.getMessage("clipboardPermissionDenied") || "Clipboard permission denied"}]`;
        }
      }
    } catch (e) {
      console.warn("Facilita (templateManagerUtils): Error reading clipboard:", e);
      clipboardText = `[${chrome.i18n.getMessage("errorReadingClipboard") || "Error reading clipboard"}]`;
    }

    const now = new Date();
    const uiLang = chrome.i18n.getUILanguage ? chrome.i18n.getUILanguage() : (navigator.language || "en-US");

    const autoReplacements = {
      "\\{DATA\\}": now.toLocaleDateString(uiLang),
      "\\{HORA\\}": now.toLocaleTimeString(uiLang, { hour: "2-digit", minute: "2-digit" }),
      "\\{DATA_HORA\\}": now.toLocaleString(uiLang),
      "\\{DD/MM/YYYY\\}": now.toLocaleDateString(uiLang, { day: "2-digit", month: "2-digit", year: "numeric" }),
      "\\{HH:mm:ss\\}": now.toLocaleTimeString(uiLang),
      "\\{SEMANA\\}": now.toLocaleDateString(uiLang, { weekday: "long" }),
      "\\{URL\\}": escapeHTML(pageUrl),
      "\\{TITLE\\}": escapeHTML(pageTitle),
      "\\{CLIPBOARD\\}": escapeHTML(clipboardText),
    };

    for (const placeholderRegexStr in autoReplacements) {
      currentText = currentText.replace(new RegExp(placeholderRegexStr, "g"), autoReplacements[placeholderRegexStr]);
    }

    // Substituir placeholders de data formatada: {DATA:format(...)}
    const dataFormatRegex = /\{DATA:format\(([^)]+)\)\}/g;
    let dataMatch;
    while ((dataMatch = dataFormatRegex.exec(currentText)) !== null) {
        const formato = dataMatch[1];
        currentText = currentText.replace(dataMatch[0], processarDataFormatada(formato));
    }


    // --- PASSO 3: Resolver Invocação de Outros Templates {{NomeDoModelo}} ---
    const templateInvocationRegex = /\{\{([^}]+)\}\}/g;
    let resolvedText = "";
    let lastIndex = 0;
    let match;
    let accumulatedRequiredVars = [];
    let accumulatedRequiredInputs = [];
    let accumulatedReusableVarNames = new Set();

    templateInvocationRegex.lastIndex = 0;
    while ((match = templateInvocationRegex.exec(currentText)) !== null) {
      resolvedText += currentText.substring(lastIndex, match.index);
      const templateNameToInvoke = match[1].trim();
      const templateToInvoke = allTemplates.find(t => t.name.toLowerCase() === templateNameToInvoke.toLowerCase());

      if (templateToInvoke) {
        if (processingStack.has(templateToInvoke.id)) {
          throw new Error(chrome.i18n.getMessage("errorInvocationCycle", [templateNameToInvoke]) || `Invocation cycle detected: "${templateNameToInvoke}".`);
        }
        processingStack.add(templateToInvoke.id);
        const invokedResult = await processTemplateContentRecursive(
          templateToInvoke.content, allTemplates, processingStack, customConstants, reusableVariableNames
        );
        processingStack.delete(templateToInvoke.id);

        resolvedText += invokedResult.processedText;
        accumulatedRequiredVars.push(...invokedResult.requiredVars);
        accumulatedRequiredInputs.push(...invokedResult.requiredInputs);
        invokedResult.finalUniqueReusableVarNames.forEach(name => accumulatedReusableVarNames.add(name));
      } else {
        resolvedText += match[0]; // Manter placeholder se não encontrar
        console.warn(chrome.i18n.getMessage("warningInvokedTemplateNotFound", [templateNameToInvoke]) || `Invoked template "{{${templateNameToInvoke}}}" not found.`);
      }
      lastIndex = templateInvocationRegex.lastIndex;
    }
    resolvedText += currentText.substring(lastIndex);
    currentText = resolvedText;

    // --- PASSO 4: Identificar Placeholders de Variáveis ({VAR:...}, {INPUT:...}, {NOME_REUTILIZAVEL}) ---
    // Regex para {VAR:Label:modificador} ou {VAR:Label}
    const varRegex = /\{VAR:([^:}]+)(?::([^}]+))?\}/g;
    // Regex para {INPUT:Instrucao:modificador} ou {INPUT:Instrucao}
    const inputRegex = /\{INPUT:([^:}]+)(?::([^}]+))?\}/g;


    const currentRequiredVars = [];
    const currentRequiredInputs = [];

    varRegex.lastIndex = 0;
    while ((match = varRegex.exec(currentText)) !== null) {
      currentRequiredVars.push({ placeholder: match[0], label: match[1].trim(), modifier: match[2] ? match[2].trim() : null });
    }
    inputRegex.lastIndex = 0;
    while ((match = inputRegex.exec(currentText)) !== null) {
      currentRequiredInputs.push({ placeholder: match[0], label: match[1].trim(), modifier: match[2] ? match[2].trim() : null });
    }

    if (reusableVariableNames && reusableVariableNames.length > 0) {
      reusableVariableNames.forEach(rVarName => {
        const placeholderRegex = new RegExp(escapeRegExp(`{${rVarName}}`), "g");
        if (placeholderRegex.test(currentText)) {
          accumulatedReusableVarNames.add(rVarName);
        }
      });
    }

    // Consolidação dos Resultados
    const finalRequiredVarsMap = new Map();
    [...accumulatedRequiredVars, ...currentRequiredVars].forEach(v => finalRequiredVarsMap.set(v.placeholder, v));

    const finalRequiredInputsMap = new Map();
    [...accumulatedRequiredInputs, ...currentRequiredInputs].forEach(i => finalRequiredInputsMap.set(i.placeholder, i));

    return {
      processedText: currentText,
      requiredVars: Array.from(finalRequiredVarsMap.values()),
      requiredInputs: Array.from(finalRequiredInputsMap.values()),
      finalUniqueReusableVarNames: Array.from(accumulatedReusableVarNames)
    };

  } catch (error) {
    const appName = chrome.i18n.getMessage("extensionName") || "Facilita";
    console.error(`${appName} (templateManagerUtils): ${chrome.i18n.getMessage("errorGenericProcessing") || "Error during recursive template processing."}`, error);
    throw error;
  }
}


/**
 * Gera HTML para pré-visualização de template.
 * @param {object} template - O objeto do template.
 * @param {object} variaveis - Valores para as variáveis do template.
 * @param {Array<object>} todosTemplates - Lista de todos os templates para resolver invocações.
 * @param {object} constantes - Constantes personalizadas.
 * @param {Array<string>} nomesVariaveisReutilizaveis - Nomes de variáveis reutilizáveis.
 * @returns {Promise<string>} HTML da pré-visualização.
 */
export async function gerarHTMLPreVisualizacao(template, variaveis, todosTemplates, constantes, nomesVariaveisReutilizaveis) {
  try {
    const resultadoProcessado = await processTemplateContentRecursive(
      template.content,
      todosTemplates,
      new Set(),
      constantes,
      nomesVariaveisReutilizaveis
    );

    let conteudoFinal = resultadoProcessado.processedText;

    // Substitui as variáveis {VAR:Label} e {INPUT:Prompt} com os valores fornecidos
    [...resultadoProcessado.requiredVars, ...resultadoProcessado.requiredInputs].forEach(varInfo => {
      const valor = variaveis[varInfo.label]; // Assume que 'variaveis' é um objeto {label: valor}
      if (valor !== undefined) {
        let valorFormatado = valor;
        if (varInfo.modifier) {
          valorFormatado = formatarNumeroComModificador(valor, varInfo.modifier);
        }
        conteudoFinal = conteudoFinal.replace(new RegExp(escapeRegExp(varInfo.placeholder), 'g'), escapeHTML(valorFormatado));
      }
    });

    // Substitui as variáveis reutilizáveis {NOME_VARIAVEL}
    resultadoProcessado.finalUniqueReusableVarNames.forEach(varName => {
        const valor = variaveis[varName]; // Assume que 'variaveis' também contém valores para reutilizáveis
        if (valor !== undefined) {
            // As variáveis reutilizáveis não têm modificadores na definição do placeholder {NOME_VARIAVEL}
            // A formatação delas viria da definição da constante/variável, se aplicável (já tratado no passo 1)
            conteudoFinal = conteudoFinal.replace(new RegExp(escapeRegExp(`{${varName}}`), 'g'), escapeHTML(valor));
        }
    });


    return `
      <div class="template-preview-modal">
        <h3>${escapeHTML(template.name)}</h3>
        <div class="preview-content ql-snow"><div class="ql-editor">${conteudoFinal}</div></div>
      </div>
    `;
  } catch (error) {
    console.error("Erro ao gerar pré-visualização:", error);
    return `<p class="error-message">Erro ao gerar pré-visualização: ${escapeHTML(error.message)}</p>`;
  }
}

/**
 * Analisa o conteúdo de um template e retorna informações sobre os placeholders utilizados.
 * @param {string} conteudo - Conteúdo HTML do template.
 * @param {object} constantesDisponiveis - Objeto de constantes { NOME: {valor, formato}, ... }.
 * @param {Array<object>} templatesDisponiveis - Array de templates [{id, name, content}, ...].
 * @param {Array<string>} variaveisReutilizaveisDisponiveis - Array de nomes de variáveis reutilizáveis.
 * @returns {object} Objeto com informações dos placeholders.
 */
export function inspecionarPlaceholders(conteudo, constantesDisponiveis, templatesDisponiveis, variaveisReutilizaveisDisponiveis) {
  const resultado = {
    automaticos: new Set(),
    constantes: { definidas: new Set(), indefinidas: new Set() },
    variaveis: new Set(), // Armazena o placeholder completo {VAR:Label:mod}
    inputs: new Set(),    // Armazena o placeholder completo {INPUT:Label:mod}
    reutilizaveis: new Set(), // Armazena nomes de variáveis reutilizáveis encontradas
    invocacoes: { existentes: new Set(), inexistentes: new Set() }
  };
  if (typeof conteudo !== 'string') return resultado;

  let match;

  // 1. Placeholders Automáticos e Data Formatada
  const automaticosBaseRegex = /\{(DATA|HORA|DATA_HORA|DD\/MM\/YYYY|HH:mm:ss|SEMANA|URL|TITLE|CLIPBOARD)\}/g;
  while ((match = automaticosBaseRegex.exec(conteudo)) !== null) {
    resultado.automaticos.add(match[1]);
  }
  const dataFormatadaRegex = /\{DATA:format\(([^)]+)\)\}/g;
  while ((match = dataFormatadaRegex.exec(conteudo)) !== null) {
    resultado.automaticos.add(`DATA:format(${match[1]})`);
  }

  // 2. Constantes e Variáveis Reutilizáveis (placeholders genéricos como {NOME_ALGO})
  const genericoPlaceholderRegex = /\{([A-Z0-9_]+)\}/g;
  while ((match = genericoPlaceholderRegex.exec(conteudo)) !== null) {
    const nomePlaceholder = match[1];
    // Ignora se for um placeholder automático já capturado
    if (!resultado.automaticos.has(nomePlaceholder)) {
      if (constantesDisponiveis && constantesDisponiveis.hasOwnProperty(nomePlaceholder)) {
        resultado.constantes.definidas.add(nomePlaceholder);
      } else if (variaveisReutilizaveisDisponiveis && variaveisReutilizaveisDisponiveis.includes(nomePlaceholder)) {
        resultado.reutilizaveis.add(nomePlaceholder);
      } else {
        // Pode ser uma constante não definida ou um nome de variável reutilizável não definido
        resultado.constantes.indefinidas.add(nomePlaceholder);
      }
    }
  }

  // 3. Variáveis {VAR:Label:modificador} ou {VAR:Label}
  const varRegex = /\{VAR:([^:}]+)(?::([^}]+))?\}/g;
  while ((match = varRegex.exec(conteudo)) !== null) {
    resultado.variaveis.add(match[0]);
  }

  // 4. Inputs {INPUT:Instrucao:modificador} ou {INPUT:Instrucao}
  const inputRegex = /\{INPUT:([^:}]+)(?::([^}]+))?\}/g;
  while ((match = inputRegex.exec(conteudo)) !== null) {
    resultado.inputs.add(match[0]);
  }

  // 5. Invocações de Templates {{NomeDoModelo}}
  const invocacoesRegex = /\{\{([^}]+)\}\}/g;
  while ((match = invocacoesRegex.exec(conteudo)) !== null) {
    const nomeTemplateInvocado = match[1].trim();
    if (templatesDisponiveis && templatesDisponiveis.some(t => t.name === nomeTemplateInvocado)) {
      resultado.invocacoes.existentes.add(nomeTemplateInvocado);
    } else {
      resultado.invocacoes.inexistentes.add(nomeTemplateInvocado);
    }
  }

  // Converte Sets para Arrays para o resultado final
  return {
    automaticos: Array.from(resultado.automaticos),
    constantes: {
      definidas: Array.from(resultado.constantes.definidas),
      indefinidas: Array.from(resultado.constantes.indefinidas)
    },
    variaveis: Array.from(resultado.variaveis),
    inputs: Array.from(resultado.inputs),
    reutilizaveis: Array.from(resultado.reutilizaveis),
    invocacoes: {
      existentes: Array.from(resultado.invocacoes.existentes),
      inexistentes: Array.from(resultado.invocacoes.inexistentes)
    }
  };
}


/**
 * Gera sugestões de placeholders com base no texto parcial digitado.
 * @param {string} textoParcial - O texto digitado até o momento no editor.
 * @param {object} constantesDisponiveis - Objeto de constantes { NOME: {valor, formato}, ... }.
 * @param {Array<object>} templatesDisponiveis - Array de templates [{id, name, content}, ...].
 * @param {Array<string>} variaveisReutilizaveisDisponiveis - Array de nomes de variáveis reutilizáveis.
 * @returns {Array<object>} Array de objetos de sugestão [{texto, descricao}].
 */
export function gerarSugestoesPlaceholders(textoParcial, constantesDisponiveis, templatesDisponiveis, variaveisReutilizaveisDisponiveis) {
  const sugestoes = [];
  const lowerTextoParcial = textoParcial.toLowerCase();

  // Sugestões automáticas e de data formatada
  if (lowerTextoParcial.endsWith('{') || lowerTextoParcial.includes('{da') || lowerTextoParcial.includes('{ho') || lowerTextoParcial.includes('{ur') || lowerTextoParcial.includes('{ti') || lowerTextoParcial.includes('{cl') || lowerTextoParcial.includes('{se')) {
    const auto = [
      { texto: '{DATA}', descricaoKey: 'titleDATA' }, { texto: '{HORA}', descricaoKey: 'titleHORA' },
      { texto: '{DATA_HORA}', descricaoKey: 'titleDATA_HORA' }, { texto: '{DD/MM/YYYY}', descricaoKey: 'titleDDMMYYYY' },
      { texto: '{HH:mm:ss}', descricaoKey: 'titleHHMMSS' }, { texto: '{SEMANA}', descricaoKey: 'titleSEMANA' },
      { texto: '{URL}', descricaoKey: 'titleURL' }, { texto: '{TITLE}', descricaoKey: 'titleTITLE' },
      { texto: '{CLIPBOARD}', descricaoKey: 'titleCLIPBOARD' },
      { texto: '{DATA:format(DD/MM/YYYY)}', descricao: 'Data formatada (dia/mês/ano)' },
      { texto: '{DATA:format(YYYY-MM-DD)}', descricao: 'Data formatada (ano-mês-dia)' },
      { texto: '{DATA:format(DD de MMMM de YYYY)}', descricao: 'Data por extenso (Ex: 02 de junho de 2025)' }
    ];
    auto.forEach(s => {
      if (s.texto.toLowerCase().includes(lowerTextoParcial.slice(lowerTextoParcial.lastIndexOf('{') + 1))) {
        sugestoes.push({ texto: s.texto, descricao: s.descricao || chrome.i18n.getMessage(s.descricaoKey) || s.texto });
      }
    });
  }

  // Sugestões de Constantes e Variáveis Reutilizáveis (quando digita {NOME_...)
  if (lowerTextoParcial.endsWith('{') || /\{[A-Z0-9_]*$/i.test(lowerTextoParcial)) {
    const currentTyped = lowerTextoParcial.slice(lowerTextoParcial.lastIndexOf('{') + 1).toUpperCase();
    if (constantesDisponiveis) {
      Object.keys(constantesDisponiveis).forEach(nomeConstante => {
        if (nomeConstante.startsWith(currentTyped)) {
          sugestoes.push({
            texto: `{${nomeConstante}}`,
            descricao: `${chrome.i18n.getMessage("itemTypeConstant") || "Constante"}: ${constantesDisponiveis[nomeConstante].value.substring(0,30)}...`
          });
        }
      });
    }
    if (variaveisReutilizaveisDisponiveis) {
      variaveisReutilizaveisDisponiveis.forEach(nomeVar => {
        if (nomeVar.startsWith(currentTyped)) {
          sugestoes.push({
            texto: `{${nomeVar}}`,
            descricao: `${chrome.i18n.getMessage("itemTypeReusableVariable") || "Variável Reutilizável"}`
          });
        }
      });
    }
  }


  // Sugestões para {VAR: ou {INPUT:
  if (lowerTextoParcial.includes('{var:') || lowerTextoParcial.includes('{input:')) {
    const tipo = lowerTextoParcial.includes('{var:') ? "VAR" : "INPUT";
    const base = `{${tipo}:`;
    const exemplos = [
      `${base}Nome}`, `${base}Email}`, `${base}Telefone}`,
      `${base}Valor:decimal(2)}`, `${base}DataEntrega:format(DD/MM/YYYY)}`,
      `${base}Observacoes}`
    ];
    exemplos.forEach(ex => {
      if (ex.toLowerCase().startsWith(lowerTextoParcial)) {
         sugestoes.push({ texto: ex, descricao: `${tipo === "VAR" ? "Variável" : "Input"}: ${ex.substring(base.length, ex.length-1)}` });
      }
    });
  }

  // Sugestões para {{NomeTemplate}}
  if (lowerTextoParcial.includes('{{')) {
    const typedTemplateName = lowerTextoParcial.slice(lowerTextoParcial.lastIndexOf('{{') + 2).toLowerCase();
    if (templatesDisponiveis) {
      templatesDisponiveis.forEach(template => {
        if (template.name.toLowerCase().startsWith(typedTemplateName)) {
          sugestoes.push({ texto: `{{${template.name}}}`, descricao: `Template: ${template.name}` });
        }
      });
    }
  }
  // Remove duplicatas baseadas no 'texto' da sugestão
  return Array.from(new Map(sugestoes.map(s => [s.texto, s])).values());
}


/**
 * Clona um template existente, gerando um novo ID e atualizando datas.
 * @param {object} templateParaClonar - O objeto do template a ser clonado.
 * @param {string} [novoNomeSugerido=null] - Nome sugerido para o clone. Se null, usa "Nome Original (Cópia)".
 * @returns {object} O objeto do template clonado.
 */
export function clonarTemplate(templateParaClonar, novoNomeSugerido = null) {
  const clone = JSON.parse(JSON.stringify(templateParaClonar)); // Cópia profunda

  clone.id = Date.now().toString() + "_" + Math.random().toString(36).substring(2, 9); // Novo ID único
  clone.name = novoNomeSugerido || `${templateParaClonar.name} (${chrome.i18n.getMessage("textCopy") || "Cópia"})`;
  const agoraISO = new Date().toISOString();
  clone.createdAt = agoraISO;
  clone.lastModified = agoraISO;
  // Opcional: Limpar estatísticas de uso ou outras informações específicas da instância original
  // delete clone.usageCount;

  return clone;
}
