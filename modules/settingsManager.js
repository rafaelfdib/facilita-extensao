// modules/settingsManager.js - Gerenciamento de Configurações da Extensão Facilita

const DEFAULT_SETTINGS = {
  darkMode: false,
  language: 'pt_BR', // Idioma padrão
  customConstants: {},   // Objeto: { NOME_CONSTANTE: "valor", ... }
  reusableVariables: {}, // Objeto: { NOME_VARIAVEL: true, ... } (o valor pode ser só um marcador)
  // Adicionar outras configurações padrão aqui, se necessário
  templatesPerPage: 10,
  defaultSort: "name_asc"
};

const DEFAULT_TEMPLATES = []; // Templates são armazenados separadamente

/**
 * Carrega todas as configurações da extensão (configurações gerais).
 * @returns {Promise<Object>} Objeto com as configurações.
 */
export async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ settings: DEFAULT_SETTINGS }, (result) => {
      // Garante que todos os campos padrão existam, mesmo que o storage esteja vazio ou parcial
      const loadedSettings = { ...DEFAULT_SETTINGS, ...(result.settings || {}) };
      // Validação/limpeza adicional se necessário
      loadedSettings.customConstants = loadedSettings.customConstants && typeof loadedSettings.customConstants === 'object' ? loadedSettings.customConstants : {};
      loadedSettings.reusableVariables = loadedSettings.reusableVariables && typeof loadedSettings.reusableVariables === 'object' ? loadedSettings.reusableVariables : {};
      resolve(loadedSettings);
    });
  });
}

/**
 * Salva as configurações gerais da extensão.
 * @param {Object} settingsToSave - Objeto com as configurações a serem salvas.
 * @returns {Promise<void>}
 */
export async function saveSettings(settingsToSave) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ settings: settingsToSave }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error saving settings:", chrome.runtime.lastError);
        return reject(chrome.runtime.lastError);
      }
      resolve();
    });
  });
}

/**
 * Carrega os templates salvos.
 * @returns {Promise<Array<Object>>} Array de objetos de template.
 */
export async function loadTemplates() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ templates: DEFAULT_TEMPLATES }, (result) => {
      resolve(Array.isArray(result.templates) ? result.templates : DEFAULT_TEMPLATES);
    });
  });
}

/**
 * Salva os templates.
 * @param {Array<Object>} templatesToSave - Array de templates a serem salvos.
 * @returns {Promise<void>}
 */
export async function saveTemplates(templatesToSave) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ templates: templatesToSave }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error saving templates:", chrome.runtime.lastError);
        return reject(chrome.runtime.lastError);
      }
      resolve();
    });
  });
}


/**
 * Adiciona ou atualiza uma constante personalizada.
 * @param {string} name - Nome da constante (ex: "MEU_EMAIL").
 * @param {string} value - Valor da constante.
 * @param {string} format - Formato de saída (ex: "texto", "extenso").
 * @returns {Promise<Object>} Objeto de configurações atualizado.
 */
export async function addOrUpdateCustomConstant(name, value, format = 'texto') {
  const currentSettings = await loadSettings();
  currentSettings.customConstants[name] = { value, format };
  await saveSettings(currentSettings);
  return currentSettings;
}

/**
 * Remove uma constante personalizada.
 * @param {string} name - Nome da constante a ser removida.
 * @returns {Promise<Object>} Objeto de configurações atualizado.
 */
export async function removeCustomConstant(name) {
  const currentSettings = await loadSettings();
  delete currentSettings.customConstants[name];
  await saveSettings(currentSettings);
  return currentSettings;
}

/**
 * Adiciona ou atualiza uma variável reutilizável.
 * O valor aqui é apenas um marcador (true), o valor real é solicitado ao usar.
 * @param {string} name - Nome da variável reutilizável (ex: "NOME_CLIENTE").
 * @returns {Promise<Object>} Objeto de configurações atualizado.
 */
export async function addOrUpdateReusableVariable(name) {
  const currentSettings = await loadSettings();
  currentSettings.reusableVariables[name] = true; // O valor pode ser um simples marcador
  await saveSettings(currentSettings);
  return currentSettings;
}

/**
 * Remove uma variável reutilizável.
 * @param {string} name - Nome da variável a ser removida.
 * @returns {Promise<Object>} Objeto de configurações atualizado.
 */
export async function removeReusableVariable(name) {
  const currentSettings = await loadSettings();
  delete currentSettings.reusableVariables[name];
  await saveSettings(currentSettings);
  return currentSettings;
}

/**
 * Exporta todos os dados da extensão (configurações e templates).
 * @returns {Promise<string>} String JSON com todos os dados.
 */
export async function exportAllData() {
  const settings = await loadSettings();
  const templates = await loadTemplates();
  const allData = {
    settings: settings,
    templates: templates,
    exportVersion: "Facilita-2.0", // Adiciona uma versão para o formato de exportação
    exportedAt: new Date().toISOString()
  };
  return JSON.stringify(allData, null, 2);
}

/**
 * Importa dados para a extensão (configurações e templates).
 * ATENÇÃO: Isto sobrescreverá os dados existentes.
 * @param {string} jsonString - String JSON contendo os dados a serem importados.
 * @returns {Promise<void>}
 * @throws {Error} Se o formato do JSON for inválido.
 */
export async function importAllData(jsonString) {
  let dataToImport;
  try {
    dataToImport = JSON.parse(jsonString);
  } catch (error) {
    console.error("Error parsing JSON for import:", error);
    throw new Error(chrome.i18n.getMessage("feedbackErrorImporting", ["Formato JSON inválido."]));
  }

  if (typeof dataToImport !== 'object' || dataToImport === null) {
    throw new Error(chrome.i18n.getMessage("feedbackErrorImporting", ["Arquivo de backup inválido."]));
  }

  // Valida e usa/mescla configurações
  const newSettings = {
    ...DEFAULT_SETTINGS, // Começa com os padrões para garantir que todos os campos existam
    ...(dataToImport.settings || {}) // Sobrescreve com os dados importados, se existirem
  };
  // Validação mais granular para sub-objetos
  newSettings.customConstants = (typeof newSettings.customConstants === 'object' && newSettings.customConstants !== null) ? newSettings.customConstants : {};
  newSettings.reusableVariables = (typeof newSettings.reusableVariables === 'object' && newSettings.reusableVariables !== null) ? newSettings.reusableVariables : {};


  // Valida e usa templates
  const newTemplates = Array.isArray(dataToImport.templates) ? dataToImport.templates : DEFAULT_TEMPLATES;
  // Validação adicional de cada template (ex: garantir que `id`, `name`, `content` existam)
  const validatedTemplates = newTemplates.map(t => ({
      id: t.id || Date.now().toString() + Math.random().toString(36).substring(2), // Gera ID se faltar
      name: t.name || "Modelo Importado Sem Nome",
      content: t.content || "",
      category: t.category || "",
      tags: Array.isArray(t.tags) ? t.tags.map(tag => String(tag).trim().toLowerCase()).filter(Boolean) : [],
      createdAt: t.createdAt || new Date().toISOString(),
      lastModified: t.lastModified || new Date().toISOString()
  }));


  // Limpa o armazenamento antigo antes de definir o novo para evitar mesclagens indesejadas de chaves de nível superior.
  // No entanto, chrome.storage.sync.clear() limpa TUDO. É mais seguro definir as chaves específicas.
  // await chrome.storage.sync.clear(); // CUIDADO: Isso apaga TUDO.

  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({
      settings: newSettings,
      templates: validatedTemplates
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error importing data:", chrome.runtime.lastError);
        return reject(chrome.runtime.lastError);
      }
      console.log("Data imported successfully.");
      resolve();
    });
  });
}


console.log("Facilita settingsManager.js loaded.");
