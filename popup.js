// popup.js - Script principal para a extensão Facilita
// Unifica funcionalidades do Template Manager e Busca CEP, e adiciona novas.

// Importação de Módulos ES6
import {
  processTemplateContentRecursive,
  escapeHTML,
  escapeRegExp,
  formatarNumeroComModificador,
  processarDataFormatada,
  // gerarHTMLPreVisualizacao, // Implementado diretamente ou não usado no escopo global do popup
  inspecionarPlaceholders,
  // gerarSugestoesPlaceholders, // Será implementado ou chamado de forma diferente
  clonarTemplate
} from './modules/templateManagerUtils.js';

import {
  numeroParaExtenso,
  limparTexto,
  localizarESubstituir,
  ordenarLinhas,
  contarElementos
} from './modules/textTools.js';

import {
  formatarCPF, formatarCNPJ, formatarRG, formatarProcessoCNJ,
  limparCPF, limparCNPJ, limparRG, limparProcessoCNJ,
  gerarLinkConsultaProcessoTJSP
} from './modules/documentTools.js';

import {
  buscarEnderecoPorCEP,
  buscarCEPPorEndereco
} from './modules/cepUtils.js';

import {
  carregarLinksSalvos,
  adicionarLinkSalvo,
  removerLinkSalvo,
  editarLinkSalvo,
  obterLinksPredefinidos
} from './modules/linkManager.js';

import {
  loadSettings,
  saveSettings,
  loadTemplates,
  saveTemplates,
  addOrUpdateCustomConstant,
  removeCustomConstant,
  addOrUpdateReusableVariable,
  removeReusableVariable,
  exportAllData,
  importAllData
} from './modules/settingsManager.js';

// --- Constantes e Variáveis Globais ---
const QUILL_TOOLBAR_OPTIONS_FULL = [
  [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
  ['bold', 'italic', 'underline', 'strike', 'blockquote', 'code-block'],
  [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'indent': '-1'}, { 'indent': '+1' }],
  [{ 'align': [] }],
  ['link'], // 'image' e 'video' são geralmente melhor tratados com input de URL, não diretamente no Quill para templates simples.
  [{ 'color': [] }, { 'background': [] }],
  [{ 'font': [] }],
  ['clean']
];

let quillEditorCreate;
let quillEditorEditModal;

let currentTemplates = [];
let currentSettings = { // Default settings, will be overwritten by loaded ones
    darkMode: false,
    language: 'pt_BR', // Default language
    customConstants: {},
    reusableVariables: {},
    templatesPerPage: 10,
    defaultSort: "name_asc"
};
let currentLinksSalvos = [];
let allUniqueTagsForSuggestions = []; // Para autocompletar tags

let variableModalResolve = null;
let variableModalReject = null;
let contentForVariableModal = ""; // Armazena o conteúdo base quando o modal de variáveis é aberto
let currentTemplateForVariableModal = null; // Armazena o template original para o modal de preview

const TEMPLATES_PER_PAGE = 10; // Default, pode ser sobrescrito por currentSettings.templatesPerPage
let currentlyDisplayedTemplatesCount = 0;
let currentFilteredAndSortedTemplates = []; // Cache dos templates filtrados e ordenados
let selectedTemplateIds = new Set(); // Para ações em massa
let activeCategoryFilter = "all"; // Filtro de categoria ativo
let currentSortCriteria = "name_asc"; // Critério de ordenação ativo

// --- Seletores do DOM (agrupados por funcionalidade) ---
// IDs aqui devem corresponder EXATAMENTE aos IDs no popup.html
const DOM = {
  // Geral
  themeToggle: document.getElementById('themeToggle'),
  themeIconSun: document.getElementById('themeIconSun'),
  themeIconMoon: document.getElementById('themeIconMoon'),
  feedbackGlobalArea: document.getElementById('feedbackGlobalArea'), // Adicionado ao HTML

  // Abas e Sub-abas
  mainTabsContainer: document.querySelector('nav.main-tabs'),
  allMainTabLinks: document.querySelectorAll('.tablinks'),
  allMainTabContents: document.querySelectorAll('.tabcontent'),
  allSubTabLinks: document.querySelectorAll('.sub-tablinks'),
  allSubTabContents: document.querySelectorAll('.sub-tabcontent'),

  // Aba Modelos > Criar Modelo
  createTemplateForm: document.getElementById('templateForm'),
  templateNameInput: document.getElementById('templateName'),
  templateCategoryInput: document.getElementById('templateCategory'),
  templateTagsInput: document.getElementById('templateTags'),
  editorQuillCreateDiv: document.getElementById('editorQuill'),
  createEditorCounter: document.getElementById('createEditorCounter'),
  dynamicFieldsContainerCreate: document.getElementById('dynamicFieldsContainerCreate'),
  btnInspectPlaceholders: document.getElementById('btnInspecionarPlaceholders'),
  feedbackAreaCreate: document.getElementById('feedbackAreaCreate'),
  btnClearCreateForm: document.getElementById('btnClearCreateForm'),

  // Aba Modelos > Meus Modelos
  searchInputTemplates: document.getElementById('searchInputTemplates'), // Corrigido de searchInput para searchInputTemplates
  tagSearchInputTemplates: document.getElementById('tagSearchInput'), // Corrigido
  tagSuggestionsTemplatesDiv: document.getElementById('tagSuggestions'), // Corrigido
  sortOptionsTemplates: document.getElementById('sortOptions'), // Corrigido
  categoriesFilterTemplatesDiv: document.getElementById('categoriesFilter'), // Corrigido
  templatesListDiv: document.getElementById('templatesList'), // Corrigido
  loadMoreTemplatesContainer: document.getElementById('loadMoreContainer'), // Corrigido
  loadMoreTemplatesBtn: document.getElementById('loadMoreBtn'), // Corrigido
  feedbackAreaListTemplates: document.getElementById('feedbackAreaList'), // Corrigido
  bulkActionsToolbar: document.getElementById('bulkActionsToolbar'),
  bulkSelectedCountSpan: document.getElementById('bulkSelectedCount'), // Adicionado ao HTML
  bulkSelectAllBtn: document.getElementById('bulkSelectAllBtn'),
  bulkDeselectAllBtn: document.getElementById('bulkDeselectAllBtn'),
  bulkDeleteBtn: document.getElementById('bulkDeleteBtn'),
  bulkCategoryInput: document.getElementById('bulkCategoryInput'),
  bulkAddCategoryBtn: document.getElementById('bulkAddCategoryBtn'),
  bulkTagsInput: document.getElementById('bulkTagsInput'),
  bulkAddTagsBtn: document.getElementById('bulkAddTagsBtn'),
  bulkActionsHeadingElement: document.getElementById('bulkActionsHeadingElement'), // Adicionado ao HTML

  // Modal de Edição de Template
  editModal: document.getElementById('editModal'),
  editTemplateForm: document.getElementById('editForm'),
  editTemplateIdInput: document.getElementById('editTemplateId'),
  editTemplateNameInput: document.getElementById('editNome'),
  editTemplateCategoryInput: document.getElementById('editCategoria'),
  editTemplateTagsInput: document.getElementById('editTags'),
  editorQuillEditModalDiv: document.getElementById('editEditor'),
  editModalEditorCounter: document.getElementById('editEditorCounter'),
  dynamicFieldsContainerModal: document.getElementById('dynamicFieldsContainerModal'),
  cancelEditModalBtn: document.getElementById('cancelEditBtn'), // Botão de cancelar do modal de edição
  feedbackAreaEditModal: document.getElementById('feedbackAreaEdit'),

  // Modal de Variáveis
  variableModal: document.getElementById('variableModal'),
  variableForm: document.getElementById('variableForm'),
  variableInputsContainer: document.getElementById('variableInputsContainer'),
  confirmVarBtn: document.getElementById('confirmVarBtn'),
  cancelVarBtn: document.getElementById('cancelVarBtn'),

  // Modal de Inspeção
  inspectorModal: document.getElementById('modalInspector'),
  inspectorContent: { // Agrupando para fácil acesso
      automaticos: document.getElementById('inspectorAutomaticos'),
      constantesDef: document.getElementById('inspectorConstantesDef'),
      constantesUndef: document.getElementById('inspectorConstantesUndef'),
      variaveis: document.getElementById('inspectorVariaveis'),
      inputs: document.getElementById('inspectorInputs'),
      reutilizaveis: document.getElementById('inspectorReutilizaveis'),
      invocacoesExist: document.getElementById('inspectorInvocacoesExist'),
      invocacoesNonexist: document.getElementById('inspectorInvocacoesNonexist')
  },
  btnFecharInspector: document.getElementById('btnFecharInspector'),

  // Modal de Preview
  previewModal: document.getElementById('modalPreview'),
  previewModalTitle: document.getElementById('previewModalTitle'),
  previewContentDiv: document.getElementById('previewContent'),
  btnCopiarPreview: document.getElementById('btnCopiarPreview'),
  btnFecharPreview: document.getElementById('btnFecharPreview'),

  // Aba Ferramentas de Texto > Número por Extenso
  numeroParaExtensoInput: document.getElementById('numeroParaExtenso'),
  usarReaisCheckbox: document.getElementById('usarReais'),
  numeroFemininoCheckbox: document.getElementById('numeroFeminino'),
  btnConverterExtenso: document.getElementById('btnConverterExtenso'),
  resultadoExtensoDiv: document.getElementById('resultadoExtenso'),
  btnCopiarExtenso: document.getElementById('btnCopiarExtenso'),

  // Aba Ferramentas de Texto > Limpeza de Texto
  textoParaLimparTextarea: document.getElementById('textoParaLimpar'),
  contadorTextoOriginalDiv: document.getElementById('contadorTextoOriginal'),
  unirParagrafosCheckbox: document.getElementById('unirParagrafos'),
  removerEspacosDuplosCheckbox: document.getElementById('removerEspacosDuplos'),
  removerEspacosBordasCheckbox: document.getElementById('removerEspacosBordas'),
  converterMaiusculasCheckbox: document.getElementById('converterMaiusculas'),
  converterMinusculasCheckbox: document.getElementById('converterMinusculas'),
  converterTituloCheckbox: document.getElementById('converterTitulo'),
  removerMarcadoresCheckbox: document.getElementById('removerMarcadores'),
  habilitarFindReplaceCheckbox: document.getElementById('habilitarFindReplace'),
  findTextInput: document.getElementById('findText'),
  replaceTextInput: document.getElementById('replaceText'),
  ordenarLinhasSelect: document.getElementById('ordenarLinhasSelect'),
  btnAplicarLimpeza: document.getElementById('btnAplicarLimpeza'),
  textoLimpoResultadoTextarea: document.getElementById('textoLimpoResultado'),
  contadorTextoLimpoDiv: document.getElementById('contadorTextoLimpo'),
  btnCopiarLimpo: document.getElementById('btnCopiarLimpo'),

  // Aba Documentos e Consultas > Formatar Documentos
  docTipoSelect: document.getElementById('docTipoSelect'),
  docNumeroInput: document.getElementById('docNumeroInput'),
  btnFormatarDoc: document.getElementById('btnFormatarDoc'),
  btnLimparDoc: document.getElementById('btnLimparDoc'), // Corrigido para btnLimparDoc
  resultadoDocFormatadoDiv: document.getElementById('resultadoDocFormatado'),
  btnCopiarDocFormatado: document.getElementById('btnCopiarDocFormatado'),

  // Aba Documentos e Consultas > Consulta de Processo
  numeroProcessoTJSPInput: document.getElementById('numeroProcessoTJSP'),
  selectInstanciaTJSP: document.getElementById('selectInstanciaTJSP'),
  btnGerarLinkProcesso: document.getElementById('btnGerarLinkProcesso'),
  resultadoLinkProcessoDiv: document.getElementById('resultadoLinkProcesso'),

  // Aba CEP e Endereço > Endereço por CEP
  cepInput: document.getElementById('cep'),
  buscarCepBtn: document.getElementById('buscarCepBtn'),
  resultadoCepDiv: document.getElementById('resultadoCep'),
  btnCopiarEndereco: document.getElementById('btnCopiarEndereco'),

  // Aba CEP e Endereço > CEP por Endereço
  ufInput: document.getElementById('uf'),
  cidadeInput: document.getElementById('cidade'),
  logradouroInput: document.getElementById('logradouro'),
  buscarEnderecoBtn: document.getElementById('buscarEnderecoBtn'),
  resultadoEnderecoDiv: document.getElementById('resultadoEndereco'),

  // Aba Links Úteis > Links Salvos
  listaLinkNomeInput: document.getElementById('listaLinkNomeInput'),
  listaLinkUrlInput: document.getElementById('listaLinkUrlInput'),
  listaLinkCategoriaInput: document.getElementById('listaLinkCategoriaInput'), // Adicionado
  btnAddLinkLista: document.getElementById('btnAddLinkLista'),
  listaLinksSalvosContainer: document.getElementById('listaLinksSalvosContainer'),
  editLinkModal: document.getElementById('editLinkModal'), // Adicionado
  editLinkIdInput: document.getElementById('editLinkId'), // Adicionado
  editLinkNomeInput: document.getElementById('editLinkNome'), // Adicionado
  editLinkUrlInput: document.getElementById('editLinkUrl'), // Adicionado
  editLinkCategoriaInput: document.getElementById('editLinkCategoria'), // Adicionado
  editLinkForm: document.getElementById('editLinkForm'), // Adicionado
  cancelEditLinkBtn: document.getElementById('cancelEditLinkBtn'), // Adicionado


  // Aba Links Úteis > Painel de Links
  linkCategoryFiltersContainer: document.getElementById('linkCategoryFiltersContainer'), // Corrigido
  linkCardsContainer: document.getElementById('linkCardsContainer'),

  // Aba Configurações
  configTemaEscuroCheckbox: document.getElementById('configTemaEscuro'),
  configIdiomaSelect: document.getElementById('configIdioma'),
  constanteNomeInput: document.getElementById('constanteNome'),
  constanteValorInput: document.getElementById('constanteValor'),
  constanteFormatoSelect: document.getElementById('constanteFormato'),
  btnAdicionarConstante: document.getElementById('btnAdicionarConstante'),
  listaConstantesDiv: document.getElementById('listaConstantes'),
  newReusableVariableNameInput: document.getElementById('newReusableVariableName'),
  addReusableVariableBtn: document.getElementById('addReusableVariableBtn'),
  reusableVariablesListDiv: document.getElementById('reusableVariablesList'),
  btnExportarModelos: document.getElementById('btnExportarModelos'),
  btnImportarModelos: document.getElementById('btnImportarModelos'),
  btnExportarConfig: document.getElementById('btnExportarConfig'),
  btnImportarConfig: document.getElementById('btnImportarConfig'),
  importConfigInput: document.getElementById('importConfigInput'),
  feedbackAreaSettings: document.getElementById('feedbackAreaSettings'),

  // Aba Documentação
  documentationContentDiv: document.querySelector('#TabDocumentation .documentation-content')
};


// --- FUNÇÕES DE INICIALIZAÇÃO ---

/**
 * Função principal de inicialização da extensão.
 * Configura traduções, carrega dados, inicializa editores e event listeners.
 */
async function inicializarExtensao() {
  console.log("Facilita: Inicializando extensão...");
  setupFeedbackGlobal(); // Configura a área de feedback global primeiro
  traduzirInterface(); // Traduz a UI com base no idioma salvo/padrão

  await carregarConfiguracoesEModelos(); // Carrega configurações e templates do storage
  inicializarEditoresQuill(); // Inicializa os editores de texto rico
  configurarNavegacaoAbas(); // Configura a lógica de navegação entre abas principais e sub-abas

  // Configura os event listeners para cada seção da extensão
  configurarEventListenersGerais();
  configurarEventListenersModelos();
  configurarEventListenersFerramentasTexto();
  configurarEventListenersDocumentos();
  configurarEventListenersCEP();
  configurarEventListenersLinks();
  configurarEventListenersConfiguracoes();
  configurarEventListenersModais();

  // Restaura a última aba e sub-aba visitada pelo usuário
  const ultimaAba = localStorage.getItem('facilitaUltimaAbaPrincipal') || 'TabModelos';
  const ultimaSubAbaModelos = localStorage.getItem('facilitaUltimaSubAba_TabModelos') || 'SubTabMyTemplates';
  const ultimaSubAbaTexto = localStorage.getItem('facilitaUltimaSubAba_TabTextTools') || 'SubTabNumberToText';
  const ultimaSubAbaDocs = localStorage.getItem('facilitaUltimaSubAba_TabDocuments') || 'SubTabFormatDocuments';
  const ultimaSubAbaCEP = localStorage.getItem('facilitaUltimaSubAba_TabCEP') || 'SubTabAddressByCEP';
  const ultimaSubAbaLinks = localStorage.getItem('facilitaUltimaSubAba_TabLinks') || 'SubTabSavedLinks';

  // Pequeno timeout para garantir que a UI esteja pronta antes de simular cliques
  setTimeout(() => {
    const tabLinkParaAtivar = DOM.mainTabsContainer.querySelector(`.tablinks[data-tab="${ultimaAba}"]`);
    if (tabLinkParaAtivar) {
      tabLinkParaAtivar.click(); // Ativa a aba principal

      // Ativa a sub-aba correspondente
      let subTabParaAtivarId;
      switch (ultimaAba) {
        case 'TabModelos': subTabParaAtivarId = ultimaSubAbaModelos; break;
        case 'TabTextTools': subTabParaAtivarId = ultimaSubAbaTexto; break;
        case 'TabDocuments': subTabParaAtivarId = ultimaSubAbaDocs; break;
        case 'TabCEP': subTabParaAtivarId = ultimaSubAbaCEP; break;
        case 'TabLinks': subTabParaAtivarId = ultimaSubAbaLinks; break;
      }
      if (subTabParaAtivarId) {
        const subTabLink = document.querySelector(`#${ultimaAba} .sub-tablinks[data-subtab="${subTabParaAtivarId}"]`);
        if (subTabLink) ativarSubAba(subTabLink); // Função para ativar sub-aba
      }
    } else if (DOM.allMainTabLinks.length > 0) {
      DOM.allMainTabLinks[0].click(); // Fallback para a primeira aba principal
    }
  }, 50); // 50ms de delay
  console.log("Facilita: Extensão inicializada.");
}

/**
 * Configura a área de feedback global se não existir.
 */
function setupFeedbackGlobal() {
  // O DOM.feedbackGlobalArea já é pego pelo ID 'feedbackGlobalArea' que foi adicionado ao HTML.
  // Se não existir, esta função não fará nada, mas o ideal é que o elemento exista no HTML.
  if (!DOM.feedbackGlobalArea) {
    console.warn("Facilita: Área de feedback global ('feedbackGlobalArea') não encontrada no HTML.");
  }
}

/**
 * Carrega as configurações, templates e links salvos do chrome.storage.
 * Atualiza as variáveis globais e a UI de acordo com os dados carregados.
 */
async function carregarConfiguracoesEModelos() {
  try {
    currentSettings = await loadSettings(); // Carrega configurações gerais
    currentTemplates = await loadTemplates(); // Carrega lista de modelos
    currentLinksSalvos = await carregarLinksSalvos(); // Carrega links salvos

    // Aplica tema escuro se ativado nas configurações
    document.body.classList.toggle('dark-mode', !!currentSettings.darkMode);
    if(DOM.themeIconSun && DOM.themeIconMoon){ // Verifica se os ícones existem
        DOM.themeIconSun.style.display = currentSettings.darkMode ? 'none' : 'inline';
        DOM.themeIconMoon.style.display = currentSettings.darkMode ? 'inline' : 'none';
    }
    if (DOM.configTemaEscuroCheckbox) DOM.configTemaEscuroCheckbox.checked = !!currentSettings.darkMode;

    // Define o idioma selecionado na interface
    if (DOM.configIdiomaSelect) DOM.configIdiomaSelect.value = currentSettings.language || 'pt_BR';

    // Renderiza listas dinâmicas
    renderizarListaConstantes();
    renderizarListaVariaveisReutilizaveis();
    atualizarBotoesCamposDinamicos(DOM.dynamicFieldsContainerCreate); // Atualiza botões de placeholder
    renderizarListaTemplates(); // Renderiza a lista de modelos
    renderizarCategoriasTemplates(); // Renderiza filtros de categoria
    renderizarListaLinksSalvos(); // Renderiza links salvos
    renderizarPainelLinksRapidos(); // Renderiza painel de links rápidos
    updateUniqueTagsList(); // Atualiza lista de tags únicas para sugestões
  } catch (error) {
    console.error("Facilita: Erro ao carregar dados iniciais:", error);
    exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackErrorLoadingData") || "Erro ao carregar dados.", "error");
  }
}

/**
 * Inicializa os editores de texto rico Quill.js para criação e edição de modelos.
 */
function inicializarEditoresQuill() {
  try {
    // Editor para criar novo modelo
    if (DOM.editorQuillCreateDiv && !quillEditorCreate) {
      quillEditorCreate = new Quill(DOM.editorQuillCreateDiv, {
        theme: 'snow',
        modules: { toolbar: QUILL_TOOLBAR_OPTIONS_FULL },
        placeholder: chrome.i18n.getMessage("editorPlaceholderCreate") || 'Digite o conteúdo do seu modelo aqui...'
      });
      // Atualiza contador de caracteres/palavras ao digitar
      quillEditorCreate.on('text-change', debounce(() => updateEditorCounter(quillEditorCreate, DOM.createEditorCounter), 250));
      updateEditorCounter(quillEditorCreate, DOM.createEditorCounter); // Inicializa contador
    }
    // Editor para o modal de edição de modelo
    if (DOM.editorQuillEditModalDiv && !quillEditorEditModal) {
      quillEditorEditModal = new Quill(DOM.editorQuillEditModalDiv, {
        theme: 'snow',
        modules: { toolbar: QUILL_TOOLBAR_OPTIONS_FULL },
        placeholder: chrome.i18n.getMessage("editorPlaceholderEdit") || 'Edite o conteúdo do modelo...'
      });
      // Atualiza contador de caracteres/palavras ao digitar no modal
      quillEditorEditModal.on('text-change', debounce(() => updateEditorCounter(quillEditorEditModal, DOM.editModalEditorCounter), 250));
    }
  } catch (error) {
    console.error("Facilita: Erro ao inicializar editores Quill:", error);
    exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackErrorEditorNotReady") || "Erro: Editor não está pronto.", "error");
    // Exibe mensagem de erro diretamente nos divs dos editores se falhar
    if (DOM.editorQuillCreateDiv) DOM.editorQuillCreateDiv.innerHTML = `<p style='color:red;'>${chrome.i18n.getMessage("feedbackErrorEditorNotReady")}</p>`;
    if (DOM.editorQuillEditModalDiv) DOM.editorQuillEditModalDiv.innerHTML = `<p style='color:red;'>${chrome.i18n.getMessage("feedbackErrorEditorNotReady")}</p>`;
  }
}

// --- FIM DA PARTE 1 ---
// popup.js - Script principal para a extensão Facilita (Parte 2)

// (Continuação das importações, constantes, variáveis globais e seletores DOM da Parte 1)
// ...

// --- FUNÇÕES DE NAVEGAÇÃO E UI ---

/**
 * Configura os event listeners para a navegação entre abas principais e sub-abas.
 */
function configurarNavegacaoAbas() {
  // Listeners para abas principais
  DOM.allMainTabLinks.forEach(tabLink => {
    tabLink.addEventListener('click', (event) => {
      const tabId = event.currentTarget.dataset.tab;
      ativarAbaPrincipal(tabId);
      localStorage.setItem('facilitaUltimaAbaPrincipal', tabId); // Guarda a última aba principal visitada
    });
  });

  // Listeners para sub-abas
  DOM.allSubTabLinks.forEach(subTabLink => {
    subTabLink.addEventListener('click', (event) => {
      const subTabId = event.currentTarget.dataset.subtab;
      ativarSubAba(event.currentTarget); // Passa o elemento do link da sub-aba
      const parentTabId = event.currentTarget.closest('.tabcontent')?.id;
      if (parentTabId) {
          // Guarda a última sub-aba visitada para a aba principal correspondente
          localStorage.setItem(`facilitaUltimaSubAba_${parentTabId}`, subTabId);
      }
    });
  });
}

/**
 * Ativa uma aba principal, mostrando o seu conteúdo e ocultando os outros.
 * Também tenta ativar a última sub-aba visitada dentro da aba principal ativada.
 * @param {string} tabId - O ID da aba principal a ser ativada.
 */
function ativarAbaPrincipal(tabId) {
  // Oculta todos os conteúdos de abas principais e desativa todos os links
  DOM.allMainTabContents.forEach(content => content.classList.remove('active-tab'));
  DOM.allMainTabLinks.forEach(link => link.classList.remove('active'));

  // Ativa o conteúdo e o link da aba selecionada
  const contentParaAtivar = document.getElementById(tabId);
  const linkParaAtivar = DOM.mainTabsContainer.querySelector(`.tablinks[data-tab="${tabId}"]`);

  if (contentParaAtivar) contentParaAtivar.classList.add('active-tab');
  if (linkParaAtivar) linkParaAtivar.classList.add('active');

  // Tenta ativar a última sub-aba visitada para esta aba principal
  const ultimaSubAbaSalva = localStorage.getItem(`facilitaUltimaSubAba_${tabId}`);
  let subTabParaAtivar = null;
  if (ultimaSubAbaSalva && contentParaAtivar) {
    subTabParaAtivar = contentParaAtivar.querySelector(`.sub-tablinks[data-subtab="${ultimaSubAbaSalva}"]`);
  }
  // Se não houver sub-aba salva, ou se a salva não existir, ativa a primeira sub-aba (se houver)
  if (!subTabParaAtivar && contentParaAtivar) {
      subTabParaAtivar = contentParaAtivar.querySelector('.sub-tablinks');
  }
  if (subTabParaAtivar) {
      ativarSubAba(subTabParaAtivar);
  }


  // Lógica específica ao ativar certas abas principais (ex: focar editor, recarregar listas)
  if (tabId === 'TabModelos') {
    const subTabMyTemplates = document.getElementById('SubTabMyTemplates');
    const subTabCreateTemplate = document.getElementById('SubTabCreateTemplate');
    if (subTabMyTemplates?.classList.contains('active-sub-tab')) {
        renderizarListaTemplates();
        renderizarCategoriasTemplates();
    } else if (subTabCreateTemplate?.classList.contains('active-sub-tab')) {
        atualizarBotoesCamposDinamicos(DOM.dynamicFieldsContainerCreate);
        if(quillEditorCreate) quillEditorCreate.focus();
    }
  } else if (tabId === 'TabLinks') {
    const subTabSavedLinks = document.getElementById('SubTabSavedLinks');
    const subTabQuickLinksPanel = document.getElementById('SubTabQuickLinksPanel');
    if(subTabSavedLinks?.classList.contains('active-sub-tab')) renderizarListaLinksSalvos();
    if(subTabQuickLinksPanel?.classList.contains('active-sub-tab')) renderizarPainelLinksRapidos();
  } else if (tabId === 'TabSettings') {
    renderizarListaConstantes();
    renderizarListaVariaveisReutilizaveis();
  } else if (tabId === 'TabTextTools' && document.getElementById('SubTabCleanText')?.classList.contains('active-sub-tab')) {
    atualizarContadoresLimpezaTexto();
  }
}

/**
 * Ativa uma sub-aba dentro de uma aba principal ativa.
 * @param {HTMLElement} subTabLinkElement - O elemento do link da sub-aba que foi clicado.
 */
function ativarSubAba(subTabLinkElement) {
  const parentTabContent = subTabLinkElement.closest('.tabcontent');
  if (!parentTabContent) return; // Se não encontrar o conteúdo da aba pai, não faz nada

  const subTabId = subTabLinkElement.dataset.subtab;

  // Desativa todos os links de sub-abas e oculta todos os conteúdos de sub-abas dentro da aba pai
  parentTabContent.querySelectorAll('.sub-tablinks').forEach(link => link.classList.remove('active'));
  parentTabContent.querySelectorAll('.sub-tabcontent').forEach(content => content.classList.remove('active-sub-tab'));

  // Ativa o link e o conteúdo da sub-aba selecionada
  subTabLinkElement.classList.add('active');
  const subContentParaAtivar = document.getElementById(subTabId);
  if (subContentParaAtivar) subContentParaAtivar.classList.add('active-sub-tab');

  // Lógica específica ao ativar certas sub-abas
  if (subTabId === 'SubTabCleanText') atualizarContadoresLimpezaTexto();
  else if (subTabId === 'SubTabMyTemplates') { renderizarListaTemplates(); renderizarCategoriasTemplates(); }
  else if (subTabId === 'SubTabSavedLinks') renderizarListaLinksSalvos();
  else if (subTabId === 'SubTabQuickLinksPanel') renderizarPainelLinksRapidos();
  else if (subTabId === 'SubTabCreateTemplate') {
      atualizarBotoesCamposDinamicos(DOM.dynamicFieldsContainerCreate);
      if(quillEditorCreate) quillEditorCreate.focus();
  }
}

/**
 * Exibe uma mensagem de feedback global ou numa área específica.
 * @param {string} mensagem - A mensagem a ser exibida.
 * @param {string} [tipo='info'] - Tipo de mensagem ('success', 'error', 'warning', 'info').
 * @param {number} [duracao=3000] - Duração em milissegundos para a mensagem ser exibida.
 * @param {HTMLElement} [areaEspecifica=null] - Elemento HTML específico para exibir o feedback.
 */
function exibirFeedbackGlobal(mensagem, tipo = 'info', duracao = 3000, areaEspecifica = null) {
    const area = areaEspecifica || DOM.feedbackGlobalArea;
    if (!area) {
        console.warn("Área de feedback não encontrada para exibir mensagem:", mensagem);
        return;
    }
    area.textContent = mensagem;
    area.className = `feedback-area ${tipo}`; // Remove classes antigas e adiciona a nova
    void area.offsetWidth; // Força reflow para reiniciar a animação CSS
    area.classList.add('show');

    // Limpa timeout anterior, se houver, para evitar que a mensagem desapareça prematuramente
    if (area.timeoutId) clearTimeout(area.timeoutId);

    area.timeoutId = setTimeout(() => {
        area.classList.remove('show');
        // Após a animação de saída, limpa o conteúdo e a classe de tipo
        setTimeout(() => {
            if (!area.classList.contains('show')) { // Verifica se não foi reativada
                area.textContent = '';
                area.classList.remove(tipo);
            }
        }, 300); // Tempo da transição de opacidade
    }, duracao);
}

/**
 * Traduz os elementos da interface que possuem o atributo data-i18n.
 */
function traduzirInterface() {
    // Define o idioma do documento para acessibilidade e SEO (se aplicável)
    document.documentElement.lang = chrome.i18n.getUILanguage ? chrome.i18n.getUILanguage().substring(0,2) : 'pt';

    // Seleciona todos os elementos que precisam de tradução
    const elements = document.querySelectorAll('[data-i18n], [data-i18n-placeholder], [data-i18n-title], [data-i18n-aria-label]');
    elements.forEach(el => {
        const setText = (attr, msgKey) => {
        if (msgKey) {
            try {
                const msg = chrome.i18n.getMessage(msgKey);
                if (msg) { // Verifica se a mensagem foi encontrada
                    if (attr === 'textContent') el.textContent = msg;
                    else if (attr === 'innerHTML') el.innerHTML = msg; // Usar com cuidado
                    else el.setAttribute(attr, msg);
                } else {
                    console.warn(`Facilita: Chave i18n não encontrada ou vazia: ${msgKey} para atributo ${attr}`);
                    // Fallback: usa a própria chave se a tradução não for encontrada
                    if (attr === 'textContent') el.textContent = msgKey;
                    else if (attr === 'innerHTML') el.innerHTML = msgKey;
                    else el.setAttribute(attr, msgKey);
                }
            } catch (e) {
                console.warn(`Facilita: Erro ao obter mensagem i18n para ${msgKey}: ${e}`);
                if (attr === 'textContent') el.textContent = msgKey;
                else if (attr === 'innerHTML') el.innerHTML = msgKey;
                else el.setAttribute(attr, msgKey);
            }
        }
        };
        // Aplica tradução para diferentes atributos
        setText('textContent', el.dataset.i18n);
        setText('placeholder', el.dataset.i18nPlaceholder);
        setText('title', el.dataset.i18nTitle);
        setText('aria-label', el.dataset.i18nAriaLabel);
    });

    // Traduz o título da página, se houver
    const pageTitleKey = document.querySelector('title[data-i18n]')?.dataset.i18n;
    if(pageTitleKey) {
        const translatedPageTitle = chrome.i18n.getMessage(pageTitleKey);
        if(translatedPageTitle) document.title = translatedPageTitle;
    }
}

/**
 * Atualiza o contador de caracteres e palavras para um editor Quill.
 * @param {Quill} editorInstance - A instância do editor Quill.
 * @param {HTMLElement} counterElement - O elemento HTML onde o contador será exibido.
 */
function updateEditorCounter(editorInstance, counterElement) {
    if (!editorInstance || !counterElement) return;
    const text = editorInstance.getText(); // getText() retorna o texto puro, incluindo o newline final do Quill
    // O Quill adiciona um \n no final mesmo que o editor esteja visualmente vazio.
    // Para uma contagem mais precisa de "vazio", verificamos se o texto trimado é vazio.
    const isEmpty = text.trim() === '';
    const charCount = isEmpty ? 0 : text.length -1; // Subtrai 1 para ignorar o \n final do Quill se não estiver vazio

    // Conta palavras separadas por espaços ou quebras de linha, filtrando strings vazias resultantes do split.
    const words = isEmpty ? 0 : text.trim().split(/[\s\n]+/).filter(word => word.length > 0).length;

    try {
        counterElement.textContent = chrome.i18n.getMessage("charCounterText", [String(charCount), String(words)]);
    } catch (e) {
        // Fallback caso a mensagem i18n não seja encontrada
        counterElement.textContent = `${charCount} caracteres, ${words} palavras`;
    }
}

/**
 * Atualiza os botões de inserção de campos dinâmicos (constantes e variáveis reutilizáveis).
 * @param {HTMLElement} container - O container onde os botões de placeholder serão adicionados.
 */
function atualizarBotoesCamposDinamicos(container) {
    if (!container) return;

    // Remove botões antigos para evitar duplicatas
    container.querySelectorAll(".custom-constant-btn, .reusable-variable-btn").forEach(btn => btn.remove());

    const fragment = document.createDocumentFragment();

    // Adiciona botões para Constantes Personalizadas
    if (currentSettings.customConstants) {
        Object.keys(currentSettings.customConstants).sort().forEach(name => {
        const btn = document.createElement("button");
        btn.type = "button"; btn.textContent = name;
        btn.classList.add("placeholder-btn", "custom-constant-btn");
        const field = `{${name}}`; btn.dataset.placeholder = field;
        const constantTypeMsg = chrome.i18n.getMessage("itemTypeConstant") || "Constante";
        // Mostra os primeiros 30 caracteres do valor no title para não ficar muito longo
        const valuePreview = (currentSettings.customConstants[name].value || "").substring(0,30);
        btn.title = `${constantTypeMsg}: ${field}\nValor: ${valuePreview}${valuePreview.length === 30 ? '...' : ''}`;
        fragment.appendChild(btn);
        });
    }

    // Adiciona botões para Variáveis Reutilizáveis
    if (currentSettings.reusableVariables) {
        Object.keys(currentSettings.reusableVariables).sort().forEach(name => {
        const btn = document.createElement("button");
        btn.type = "button"; btn.textContent = name;
        btn.classList.add("placeholder-btn", "reusable-variable-btn"); // Classe específica para variáveis
        const field = `{${name}}`; btn.dataset.placeholder = field;
        const reusableVarTypeMsg = chrome.i18n.getMessage("itemTypeReusableVariable") || "Variável Reutilizável";
        const valueRequestedMsg = chrome.i18n.getMessage("reusableVarValueRequested") || "(Valor solicitado ao usar)";
        btn.title = `${reusableVarTypeMsg}: ${field}\n${valueRequestedMsg}`;
        fragment.appendChild(btn);
        });
    }
    container.appendChild(fragment);

    // Reatribui event listeners aos novos botões
    container.querySelectorAll('.placeholder-btn').forEach(btn => {
        btn.removeEventListener('click', handlePlaceholderButtonClick); // Remove listener antigo se houver
        btn.addEventListener('click', handlePlaceholderButtonClick);
    });
}

/**
 * Manipulador para cliques nos botões de placeholder, inserindo o placeholder no editor ativo.
 * @param {Event} event - O evento de clique.
 */
function handlePlaceholderButtonClick(event) {
    const placeholder = event.currentTarget.dataset.placeholder;
    let activeEditor = null;

    // Determina qual editor está ativo (criação de template ou modal de edição)
    const activeSubTabCreate = document.getElementById('SubTabCreateTemplate');
    const modalEditAberto = DOM.editModal.classList.contains('active');

    if (modalEditAberto && quillEditorEditModal) {
        activeEditor = quillEditorEditModal;
    } else if (activeSubTabCreate && activeSubTabCreate.classList.contains('active-sub-tab') && quillEditorCreate) {
        activeEditor = quillEditorCreate;
    }

    if (activeEditor && placeholder) {
        const range = activeEditor.getSelection(true); // Pega a seleção atual ou a posição do cursor
        activeEditor.insertText(range.index, placeholder, 'user'); // Insere o placeholder
        activeEditor.setSelection(range.index + placeholder.length, 0, 'user'); // Move o cursor para depois do placeholder
        activeEditor.focus(); // Devolve o foco ao editor
    } else if (!activeEditor) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackErrorEditorNotReady") || "Erro: Editor não está pronto.", "error");
    }
}

/**
 * Função Debounce para evitar execuções excessivas de uma função.
 * @param {Function} func - A função a ser executada após o debounce.
 * @param {number} delay - O tempo de espera em milissegundos.
 * @returns {Function} A função "debounced".
 */
function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

// --- FIM DA PARTE 2 ---
// popup.js - Script principal para a extensão Facilita (Parte 3)

// (Continuação das importações, constantes, variáveis globais, seletores DOM,
//  funções de Inicialização, Navegação e UI das Partes 1 e 2)
// ...

// --- SEÇÃO: LÓGICA DE MODELOS ---

/**
 * Configura os event listeners para a aba de Modelos (Criar e Meus Modelos).
 */
function configurarEventListenersModelos() {
  // Formulário de criação/edição de modelo
  if (DOM.createTemplateForm) DOM.createTemplateForm.addEventListener('submit', handleSalvarNovoModelo);
  if (DOM.btnClearCreateForm) DOM.btnClearCreateForm.addEventListener('click', () => {
      DOM.createTemplateForm.reset();
      if (quillEditorCreate) quillEditorCreate.setContents([{ insert: '\n' }]); // Limpa o editor
      updateEditorCounter(quillEditorCreate, DOM.createEditorCounter);
      if (DOM.templateNameInput) DOM.templateNameInput.focus();
  });

  // Funcionalidades da listagem de "Meus Modelos"
  if (DOM.searchInputTemplates) DOM.searchInputTemplates.addEventListener('input', debounce(renderizarListaTemplates, 300));
  if (DOM.tagSearchInputTemplates) {
    DOM.tagSearchInputTemplates.addEventListener('input', handleTagSearchInput);
    // Oculta sugestões ao perder o foco, com um pequeno delay para permitir clique na sugestão
    DOM.tagSearchInputTemplates.addEventListener('blur', () => setTimeout(() => {
        if (DOM.tagSuggestionsTemplatesDiv) DOM.tagSuggestionsTemplatesDiv.classList.remove('visible');
    }, 150));
  }
  // O listener para clique em sugestão de tag é adicionado dinamicamente em renderTagSuggestions

  if (DOM.sortOptionsTemplates) DOM.sortOptionsTemplates.addEventListener('change', (e) => {
    currentSortCriteria = e.target.value;
    renderizarListaTemplates(); // Re-renderiza a lista com a nova ordenação
  });
  if (DOM.categoriesFilterTemplatesDiv) DOM.categoriesFilterTemplatesDiv.addEventListener('click', (e) => {
    if (e.target.classList.contains('category-filter')) {
      activeCategoryFilter = e.target.dataset.category;
      // Atualiza a classe 'active' nos botões de filtro de categoria
      DOM.categoriesFilterTemplatesDiv.querySelectorAll(".category-filter").forEach(f => f.classList.remove("active"));
      e.target.classList.add("active");
      renderizarListaTemplates(); // Re-renderiza a lista com o novo filtro de categoria
    }
  });
  if (DOM.loadMoreTemplatesBtn) DOM.loadMoreTemplatesBtn.addEventListener('click', () => renderizarListaTemplates(true)); // O 'true' indica para anexar mais itens
  if (DOM.templatesListDiv) DOM.templatesListDiv.addEventListener('click', handleAcaoItemModelo); // Listener para ações nos itens da lista
  if (DOM.btnInspectPlaceholders) DOM.btnInspectPlaceholders.addEventListener('click', handleInspecionarPlaceholdersEditorPrincipal);

  // Listeners para ações em massa
  if (DOM.bulkSelectAllBtn) DOM.bulkSelectAllBtn.addEventListener('click', handleBulkSelectAllVisible);
  if (DOM.bulkDeselectAllBtn) DOM.bulkDeselectAllBtn.addEventListener('click', handleBulkDeselectAll);
  if (DOM.bulkDeleteBtn) DOM.bulkDeleteBtn.addEventListener('click', handleBulkDeleteSelected);
  if (DOM.bulkAddCategoryBtn) DOM.bulkAddCategoryBtn.addEventListener('click', handleBulkAddCategoryToSelected);
  if (DOM.bulkAddTagsBtn) DOM.bulkAddTagsBtn.addEventListener('click', handleBulkAddTagsToSelected);
}

/**
 * Manipula o salvamento de um novo modelo ou a atualização de um existente.
 * @param {Event} event - O evento de submit do formulário.
 */
async function handleSalvarNovoModelo(event) {
    event.preventDefault();
    // Determina se está editando no modal ou criando na aba principal
    const isEditingInModal = DOM.editModal.classList.contains('active');
    const activeEditor = isEditingInModal ? quillEditorEditModal : quillEditorCreate;
    const feedbackArea = isEditingInModal ? DOM.feedbackAreaEditModal : DOM.feedbackAreaCreate;
    const form = isEditingInModal ? DOM.editTemplateForm : DOM.createTemplateForm;

    // Verifica se o editor está pronto e se há conteúdo
    if (!activeEditor || (activeEditor.getLength() <= 1 && !activeEditor.getText().trim())) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackContentRequired") || "Conteúdo é obrigatório.", "error", 3000, feedbackArea);
        return;
    }

    // Seleciona os inputs corretos com base no contexto (criação ou edição)
    const nomeInput = isEditingInModal ? DOM.editTemplateNameInput : DOM.templateNameInput;
    const categoriaInput = isEditingInModal ? DOM.editTemplateCategoryInput : DOM.templateCategoryInput;
    const tagsInput = isEditingInModal ? DOM.editTemplateTagsInput : DOM.templateTagsInput;

    const nome = nomeInput.value.trim();
    const categoria = categoriaInput.value.trim() || (chrome.i18n.getMessage("feedbackCategoryNone") || "Sem Categoria");
    const tags = parseTags(tagsInput.value); // Processa a string de tags
    const conteudo = activeEditor.root.innerHTML; // Pega o conteúdo HTML do editor

    if (!nome) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackNameRequired") || "Nome é obrigatório.", "error", 3000, feedbackArea);
        nomeInput.focus();
        return;
    }

    const editandoId = form.dataset.editandoId; // Verifica se há um ID de edição (para distinguir entre criar e editar)

    if (editandoId) { // Editando um modelo existente
        const index = currentTemplates.findIndex(t => t.id === editandoId);
        if (index === -1) {
            exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackTemplateNotFound") || "Erro: Modelo não encontrado.", "error", 3000, feedbackArea);
            return;
        }
        // Verifica se o novo nome já existe em outro modelo
        if (currentTemplates.some(t => t.id !== editandoId && t.name.toLowerCase() === nome.toLowerCase())) {
            exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackTemplateExists", [nome]), "error", 3000, feedbackArea);
            nomeInput.focus();
            return;
        }
        // Atualiza o modelo na lista
        currentTemplates[index] = { ...currentTemplates[index], name: nome, category: categoria, tags: tags, content: conteudo, lastModified: new Date().toISOString() };
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackTemplateUpdated") || "Modelo atualizado com sucesso!", "success");
        fecharModalEdicao(); // Fecha o modal de edição
    } else { // Criando um novo modelo
        // Verifica se o nome do modelo já existe
        if (currentTemplates.some(t => t.name.toLowerCase() === nome.toLowerCase())) {
            exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackTemplateExists", [nome]), "error", 3000, feedbackArea);
            nomeInput.focus();
            return;
        }
        // Cria o novo objeto de modelo
        const novoModelo = {
            id: Date.now().toString() + "_" + Math.random().toString(36).substring(2, 7), // ID único
            name: nome,
            category: categoria,
            tags: tags,
            content: conteudo,
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };
        currentTemplates.push(novoModelo);
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackTemplateSaved") || "Modelo salvo!", "success", 3000, feedbackArea);
    }

    try {
        await saveTemplates(currentTemplates); // Salva a lista atualizada de modelos
        if (!editandoId) { // Se estava criando, limpa o formulário
            form.reset();
            if (quillEditorCreate) quillEditorCreate.setContents([{ insert: '\n' }]);
            updateEditorCounter(quillEditorCreate, DOM.createEditorCounter);
        }
        // Atualiza UI em outros lugares
        atualizarBotoesCamposDinamicos(DOM.dynamicFieldsContainerCreate);
        atualizarBotoesCamposDinamicos(DOM.dynamicFieldsContainerModal);
        renderizarListaTemplates();
        renderizarCategoriasTemplates();
        updateUniqueTagsList();
    } catch (error) {
        console.error("Facilita: Erro ao salvar template:", error);
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackErrorSaving") || "Erro ao salvar modelo.", "error", 3000, feedbackArea);
    }
}

/**
 * Converte uma string de tags separadas por vírgula em um array de tags limpas.
 * @param {string} tagsString - A string de tags.
 * @returns {Array<string>} Um array de tags.
 */
function parseTags(tagsString) {
  if (!tagsString || typeof tagsString !== 'string') return [];
  return tagsString
    .split(',') // Divide a string pela vírgula
    .map(tag => tag.trim().toLowerCase()) // Remove espaços e converte para minúsculas
    .filter(tag => tag !== "" && tag.length <= 30); // Remove tags vazias e limita o tamanho
}

/**
 * Renderiza a lista de modelos na UI, aplicando filtros e ordenação.
 * @param {boolean} [append=false] - Se true, anexa mais modelos à lista existente (paginação).
 */
function renderizarListaTemplates(append = false) {
  if (!DOM.templatesListDiv) return;

  if (!append) { // Se não for para anexar, reinicia a contagem e limpa a lista
    currentlyDisplayedTemplatesCount = 0;
    DOM.templatesListDiv.innerHTML = ""; // Limpa a lista atual

    let templatesFiltrados = [...currentTemplates]; // Começa com todos os templates

    // Aplica filtro de categoria
    if (activeCategoryFilter !== "all") {
      const uncatMsg = chrome.i18n.getMessage("feedbackCategoryNone") || "Sem Categoria";
      templatesFiltrados = templatesFiltrados.filter(t => (t.category || uncatMsg) === activeCategoryFilter);
    }

    // Aplica filtro de tags
    const searchTagsRaw = DOM.tagSearchInputTemplates?.value.toLowerCase().trim() || "";
    if (searchTagsRaw) {
        const searchTagsArray = parseTags(searchTagsRaw);
        if (searchTagsArray.length > 0) {
            templatesFiltrados = templatesFiltrados.filter(t =>
                searchTagsArray.every(st => (t.tags || []).includes(st)) // Template deve ter TODAS as tags do filtro
            );
        }
    }

    // Aplica filtro de busca por termo geral
    const searchTerm = DOM.searchInputTemplates?.value.toLowerCase().trim() || "";
    if (searchTerm) {
        templatesFiltrados = templatesFiltrados.filter(t => {
            const tempDiv = document.createElement('div'); // Para extrair texto do HTML do conteúdo
            tempDiv.innerHTML = t.content || "";
            const textContent = (tempDiv.textContent || tempDiv.innerText || "").toLowerCase();
            return (t.name?.toLowerCase().includes(searchTerm)) ||
                   (t.category?.toLowerCase().includes(searchTerm)) ||
                   (textContent.includes(searchTerm)) ||
                   ((t.tags || []).some(tag => tag.toLowerCase().includes(searchTerm))); // Verifica se alguma tag inclui o termo
        });
    }

    // Ordena os templates filtrados
    templatesFiltrados.sort((a, b) => {
        const lang = currentSettings.language || 'pt-BR';
        switch (currentSortCriteria) {
            case "name_asc": return (a.name || "").localeCompare(b.name || "", lang, { sensitivity: 'base' });
            case "name_desc": return (b.name || "").localeCompare(a.name || "", lang, { sensitivity: 'base' });
            case "date_new": return new Date(b.lastModified || b.createdAt || 0) - new Date(a.lastModified || a.createdAt || 0);
            case "date_old": return new Date(a.lastModified || a.createdAt || 0) - new Date(b.lastModified || b.createdAt || 0);
            default: return 0;
        }
    });
    currentFilteredAndSortedTemplates = templatesFiltrados; // Armazena os templates filtrados e ordenados
  }

  const templatesPerPage = currentSettings.templatesPerPage || TEMPLATES_PER_PAGE;
  const startIndex = currentlyDisplayedTemplatesCount;
  const endIndex = startIndex + templatesPerPage;
  const templatesToRender = currentFilteredAndSortedTemplates.slice(startIndex, endIndex);

  // Verifica se há templates para renderizar
  if (!append && templatesToRender.length === 0 && currentFilteredAndSortedTemplates.length === 0 && currentTemplates.length > 0) {
      DOM.templatesListDiv.innerHTML = `<p class="empty-list-message">${chrome.i18n.getMessage("feedbackNoTemplatesFound") || "Nenhum modelo encontrado."}</p>`;
      if (DOM.loadMoreTemplatesContainer) DOM.loadMoreTemplatesContainer.style.display = 'none';
      updateBulkActionsToolbar();
      return;
  } else if (currentTemplates.length === 0) {
      DOM.templatesListDiv.innerHTML = `<p class="empty-list-message">${chrome.i18n.getMessage("feedbackNoTemplatesYet") || "Nenhum modelo salvo ainda. Crie um na aba 'Criar Modelo'!"}</p>`;
      if (DOM.loadMoreTemplatesContainer) DOM.loadMoreTemplatesContainer.style.display = 'none';
      updateBulkActionsToolbar();
      return;
  }

  const fragment = document.createDocumentFragment();
  templatesToRender.forEach(template => {
    const item = document.createElement("div");
    item.classList.add("template-item"); item.dataset.id = template.id;

    // Checkbox para ações em massa
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.classList.add('template-checkbox');
    checkbox.dataset.id = template.id; checkbox.checked = selectedTemplateIds.has(template.id);
    checkbox.setAttribute('aria-label', template.name); // Para acessibilidade

    const mainContentWrapper = document.createElement('div');
    mainContentWrapper.classList.add('template-item-main-wrapper');

    const clickableContent = document.createElement('div'); // Área clicável para expandir/recolher preview
    clickableContent.classList.add('template-item-clickable-content');

    const header = document.createElement('div');
    header.classList.add('template-header');
    const title = document.createElement('span');
    title.classList.add('template-title'); title.textContent = template.name; title.title = template.name;
    header.appendChild(title);

    if (template.category) {
      const categorySpan = document.createElement('span');
      categorySpan.classList.add('template-category'); categorySpan.textContent = template.category;
      const categoryAria = chrome.i18n.getMessage("templateCategoryARIA", [template.category]) || `Categoria: ${template.category}`;
      categorySpan.title = categoryAria;
      header.appendChild(categorySpan);
    }
    clickableContent.appendChild(header);

    if (template.tags && template.tags.length > 0) {
      const tagsContainer = document.createElement('div');
      tagsContainer.classList.add('template-tags-container');
      template.tags.forEach(tag => {
        const tagSpan = document.createElement('span');
        tagSpan.classList.add('template-tag-item'); tagSpan.textContent = tag;
        tagsContainer.appendChild(tagSpan);
      });
      clickableContent.appendChild(tagsContainer);
    }

    const preview = document.createElement('div');
    preview.classList.add('template-preview', 'ql-snow'); // Adiciona ql-snow para estilos base do Quill
    const previewEditor = document.createElement('div'); // Div interna para o conteúdo do Quill
    previewEditor.classList.add('ql-editor');
    previewEditor.innerHTML = highlightPlaceholdersInHtml(template.content, currentSettings.customConstants, Object.keys(currentSettings.reusableVariables || {}));
    preview.appendChild(previewEditor);
    clickableContent.appendChild(preview);

    mainContentWrapper.appendChild(clickableContent);

    // Botões de ação
    const actions = document.createElement('div');
    actions.classList.add('template-actions');
    actions.innerHTML = `
      <button class="btn-usar-modelo icon-btn" data-id="${template.id}" title="${chrome.i18n.getMessage("btnUseTemplateARIA") || 'Usar modelo'}"><i class="fa-solid fa-copy"></i></button>
      <button class="btn-editar-modelo icon-btn" data-id="${template.id}" title="${chrome.i18n.getMessage("btnEditTemplateARIA") || 'Editar modelo'}"><i class="fa-solid fa-pen-to-square"></i></button>
      <button class="btn-clonar-modelo icon-btn" data-id="${template.id}" title="${chrome.i18n.getMessage("btnCloneTemplateARIA") || 'Clonar modelo'}"><i class="fa-solid fa-clone"></i></button>
      <button class="btn-exportar-modelo icon-btn" data-id="${template.id}" title="${chrome.i18n.getMessage("btnExportTemplateARIA") || 'Exportar este modelo'}"><i class="fa-solid fa-download"></i></button>
      <button class="btn-excluir-modelo icon-btn delete-btn" data-id="${template.id}" title="${chrome.i18n.getMessage("btnDeleteTemplateARIA") || 'Excluir modelo'}"><i class="fa-solid fa-trash-can"></i></button>
    `;
    mainContentWrapper.appendChild(actions);

    item.appendChild(checkbox);
    item.appendChild(mainContentWrapper);
    fragment.appendChild(item);
  });

  if (append) DOM.templatesListDiv.appendChild(fragment);
  else { DOM.templatesListDiv.innerHTML = ''; DOM.templatesListDiv.appendChild(fragment); }

  currentlyDisplayedTemplatesCount += templatesToRender.length;

  // Controla a visibilidade do botão "Carregar Mais"
  if (DOM.loadMoreTemplatesContainer && DOM.loadMoreTemplatesBtn) {
    if (currentlyDisplayedTemplatesCount < currentFilteredAndSortedTemplates.length) {
        const remaining = currentFilteredAndSortedTemplates.length - currentlyDisplayedTemplatesCount;
        DOM.loadMoreTemplatesBtn.textContent = chrome.i18n.getMessage("feedbackLoadMoreRemaining", [String(remaining)]) || `Carregar Mais (${remaining} restantes)`;
        DOM.loadMoreTemplatesContainer.style.display = 'block';
    } else {
        DOM.loadMoreTemplatesContainer.style.display = 'none';
    }
  }
  updateBulkActionsToolbar(); // Atualiza a visibilidade da barra de ações em massa
}

/**
 * Renderiza os botões de filtro de categoria.
 */
function renderizarCategoriasTemplates() {
    if (!DOM.categoriesFilterTemplatesDiv) return;
    const allBtnText = chrome.i18n.getMessage("categoryFilterAll") || "Todas";
    DOM.categoriesFilterTemplatesDiv.innerHTML = ''; // Limpa filtros existentes

    // Botão "Todas"
    const newAllBtn = document.createElement('button');
    newAllBtn.classList.add('category-filter'); newAllBtn.dataset.category = "all";
    newAllBtn.textContent = allBtnText;
    if (activeCategoryFilter === "all") newAllBtn.classList.add("active");
    DOM.categoriesFilterTemplatesDiv.appendChild(newAllBtn);

    // Obtém categorias únicas e as ordena
    const uncatMsg = chrome.i18n.getMessage("feedbackCategoryNone") || "Sem Categoria";
    const cats = [...new Set(currentTemplates.map(t => t.category || uncatMsg))]
        .filter(c => c) // Remove categorias vazias, se houver
        .sort((a, b) => {
            if (a === uncatMsg) return 1; // "Sem Categoria" por último
            if (b === uncatMsg) return -1;
            return a.localeCompare(b, currentSettings.language || 'pt-BR', { sensitivity: 'base' });
        });

    // Cria botão para cada categoria
    cats.forEach(cat => {
        const btn = document.createElement("button");
        btn.classList.add("category-filter"); btn.textContent = cat; btn.dataset.category = cat;
        if (cat === activeCategoryFilter) btn.classList.add("active");
        DOM.categoriesFilterTemplatesDiv.appendChild(btn);
    });
}

/**
 * Atualiza a lista de todas as tags únicas para sugestões de autocompletar.
 */
function updateUniqueTagsList() {
    const tagSet = new Set();
    currentTemplates.forEach(t => {
        if (Array.isArray(t.tags)) t.tags.forEach(tag => tagSet.add(tag));
    });
    allUniqueTagsForSuggestions = Array.from(tagSet).sort((a,b) => a.localeCompare(b, currentSettings.language || 'pt-BR'));
}

/**
 * Manipula a entrada no campo de busca por tags, mostrando sugestões.
 * @param {Event} event - O evento de input.
 */
function handleTagSearchInput(event) {
    const inputValue = event.target.value;
    const lastComma = inputValue.lastIndexOf(',');
    // Pega a parte da tag atual que está sendo digitada
    const currentTagPart = (lastComma === -1 ? inputValue : inputValue.substring(lastComma + 1)).trimStart();

    if (currentTagPart.length > 0) {
        const existingTagsInInput = parseTags(inputValue.substring(0, lastComma + 1));
        const matchingTags = allUniqueTagsForSuggestions.filter(tag =>
            tag.toLowerCase().startsWith(currentTagPart.toLowerCase()) &&
            !existingTagsInInput.includes(tag) // Não sugere tags já inseridas
        );
        renderTagSuggestions(matchingTags, inputValue.substring(0, lastComma + 1));
    } else {
        if (DOM.tagSuggestionsTemplatesDiv) DOM.tagSuggestionsTemplatesDiv.classList.remove('visible');
    }
    debounce(renderizarListaTemplates, 300)(); // Re-renderiza a lista com debounce
}

/**
 * Renderiza as sugestões de tags abaixo do campo de input.
 * @param {Array<string>} matchingTags - Tags que correspondem à digitação atual.
 * @param {string} prefix - Parte da string de tags já inserida antes da tag atual.
 */
function renderTagSuggestions(matchingTags, prefix) {
    if (!DOM.tagSuggestionsTemplatesDiv) return;
    DOM.tagSuggestionsTemplatesDiv.innerHTML = ''; // Limpa sugestões antigas
    if (matchingTags.length > 0) {
        matchingTags.slice(0, 7).forEach(tag => { // Limita a 7 sugestões
            const item = document.createElement('div');
            item.classList.add('suggestion-item'); item.textContent = tag;
            // Usar mousedown para que o clique seja registrado antes do blur do input
            item.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Previne que o input perca o foco imediatamente
                DOM.tagSearchInputTemplates.value = prefix + tag + ", "; // Adiciona a tag e uma vírgula
                DOM.tagSuggestionsTemplatesDiv.classList.remove('visible');
                DOM.tagSearchInputTemplates.focus();
                renderizarListaTemplates(); // Atualiza a lista de templates com a nova tag
            });
            DOM.tagSuggestionsTemplatesDiv.appendChild(item);
        });
        DOM.tagSuggestionsTemplatesDiv.classList.add('visible');
    } else {
        DOM.tagSuggestionsTemplatesDiv.classList.remove('visible');
    }
}

/**
 * Manipula cliques nos botões de ação de um item da lista de modelos ou no próprio item.
 * @param {Event} event - O evento de clique.
 */
async function handleAcaoItemModelo(event) {
    const button = event.target.closest('button.icon-btn');
    const templateItem = event.target.closest('.template-item');

    // Se o clique foi no checkbox, chama a função específica e retorna
    if (event.target.classList.contains('template-checkbox')) {
        handleTemplateCheckboxChange(event);
        return;
    }

    // Se o clique foi na área de conteúdo clicável, expande/recolhe o preview
    if (!button && templateItem && event.target.closest('.template-item-clickable-content')) {
        const previewDiv = templateItem.querySelector('.template-preview');
        if (previewDiv) {
            const isExpanded = previewDiv.classList.toggle('expanded');
            // Recolhe outros previews expandidos
            if (isExpanded) {
                DOM.templatesListDiv.querySelectorAll('.template-preview.expanded').forEach(otherPreview => {
                    if (otherPreview !== previewDiv) otherPreview.classList.remove('expanded');
                });
            }
        }
        return;
    }

    if (!button || !templateItem) return; // Se não foi um botão de ação ou item de template, ignora

    const id = button.dataset.id || templateItem.dataset.id; // Pega o ID do template
    const template = currentTemplates.find(t => t.id === id);

    if (!template) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackTemplateNotFound") || "Erro: Modelo não encontrado.", "error");
        return;
    }

    // Lógica para cada tipo de botão de ação
    if (button.classList.contains('btn-usar-modelo')) {
        button.disabled = true; // Desabilita o botão durante o processamento
        button.innerHTML = `<i class='fa-solid fa-spinner fa-spin'></i>`; // Ícone de carregamento
        try {
            // Processa o conteúdo do template para resolver placeholders automáticos e de constantes
            const result = await processTemplateContentRecursive(
                template.content, currentTemplates, new Set(),
                currentSettings.customConstants || {},
                Object.keys(currentSettings.reusableVariables || {})
            );

            let contentToCopy = result.processedText;
            // Agrupa todas as variáveis que precisam ser solicitadas ao usuário
            const allVarsToRequest = [
                ...result.requiredVars, // {VAR:Label} e {VAR:Label:modificador}
                ...result.requiredInputs, // {INPUT:Instrucao} e {INPUT:Instrucao:modificador}
                // Adiciona variáveis reutilizáveis como um tipo especial para o modal
                ...result.finalUniqueReusableVarNames.map(name => ({ placeholder: `{${name}}`, label: name, type: 'reusable' }))
            ];

            // Se houver variáveis a serem preenchidas, abre o modal
            if (allVarsToRequest.length > 0) {
                contentToCopy = await abrirModalVariaveis(allVarsToRequest, result.processedText, template);
            }

            if (typeof contentToCopy === 'string') { // Se o modal não foi cancelado
                await copiarConteudoParaClipboard(contentToCopy, true); // Copia como HTML
            } else if (contentToCopy === 'cancelled') { // Se foi cancelado explicitamente
                exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackCopyCancelled") || "Cópia cancelada.", "info");
            }
        } catch (error) {
            // Trata erros que não sejam cancelamentos
            if (error !== 'cancelled' && error !== 'cancelled_by_x' && error !== 'cancelled_by_overlay_click') {
                 exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackErrorCopying", [error.message || String(error)]), "error");
            } else {
                 exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackCopyCancelled") || "Cópia cancelada.", "info");
            }
        } finally {
            button.disabled = false; // Reabilita o botão
            button.innerHTML = '<i class="fa-solid fa-copy"></i>'; // Restaura o ícone
        }
    } else if (button.classList.contains('btn-editar-modelo')) {
        abrirModalEdicao(template); // Abre o modal de edição
    } else if (button.classList.contains('btn-clonar-modelo')) {
        // Lógica para clonar o template
        const nomeClone = `${template.name} (${chrome.i18n.getMessage("textCopy") || "Cópia"})`;
        let nomeFinalClone = nomeClone;
        let contador = 1;
        // Garante que o nome do clone seja único
        while (currentTemplates.some(t => t.name === nomeFinalClone)) {
            nomeFinalClone = `${nomeClone} ${contador++}`;
        }
        const templateClonado = clonarTemplate(template, nomeFinalClone); // Função utilitária para clonar
        currentTemplates.push(templateClonado);
        await saveTemplates(currentTemplates);
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackTemplateCloned", [templateClonado.name]) || `Modelo "${templateClonado.name}" clonado!`, "success");
        renderizarListaTemplates();
        renderizarCategoriasTemplates();
        updateUniqueTagsList();
    } else if (button.classList.contains('btn-exportar-modelo')) {
        handleExportarTemplateIndividual(template); // Exporta o template individualmente
    } else if (button.classList.contains('btn-excluir-modelo')) {
        // Confirma e exclui o template
        const confirmMsg = chrome.i18n.getMessage("confirmDeleteTemplate", [template.name]) || `Excluir modelo "${template.name}"?`;
        if (confirm(confirmMsg)) {
            currentTemplates = currentTemplates.filter(t => t.id !== id);
            selectedTemplateIds.delete(id); // Remove de selecionados, se estiver
            await saveTemplates(currentTemplates);
            exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackTemplateDeleted") || "Modelo excluído!", "success");
            renderizarListaTemplates();
            renderizarCategoriasTemplates();
            updateUniqueTagsList();
            updateBulkActionsToolbar();
        }
    }
}

/**
 * Manipula a mudança de estado de um checkbox de template para ações em massa.
 * @param {Event} event - O evento de change do checkbox.
 */
function handleTemplateCheckboxChange(event) {
    const checkbox = event.target;
    const templateId = checkbox.dataset.id;
    if (!templateId) return;
    if (checkbox.checked) selectedTemplateIds.add(templateId);
    else selectedTemplateIds.delete(templateId);
    updateBulkActionsToolbar(); // Atualiza a UI da barra de ações em massa
}

/**
 * Atualiza a visibilidade e o contador da barra de ações em massa.
 */
function updateBulkActionsToolbar() {
    if (!DOM.bulkActionsToolbar || !DOM.bulkSelectedCountSpan || !DOM.bulkActionsHeadingElement) return;
    const count = selectedTemplateIds.size;
    DOM.bulkSelectedCountSpan.textContent = String(count);
    DOM.bulkActionsToolbar.style.display = count > 0 ? 'flex' : 'none'; // Mostra se houver itens selecionados
}

/**
 * Seleciona todos os checkboxes de templates visíveis na lista.
 */
function handleBulkSelectAllVisible() {
    DOM.templatesListDiv.querySelectorAll('.template-checkbox').forEach(checkbox => {
        const templateId = checkbox.dataset.id;
        // Verifica se o template está na lista filtrada e ordenada atualmente visível
        if (templateId && currentFilteredAndSortedTemplates.find(t => t.id === templateId)) {
            checkbox.checked = true;
            selectedTemplateIds.add(templateId);
        }
    });
    updateBulkActionsToolbar();
}

/**
 * Desseleciona todos os checkboxes de templates.
 */
function handleBulkDeselectAll() {
    DOM.templatesListDiv.querySelectorAll('.template-checkbox:checked').forEach(checkbox => {
        checkbox.checked = false;
    });
    selectedTemplateIds.clear();
    updateBulkActionsToolbar();
}

/**
 * Exclui todos os templates selecionados para ações em massa.
 */
async function handleBulkDeleteSelected() {
    if (selectedTemplateIds.size === 0) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackNoTemplatesSelected") || "Nenhum modelo selecionado.", "warning");
        return;
    }
    const confirmMsg = chrome.i18n.getMessage("confirmBulkDelete", [String(selectedTemplateIds.size)]) || `Tem certeza que deseja excluir ${selectedTemplateIds.size} modelo(s) selecionado(s)?`;
    if (confirm(confirmMsg)) {
        try {
            currentTemplates = currentTemplates.filter(template => !selectedTemplateIds.has(template.id));
            await saveTemplates(currentTemplates);
            exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackBulkDeleteSuccess", [String(selectedTemplateIds.size)]) || `${selectedTemplateIds.size} modelo(s) excluído(s)!`, "success");
            selectedTemplateIds.clear(); // Limpa a seleção
            renderizarListaTemplates();
            renderizarCategoriasTemplates();
            updateUniqueTagsList();
            updateBulkActionsToolbar();
        } catch (error) {
            exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackBulkDeleteError") || "Erro ao excluir modelos selecionados.", "error", 3000, error);
        }
    }
}

/**
 * Adiciona uma categoria a todos os templates selecionados.
 */
async function handleBulkAddCategoryToSelected() {
    const newCategory = DOM.bulkCategoryInput.value.trim();
    if (!newCategory) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackBulkAddCategoryNameRequired") || "Por favor, insira um nome de categoria.", "warning");
        DOM.bulkCategoryInput.focus();
        return;
    }
    if (selectedTemplateIds.size === 0) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackNoTemplatesSelected") || "Nenhum modelo selecionado.", "warning");
        return;
    }
    try {
        let updatedCount = 0;
        currentTemplates.forEach(template => {
            if (selectedTemplateIds.has(template.id)) {
                template.category = newCategory;
                template.lastModified = new Date().toISOString();
                updatedCount++;
            }
        });
        await saveTemplates(currentTemplates);
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackBulkAddCategorySuccess", [newCategory, String(updatedCount)]) || `Categoria "${newCategory}" adicionada a ${updatedCount} modelo(s).`, "success");
        DOM.bulkCategoryInput.value = ""; // Limpa o input
        handleBulkDeselectAll(); // Desseleciona após a ação
        renderizarListaTemplates();
        renderizarCategoriasTemplates(); // Atualiza a lista de filtros de categoria
    } catch (error) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackBulkAddCategoryError") || "Erro ao adicionar categoria.", "error", 3000, error);
    }
}

/**
 * Adiciona tags a todos os templates selecionados.
 */
async function handleBulkAddTagsToSelected() {
    const tagsToAdd = parseTags(DOM.bulkTagsInput.value);
    if (tagsToAdd.length === 0) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackBulkAddTagsRequired") || "Por favor, insira pelo menos uma tag válida.", "warning");
        DOM.bulkTagsInput.focus();
        return;
    }
    if (selectedTemplateIds.size === 0) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackNoTemplatesSelected") || "Nenhum modelo selecionado.", "warning");
        return;
    }
    try {
        let updatedCount = 0;
        currentTemplates.forEach(template => {
            if (selectedTemplateIds.has(template.id)) {
                template.tags = Array.isArray(template.tags) ? template.tags : [];
                const currentTagsSet = new Set(template.tags);
                tagsToAdd.forEach(tag => currentTagsSet.add(tag)); // Adiciona novas tags, evitando duplicatas
                template.tags = Array.from(currentTagsSet).sort((a,b) => a.localeCompare(b, currentSettings.language || 'pt-BR'));
                template.lastModified = new Date().toISOString();
                updatedCount++;
            }
        });
        await saveTemplates(currentTemplates);
        updateUniqueTagsList(); // Atualiza a lista de tags para sugestões
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackBulkAddTagsSuccess", [String(updatedCount)]) || `Tags adicionadas a ${updatedCount} modelo(s).`, "success");
        DOM.bulkTagsInput.value = ""; // Limpa o input
        handleBulkDeselectAll(); // Desseleciona após a ação
        renderizarListaTemplates();
    } catch (error) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackBulkAddTagsError") || "Erro ao adicionar tags.", "error", 3000, error);
    }
}

/**
 * Manipula o clique no botão "Inspecionar Placeholders" do editor principal.
 */
function handleInspecionarPlaceholdersEditorPrincipal() {
    if (!quillEditorCreate) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackErrorEditorNotReady") || "Editor não está pronto.", "error");
        return;
    }
    const conteudo = quillEditorCreate.root.innerHTML; // Pega o HTML do editor
    const resultado = inspecionarPlaceholders( // Chama a função de inspeção
        conteudo,
        currentSettings.customConstants || {},
        currentTemplates,
        Object.keys(currentSettings.reusableVariables || {})
    );
    exibirResultadoInspecao(resultado); // Mostra os resultados no modal
}

/**
 * Exibe os resultados da inspeção de placeholders em um modal.
 * @param {object} resultado - O objeto retornado por `inspecionarPlaceholders`.
 */
function exibirResultadoInspecao(resultado) {
    // Função auxiliar para popular uma lista <ul> com itens
    const popularLista = (elementId, items, formatFn = item => `<li>${escapeHTML(item)}</li>`) => {
        const ul = DOM.inspectorContent[elementId]; // Acessa o elemento <ul> pelo ID no objeto DOM
        if (ul) {
            if (items && items.length > 0) {
                ul.innerHTML = items.map(formatFn).join('');
            } else {
                ul.innerHTML = `<li class="empty-list-message">${chrome.i18n.getMessage("inspectorNoPlaceholders") || "Nenhum placeholder deste tipo encontrado."}</li>`;
            }
        }
    };

    // Popula cada seção do modal de inspeção
    popularLista('automaticos', resultado.automaticos);
    popularLista('constantesDef', resultado.constantes.definidas);
    popularLista('constantesUndef', resultado.constantes.indefinidas);
    popularLista('variaveis', resultado.variaveis);
    popularLista('inputs', resultado.inputs);
    popularLista('reutilizaveis', resultado.reutilizaveis);
    popularLista('invocacoesExist', resultado.invocacoes.existentes, item => `<li>{{${escapeHTML(item)}}}</li>`);
    popularLista('invocacoesNonexist', resultado.invocacoes.inexistentes, item => `<li>{{${escapeHTML(item)}}}</li>`);

    DOM.inspectorModal.classList.add('active'); // Mostra o modal
}

/**
 * Destaca placeholders no conteúdo HTML para exibição no preview da lista.
 * @param {string} htmlContent - O conteúdo HTML do template.
 * @param {object} customConstants - As constantes personalizadas definidas.
 * @param {Array<string>} reusableVariableNames - Nomes das variáveis reutilizáveis.
 * @returns {string} Conteúdo HTML com placeholders destacados.
 */
function highlightPlaceholdersInHtml(htmlContent, customConstants, reusableVariableNames) {
    if (!htmlContent) return "";
    let tempContent = htmlContent;

    const placeholderTypes = [
        { regex: /(\{DATA(:format\([^)]+\))?\})/gi, className: 'auto' },
        { regex: /(\{(?:HORA|DATA_HORA|DD\/MM\/YYYY|HH:mm:ss|SEMANA|URL|TITLE|CLIPBOARD)\})/gi, className: 'auto' },
        { regex: /(\{VAR:[^:}]+(?::[^}]+)?\})/gi, className: 'var' },
        { regex: /(\{INPUT:[^:}]+(?::[^}]+)?\})/gi, className: 'input' },
        { regex: /(\{\{[^}]+\}\})/gi, className: 'invocation' }
    ];

    // Destaca constantes e variáveis reutilizáveis primeiro
    if (customConstants) {
        Object.keys(customConstants).forEach(name => {
            const regex = new RegExp(escapeRegExp(`{${name}}`), 'g');
            tempContent = tempContent.replace(regex, `<span class="placeholder-highlight constant" title="Constante: ${name}">{${name}}</span>`);
        });
    }
    if (reusableVariableNames) {
        reusableVariableNames.forEach(name => {
            const regex = new RegExp(escapeRegExp(`{${name}}`), 'g');
            // Evita re-highlight se já foi destacado como constante (pouco provável, mas seguro)
            if (!tempContent.includes(`<span class="placeholder-highlight constant" title="Constante: ${name}">{${name}}</span>`)) {
                 tempContent = tempContent.replace(regex, `<span class="placeholder-highlight reusable-var" title="Variável Reutilizável: ${name}">{${name}}</span>`);
            }
        });
    }

    // Destaca outros tipos de placeholders
    placeholderTypes.forEach(type => {
        tempContent = tempContent.replace(type.regex, (match) => {
            // Evita re-highlighting de partes já destacadas
            if (match.includes('placeholder-highlight')) return match;
            return `<span class="placeholder-highlight ${type.className}" title="Placeholder: ${match}">${match}</span>`;
        });
    });
    return tempContent;
}


// --- FIM DA PARTE 3 ---
// popup.js - Script principal para a extensão Facilita (Parte 4)

// (Continuação das Partes 1, 2 e 3)
// ...

// --- FUNÇÕES DE COPIAR E MODAIS ---

/**
 * Copia conteúdo (HTML ou texto) para a área de transferência e tenta injetar na aba ativa.
 * @param {string} htmlContent - O conteúdo HTML a ser copiado/inserido.
 * @param {boolean} [isHtml=true] - Indica se o conteúdo é HTML ou texto puro.
 */
async function copiarConteudoParaClipboard(htmlContent, isHtml = true) {
  try {
    // Converte o HTML para texto puro para fallback ou para o clipboard de texto simples
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;
    const plainText = tempDiv.textContent || tempDiv.innerText || "";

    if (isHtml && navigator.clipboard && typeof navigator.clipboard.write === 'function') {
        // Tenta copiar como HTML e texto simples para a área de transferência moderna
        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
        const textBlob = new Blob([plainText], { type: 'text/plain' });
        await navigator.clipboard.write([
            new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })
        ]);
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackCopiedWithFormat") || "Copiado com formatação!", "success");
    } else {
        // Fallback para texto simples se a API de HTML não estiver disponível ou não for desejada
        await navigator.clipboard.writeText(plainText);
        exibirFeedbackGlobal(chrome.i18n.getMessage(isHtml ? "feedbackCopiedAsText" : "feedbackTextCopied") || (isHtml ? "Copiado como texto." : "Texto copiado!"), isHtml ? "info" : "success");
    }

     // Tenta injetar o conteúdo na aba ativa através do content script
     try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab && activeTab.id) {
            // Envia mensagem para o content script para tentar inserir o HTML
            chrome.tabs.sendMessage(activeTab.id, { type: "INSERT_TEMPLATE", content: htmlContent }, response => {
                if (chrome.runtime.lastError) {
                    // Não mostra erro se o content script não estiver presente (ex: página de nova aba)
                    if (!chrome.runtime.lastError.message.includes("Receiving end does not exist")) {
                        console.warn("Facilita: Erro ao enviar para content script:", chrome.runtime.lastError.message);
                    }
                } else if (response && !response.success) {
                    console.warn("Facilita: Content script falhou ao inserir:", response.message);
                    // Não mostra feedback de erro aqui, pois o texto já foi copiado para o clipboard
                } else if (response && response.success) {
                    console.log("Facilita: Conteúdo inserido pelo content script.");
                    // O feedback de sucesso da cópia já foi dado.
                }
            });
        }
    } catch (e) {
        console.warn("Facilita: Não foi possível enviar para o content script:", e);
    }
  } catch (err) {
    console.error("Facilita: Erro ao copiar para clipboard:", err);
    exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackFailedToCopy") || "Falha ao copiar para a área de transferência.", "error");
    throw err; // Re-throw para que o chamador possa tratar
  }
}

/**
 * Função auxiliar para copiar o conteúdo de um elemento HTML.
 * @param {HTMLElement} element - O elemento do qual copiar o conteúdo.
 * @param {boolean} [isTextarea=false] - Se true, pega o .value (para textareas/inputs).
 * @param {boolean} [isHtmlContent=false] - Se true e não for textarea, pega .innerHTML.
 */
function copiarConteudoElemento(element, isTextarea = false, isHtmlContent = false) {
    if (!element) return;
    const content = isTextarea ? element.value : (isHtmlContent ? element.innerHTML : element.textContent);
    copiarConteudoParaClipboard(content, isHtmlContent && !isTextarea)
        .catch(() => {}); // Erros já são tratados em copiarConteudoParaClipboard
}


/**
 * Abre o modal para o usuário preencher as variáveis de um template.
 * @param {Array<object>} variaveisParaPreencher - Array de objetos de variáveis.
 * @param {string} conteudoProcessadoInicial - Conteúdo do template com placeholders automáticos/constantes já resolvidos.
 * @param {object} templateOriginal - O objeto do template original, para o preview.
 * @returns {Promise<string|'cancelled'>} O conteúdo final processado ou 'cancelled'.
 */
function abrirModalVariaveis(variaveisParaPreencher, conteudoProcessadoInicial, templateOriginal) {
  return new Promise((resolve, reject) => {
    variableModalResolve = resolve;
    variableModalReject = reject;
    contentForVariableModal = conteudoProcessadoInicial; // Conteúdo base para substituições
    currentTemplateForVariableModal = templateOriginal; // Para o preview
    DOM.variableInputsContainer.innerHTML = ''; // Limpa inputs anteriores
    let primeiroInput = null;

    // Função interna para criar cada campo de input no modal
    const criarCampo = (item, tipoItem, indice) => {
        const div = document.createElement('div');
        div.className = 'form-group';
        const labelEl = document.createElement('label');
        // A legenda é o 'label' da variável (ex: "Nome do Cliente" de {VAR:Nome do Cliente})
        labelEl.textContent = `${item.label}:`;
        const inputId = `${tipoItem}Input_${indice}`; // ID único para o input
        labelEl.htmlFor = inputId;
        div.appendChild(labelEl);

        let inputEl;
        // Usa textarea para {INPUT:...} e input[type=text] para {VAR:...} e reutilizáveis
        if (item.placeholder && item.placeholder.startsWith('{INPUT:')) {
            inputEl = document.createElement('textarea');
            inputEl.rows = 3;
        } else {
            inputEl = document.createElement('input');
            inputEl.type = 'text';
        }
        inputEl.id = inputId;
        inputEl.dataset.placeholderOriginal = item.placeholder; // Armazena o placeholder original
        if (item.type === 'reusable') inputEl.dataset.reusableVarName = item.label; // Nome da variável reutilizável
        else inputEl.dataset.varLabel = item.label; // Label da variável VAR/INPUT

        inputEl.required = true; // Torna todos os campos de variáveis obrigatórios
        div.appendChild(inputEl);
        DOM.variableInputsContainer.appendChild(div);
        if (!primeiroInput) primeiroInput = inputEl; // Define o foco para o primeiro input
    };

    // Filtra e agrupa os tipos de variáveis para exibição organizada
    const variaveisReutilizaveisUnicas = variaveisParaPreencher.filter(v => v.type === 'reusable');
    const variaveisVar = variaveisParaPreencher.filter(v => v.placeholder && v.placeholder.startsWith('{VAR:'));
    const variaveisInput = variaveisParaPreencher.filter(v => v.placeholder && v.placeholder.startsWith('{INPUT:'));

    // Cria seções e campos para cada tipo de variável
    if (variaveisReutilizaveisUnicas.length > 0) {
        const h5 = document.createElement('h5');
        h5.textContent = chrome.i18n.getMessage("varModalReusableVarsTitle") || "Variáveis Reutilizáveis:";
        DOM.variableInputsContainer.appendChild(h5);
        variaveisReutilizaveisUnicas.forEach((v, i) => criarCampo(v, 'reusable', i));
    }
    if (variaveisVar.length > 0) {
        const h5 = document.createElement('h5');
        h5.textContent = chrome.i18n.getMessage("varModalInstanceVarsTitle") || "Variáveis de Instância ({VAR:...}):";
        DOM.variableInputsContainer.appendChild(h5);
        variaveisVar.forEach((v, i) => criarCampo(v, 'var', i));
    }
    if (variaveisInput.length > 0) {
        const h5 = document.createElement('h5');
        h5.textContent = chrome.i18n.getMessage("varModalInputVarsTitle") || "Entradas de Múltiplas Linhas ({INPUT:...}):";
        DOM.variableInputsContainer.appendChild(h5);
        variaveisInput.forEach((v, i) => criarCampo(v, 'input', i));
    }

    // Se houver variáveis para preencher, mostra o modal e foca no primeiro campo
    if (variaveisParaPreencher.length > 0) {
        DOM.variableModal.classList.add('active');
        if (primeiroInput) primeiroInput.focus();
    } else {
        // Se não houver variáveis, resolve a promise imediatamente com o conteúdo já processado
        resolve(conteudoProcessadoInicial);
    }
  });
}

/**
 * Fecha o modal de variáveis e rejeita a promise se necessário.
 * @param {boolean} [rejeitarPromise=false] - Se true, rejeita a promise pendente.
 */
function fecharModalVariaveis(rejeitarPromise = false) {
    DOM.variableModal.classList.remove('active');
    if (rejeitarPromise && variableModalReject) {
        variableModalReject('cancelled'); // Sinaliza que foi cancelado pelo usuário
    }
    // Limpa as referências da promise e dados temporários
    variableModalResolve = null;
    variableModalReject = null;
    contentForVariableModal = "";
    currentTemplateForVariableModal = null;
}

/**
 * Manipula o submit do formulário do modal de variáveis.
 * Substitui os placeholders no conteúdo do template com os valores fornecidos pelo usuário.
 * @param {Event} event - O evento de submit do formulário.
 */
function handleSubmeterVariaveisModal(event) {
    event.preventDefault();
    let conteudoFinal = contentForVariableModal; // Começa com o conteúdo parcialmente processado
    const valoresColetados = {}; // Armazena os valores inseridos pelo usuário

    // Coleta valores de todos os inputs e textareas dentro do container de variáveis
    DOM.variableInputsContainer.querySelectorAll('input[type="text"], textarea').forEach(el => {
        const placeholderOriginal = el.dataset.placeholderOriginal;
        const varLabel = el.dataset.varLabel; // Para VAR e INPUT
        const reusableVarName = el.dataset.reusableVarName; // Para reutilizáveis

        let valor = el.value;
        let chaveParaSubstituicao = placeholderOriginal; // O placeholder completo, ex: {VAR:Nome:mod}

        if (reusableVarName) { // Se for variável reutilizável
            chaveParaSubstituicao = `{${reusableVarName}}`; // O placeholder é só {NOME_VAR}
            // Variáveis reutilizáveis não têm modificadores no ponto de uso {NOME_VAR}
            // A formatação delas viria da definição da constante, se aplicável (já tratado antes)
        } else if (varLabel && placeholderOriginal) { // Se for VAR ou INPUT
            const match = placeholderOriginal.match(/^\{(?:VAR|INPUT):[^:}]+(:([^}]+))?\}/);
            const modificador = match ? match[2] : null; // Extrai o modificador, se houver
            if (modificador) {
                valor = formatarNumeroComModificador(valor, modificador);
            }
        }
        // Para {INPUT:...}, o conteúdo pode ser multilinha. Converte quebras de linha para <br> se for HTML.
        // A cópia final decidirá se usa HTML ou texto puro. Aqui, preparamos o valor.
        const valorFormatado = placeholderOriginal && placeholderOriginal.startsWith("{INPUT:")
                             ? escapeHTML(valor).replace(/\n/g, '<br>')
                             : escapeHTML(valor); // Escapa HTML para segurança, exceto para INPUT que já é tratado

        valoresColetados[chaveParaSubstituicao] = valorFormatado;
    });

    // Substitui todos os placeholders no conteúdo final
    for (const placeholder in valoresColetados) {
        const regex = new RegExp(escapeRegExp(placeholder), 'g');
        conteudoFinal = conteudoFinal.replace(regex, valoresColetados[placeholder]);
    }

    if (variableModalResolve) {
        variableModalResolve(conteudoFinal); // Resolve a promise com o conteúdo totalmente processado
    }
    fecharModalVariaveis(); // Fecha o modal
}

/**
 * Abre o modal para edição de um template existente.
 * @param {object} template - O objeto do template a ser editado.
 */
function abrirModalEdicao(template) {
    if (!quillEditorEditModal) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackErrorEditorNotReady") || "Editor não está pronto.", "error");
        return;
    }
    DOM.editTemplateForm.dataset.editandoId = template.id; // Armazena o ID no formulário
    DOM.editTemplateNameInput.value = template.name;
    DOM.editTemplateCategoryInput.value = template.category || "";
    DOM.editTemplateTagsInput.value = (template.tags || []).join(', ');
    try {
        quillEditorEditModal.root.innerHTML = template.content; // Carrega o conteúdo HTML no editor
        updateEditorCounter(quillEditorEditModal, DOM.editModalEditorCounter); // Atualiza contador
    } catch (e) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackErrorLoadingContent") || "Erro ao carregar conteúdo.", "error", 3000, DOM.feedbackAreaEditModal, e);
        quillEditorEditModal.setText(chrome.i18n.getMessage("feedbackErrorLoadingContent") || "Erro ao carregar conteúdo.");
    }
    atualizarBotoesCamposDinamicos(DOM.dynamicFieldsContainerModal); // Atualiza placeholders no modal
    DOM.editModal.classList.add('active'); // Mostra o modal
    DOM.editTemplateNameInput.focus(); // Foca no campo de nome
}

/**
 * Fecha o modal de edição de template.
 */
function fecharModalEdicao() {
    DOM.editModal.classList.remove('active');
    delete DOM.editTemplateForm.dataset.editandoId; // Remove o ID de edição
    DOM.editTemplateForm.reset(); // Limpa o formulário
    if (quillEditorEditModal) quillEditorEditModal.setContents([{ insert: '\n' }]); // Limpa o editor do modal
    if (DOM.feedbackAreaEditModal) DOM.feedbackAreaEditModal.classList.remove('show'); // Limpa feedback
}

/**
 * Manipula o salvamento das edições de um template.
 * Reutiliza a função handleSalvarNovoModelo, que já diferencia entre criar e editar.
 * @param {Event} event - O evento de submit do formulário de edição.
 */
async function handleSalvarEdicaoModelo(event) {
    event.preventDefault();
    await handleSalvarNovoModelo(event); // Chama a função unificada de salvar/atualizar
}

/**
 * Abre o modal de pré-visualização com o conteúdo processado do template.
 * @param {object} template - O objeto do template original.
 * @param {string} conteudoProcessado - O conteúdo HTML do template após o processamento de variáveis.
 */
async function abrirModalPreview(template, conteudoProcessado) {
    if (!DOM.previewModal || !DOM.previewContentDiv || !DOM.previewModalTitle) return;

    DOM.previewModalTitle.textContent = `${chrome.i18n.getMessage("modalTitlePreview") || "Pré-visualização do Modelo"} - ${escapeHTML(template.name)}`;
    const editorPreview = DOM.previewContentDiv.querySelector('.ql-editor');
    if (editorPreview) {
        editorPreview.innerHTML = conteudoProcessado; // Define o conteúdo no div do editor Quill
    } else {
        // Fallback se a estrutura interna do ql-snow não for encontrada (improvável)
        DOM.previewContentDiv.innerHTML = `<div class="ql-editor">${conteudoProcessado}</div>`;
    }
    // Armazena o conteúdo para o botão "Copiar" do preview
    DOM.btnCopiarPreview.dataset.contentToCopy = conteudoProcessado;
    DOM.previewModal.classList.add('active'); // Mostra o modal
}


/**
 * Manipula a exportação de um template individual como arquivo JSON.
 * @param {object} template - O objeto do template a ser exportado.
 */
function handleExportarTemplateIndividual(template) {
    if (!template) return;
    try {
        const exportData = {
            exportType: "FacilitaSingleTemplate", // Identificador do tipo de exportação
            version: chrome.runtime.getManifest().version, // Versão da extensão
            exportedAt: new Date().toISOString(),
            template: template // O objeto do template
        };
        const jsonStr = JSON.stringify(exportData, null, 2); // Formata o JSON com indentação
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        // Cria um nome de arquivo seguro
        const safeName = (template.name || "template").replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
        const filename = `facilita_template_${safeName}_${template.id.substring(0,5)}.json`;

        // Usa a API de downloads do Chrome
        chrome.downloads.download({ url, filename, saveAs: true }, downloadId => {
            if (chrome.runtime.lastError) {
                exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackErrorExporting") || "Erro ao exportar.", "error", 5000, chrome.runtime.lastError);
            } else if (downloadId === undefined && !chrome.runtime.lastError) {
                 // O usuário pode ter cancelado o diálogo "Salvar Como"
                 console.log("Facilita: Download de template individual cancelado ou falhou sem erro explícito.");
            } else {
                exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackExportSingleSuccess", [template.name]) || `Modelo "${template.name}" exportado!`, "success");
            }
            URL.revokeObjectURL(url); // Libera o objeto URL
        });
    } catch (error) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackErrorPreparingExport") || "Erro ao preparar template para exportação.", "error", 3000, error);
    }
}


// --- FIM DA PARTE 4 ---
// popup.js - Script principal para a extensão Facilita (Parte 5)

// (Continuação das Partes 1, 2, 3 e 4)
// ...

// --- SEÇÃO: FERRAMENTAS DE TEXTO ---

/**
 * Configura os event listeners para a aba "Ferramentas de Texto".
 */
function configurarEventListenersFerramentasTexto() {
  // Sub-aba: Número por Extenso
  if (DOM.btnConverterExtenso) DOM.btnConverterExtenso.addEventListener('click', handleConverterNumeroParaExtenso);
  if (DOM.btnCopiarExtenso) DOM.btnCopiarExtenso.addEventListener('click', () => copiarConteudoElemento(DOM.resultadoExtensoDiv, false, false));

  // Sub-aba: Limpeza de Texto
  if (DOM.textoParaLimparTextarea) DOM.textoParaLimparTextarea.addEventListener('input', debounce(atualizarContadoresLimpezaTexto, 200));
  if (DOM.habilitarFindReplaceCheckbox) DOM.habilitarFindReplaceCheckbox.addEventListener('change', toggleFindReplaceFields);
  if (DOM.btnAplicarLimpeza) DOM.btnAplicarLimpeza.addEventListener('click', handleAplicarLimpezaTexto);
  if (DOM.btnCopiarLimpo) DOM.btnCopiarLimpo.addEventListener('click', () => copiarConteudoElemento(DOM.textoLimpoResultadoTextarea, true, false));

  // Inicializa o estado dos campos de localizar/substituir
  if (DOM.habilitarFindReplaceCheckbox) toggleFindReplaceFields();
}

/**
 * Manipula a conversão de um número para sua forma escrita por extenso.
 * Utiliza a função `numeroParaExtenso` do módulo `textTools.js`.
 */
function handleConverterNumeroParaExtenso() {
    const numeroStr = DOM.numeroParaExtensoInput.value;
    const usarReais = DOM.usarReaisCheckbox.checked;
    const usarFeminino = DOM.numeroFemininoCheckbox.checked;

    if (!numeroStr.trim()) {
        // Exibe feedback na área específica do resultado, se possível, senão global
        const feedbackArea = DOM.resultadoExtensoDiv ? DOM.resultadoExtensoDiv.closest('.result-box') || DOM.feedbackGlobalArea : DOM.feedbackGlobalArea;
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackInvalidNumber") || "Digite um número válido.", "error", 3000, feedbackArea);
        if(DOM.resultadoExtensoDiv) DOM.resultadoExtensoDiv.textContent = "";
        if(DOM.btnCopiarExtenso) DOM.btnCopiarExtenso.disabled = true;
        return;
    }

    // A biblioteca `extenso` espera vírgula como separador decimal.
    // A função `numeroParaExtenso` já faz a substituição de '.' por ',', mas é bom garantir.
    const numeroParaLib = numeroStr.replace(',', '.');

    // Validação adicional para garantir que é um número antes de passar para a lib
    if (isNaN(parseFloat(numeroParaLib))) {
         const feedbackArea = DOM.resultadoExtensoDiv ? DOM.resultadoExtensoDiv.closest('.result-box') || DOM.feedbackGlobalArea : DOM.feedbackGlobalArea;
         exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackInvalidNumber") || "Digite um número válido.", "error", 3000, feedbackArea);
         if(DOM.resultadoExtensoDiv) DOM.resultadoExtensoDiv.textContent = "";
         if(DOM.btnCopiarExtenso) DOM.btnCopiarExtenso.disabled = true;
        return;
    }

    try {
        const resultado = numeroParaExtenso(numeroParaLib, { moeda: usarReais, feminino: usarFeminino });
        if(DOM.resultadoExtensoDiv) DOM.resultadoExtensoDiv.textContent = resultado;
        if(DOM.btnCopiarExtenso) DOM.btnCopiarExtenso.disabled = false;
    } catch (error) {
        console.error("Facilita: Erro ao converter número para extenso:", error);
        if(DOM.resultadoExtensoDiv) DOM.resultadoExtensoDiv.textContent = chrome.i18n.getMessage("feedbackErrorConvertingNumber") || "Erro ao converter. Verifique o formato.";
        if(DOM.btnCopiarExtenso) DOM.btnCopiarExtenso.disabled = true;
    }
}

/**
 * Atualiza os contadores de caracteres e palavras para as textareas de limpeza de texto.
 */
function atualizarContadoresLimpezaTexto() {
    if (DOM.textoParaLimparTextarea && DOM.contadorTextoOriginalDiv) {
        const statsOriginal = contarElementos(DOM.textoParaLimparTextarea.value);
        DOM.contadorTextoOriginalDiv.textContent = chrome.i18n.getMessage("charCounterText", [String(statsOriginal.caracteresComEspacos), String(statsOriginal.palavras)]) || `${statsOriginal.caracteresComEspacos} caracteres, ${statsOriginal.palavras} palavras`;
    }
    if (DOM.textoLimpoResultadoTextarea && DOM.contadorTextoLimpoDiv) {
        const statsLimpo = contarElementos(DOM.textoLimpoResultadoTextarea.value);
        DOM.contadorTextoLimpoDiv.textContent = chrome.i18n.getMessage("charCounterText", [String(statsLimpo.caracteresComEspacos), String(statsLimpo.palavras)]) || `${statsLimpo.caracteresComEspacos} caracteres, ${statsLimpo.palavras} palavras`;
    }
}

/**
 * Habilita ou desabilita os campos de "Localizar" e "Substituir" com base no checkbox.
 */
function toggleFindReplaceFields() {
    if (!DOM.habilitarFindReplaceCheckbox || !DOM.findTextInput || !DOM.replaceTextInput) return;
    const habilitado = DOM.habilitarFindReplaceCheckbox.checked;
    DOM.findTextInput.disabled = !habilitado;
    DOM.replaceTextInput.disabled = !habilitado;
    if (!habilitado) {
        DOM.findTextInput.value = '';
        DOM.replaceTextInput.value = '';
    }
}

/**
 * Aplica as opções de limpeza selecionadas ao texto original e exibe o resultado.
 */
function handleAplicarLimpezaTexto() {
    if (!DOM.textoParaLimparTextarea || !DOM.textoLimpoResultadoTextarea) return;

    const textoOriginal = DOM.textoParaLimparTextarea.value;
    if (!textoOriginal.trim()) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackEnterTextToClean") || "Digite ou cole um texto para limpar.", "warning");
        DOM.textoLimpoResultadoTextarea.value = "";
        atualizarContadoresLimpezaTexto();
        if(DOM.btnCopiarLimpo) DOM.btnCopiarLimpo.disabled = true;
        return;
    }

    const opcoes = {
        unirParagrafos: DOM.unirParagrafosCheckbox?.checked || false,
        removerEspacosDuplos: DOM.removerEspacosDuplosCheckbox?.checked || false,
        removerEspacosBordas: DOM.removerEspacosBordasCheckbox?.checked || false,
        converterMaiusculas: DOM.converterMaiusculasCheckbox?.checked || false,
        converterMinusculas: DOM.converterMinusculasCheckbox?.checked || false,
        converterTitulo: DOM.converterTituloCheckbox?.checked || false,
        removerMarcadores: DOM.removerMarcadoresCheckbox?.checked || false
    };

    let textoProcessado = limparTexto(textoOriginal, opcoes);

    if (DOM.habilitarFindReplaceCheckbox?.checked && DOM.findTextInput && DOM.replaceTextInput) {
        // A função localizarESubstituir já lida com caseSensitive (o default é true)
        // Se precisar de um checkbox para caseSensitive, adicione-o e passe o valor aqui.
        textoProcessado = localizarESubstituir(textoProcessado, DOM.findTextInput.value, DOM.replaceTextInput.value /*, caseSensitiveCheckbox.checked */);
    }

    const ordem = DOM.ordenarLinhasSelect?.value;
    if (ordem && (ordem === "asc" || ordem === "desc")) {
        textoProcessado = ordenarLinhas(textoProcessado, ordem);
    }

    DOM.textoLimpoResultadoTextarea.value = textoProcessado;
    atualizarContadoresLimpezaTexto();
    if(DOM.btnCopiarLimpo) DOM.btnCopiarLimpo.disabled = !textoProcessado;
    exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackTextCleaned") || "Texto limpo com sucesso!", "success");
}


// --- FIM DA PARTE 5 ---
// popup.js - Script principal para a extensão Facilita (Parte 6)

// (Continuação das Partes 1, 2, 3, 4 e 5)
// ...

// --- SEÇÃO: DOCUMENTOS E CONSULTAS ---

/**
 * Configura os event listeners para a aba "Documentos e Consultas".
 */
function configurarEventListenersDocumentos() {
  // Sub-aba: Formatar Documentos
  if (DOM.btnFormatarDoc) DOM.btnFormatarDoc.addEventListener('click', handleFormatarDocumento);
  if (DOM.btnLimparDoc) DOM.btnLimparDoc.addEventListener('click', handleLimparFormatacaoDocumento);
  if (DOM.btnCopiarDocFormatado) DOM.btnCopiarDocFormatado.addEventListener('click', () => copiarConteudoElemento(DOM.resultadoDocFormatadoDiv, false, false));

  // Sub-aba: Consulta de Processo TJSP
  if (DOM.btnGerarLinkProcesso) DOM.btnGerarLinkProcesso.addEventListener('click', handleGerarLinkProcessoTJSP);
  // O botão de copiar link do processo é adicionado dinamicamente, seu listener também será.
}

/**
 * Formata o número do documento (CPF, CNPJ, RG, Processo CNJ) inserido pelo usuário.
 */
function handleFormatarDocumento() {
    const tipo = DOM.docTipoSelect.value;
    const numero = DOM.docNumeroInput.value;
    let formatado = "";
    const feedbackArea = DOM.resultadoDocFormatadoDiv ? DOM.resultadoDocFormatadoDiv.closest('.result-box') || DOM.feedbackGlobalArea : DOM.feedbackGlobalArea;


    if (!numero.trim()) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackInvalidDocNumber") || "Digite um número válido.", "error", 3000, feedbackArea);
        if (DOM.resultadoDocFormatadoDiv) DOM.resultadoDocFormatadoDiv.textContent = "";
        if (DOM.btnCopiarDocFormatado) DOM.btnCopiarDocFormatado.disabled = true;
        return;
    }

    switch (tipo) {
        case 'cpf': formatado = formatarCPF(numero); break;
        case 'cnpj': formatado = formatarCNPJ(numero); break;
        case 'rg': formatado = formatarRG(numero); break;
        case 'processo': formatado = formatarProcessoCNJ(numero); break;
        default:
             exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackErrorFormattingDoc") || "Tipo de documento inválido.", "error", 3000, feedbackArea);
             formatado = numero; // Retorna o original se o tipo for desconhecido
    }

    if (DOM.resultadoDocFormatadoDiv) DOM.resultadoDocFormatadoDiv.textContent = formatado;
    if (DOM.btnCopiarDocFormatado) DOM.btnCopiarDocFormatado.disabled = !formatado || formatado === numero.replace(/\D/g, '');
}

/**
 * Remove a formatação do número do documento inserido, mantendo apenas os dígitos.
 */
function handleLimparFormatacaoDocumento() {
    const tipo = DOM.docTipoSelect.value;
    const numero = DOM.docNumeroInput.value;
    let limpo = "";

    switch (tipo) {
        case 'cpf': limpo = limparCPF(numero); break;
        case 'cnpj': limpo = limparCNPJ(numero); break;
        case 'rg': limpo = limparRG(numero); break;
        case 'processo': limpo = limparProcessoCNJ(numero); break;
        default:
            limpo = String(numero).replace(/\D/g, ''); // Comportamento padrão se o tipo for desconhecido
    }

    if (DOM.docNumeroInput) DOM.docNumeroInput.value = limpo; // Atualiza o input com o valor limpo
    if (DOM.resultadoDocFormatadoDiv) DOM.resultadoDocFormatadoDiv.textContent = limpo;
    if (DOM.btnCopiarDocFormatado) DOM.btnCopiarDocFormatado.disabled = !limpo;
}

/**
 * Gera e exibe um link para consulta de processo no TJSP.
 */
async function handleGerarLinkProcessoTJSP() {
    const numeroProcesso = DOM.numeroProcessoTJSPInput.value;
    const instancia = DOM.selectInstanciaTJSP.value;
    const feedbackArea = DOM.resultadoLinkProcessoDiv ? DOM.resultadoLinkProcessoDiv.closest('.result-box') || DOM.feedbackGlobalArea : DOM.feedbackGlobalArea;

    if (!numeroProcesso.trim()) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackInvalidProcessNumber") || "Digite um número de processo válido.", "error", 3000, feedbackArea);
        if (DOM.resultadoLinkProcessoDiv) DOM.resultadoLinkProcessoDiv.innerHTML = "";
        return;
    }

    const link = gerarLinkConsultaProcessoTJSP(numeroProcesso, instancia);

    if (link) {
        if (DOM.resultadoLinkProcessoDiv) {
            DOM.resultadoLinkProcessoDiv.innerHTML = `
                <a href="${escapeHTML(link)}" target="_blank" rel="noopener noreferrer" title="${escapeHTML(link)}">${escapeHTML(link)}</a>
                <button id="btnCopiarLinkProcessoGerado" class="btn-secondary btn-copy-link">${chrome.i18n.getMessage("btnCopyLink") || "Copiar Link"}</button>
            `;
            // Adiciona listener ao botão de copiar recém-criado
            const btnCopiarLinkGerado = document.getElementById('btnCopiarLinkProcessoGerado');
            if (btnCopiarLinkGerado) {
                btnCopiarLinkGerado.addEventListener('click', () => {
                    copiarConteudoParaClipboard(link, false) // Copia como texto puro
                        .then(() => exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackLinkCopied") || "Link copiado!", "success"))
                        .catch(() => exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackErrorCopyingLink") || "Erro ao copiar link.", "error"));
                });
            }
        }
    } else {
        if (DOM.resultadoLinkProcessoDiv) DOM.resultadoLinkProcessoDiv.textContent = chrome.i18n.getMessage("feedbackErrorGeneratingLink") || "Erro ao gerar link. Verifique o número.";
    }
}

// --- SEÇÃO: CEP E ENDEREÇO ---

/**
 * Configura os event listeners para a aba "CEP e Endereço".
 */
function configurarEventListenersCEP() {
  // Sub-aba: Endereço por CEP
  if (DOM.buscarCepBtn) DOM.buscarCepBtn.addEventListener('click', handleBuscarEnderecoPorCEP);
  if (DOM.btnCopiarEndereco) DOM.btnCopiarEndereco.addEventListener('click', () => {
      if (DOM.resultadoCepDiv) {
          // Formata o endereço para cópia de forma mais legível
          let enderecoFormatado = "";
          const pElements = DOM.resultadoCepDiv.querySelectorAll('p:not(:has(small))'); // Ignora a linha da fonte
          pElements.forEach(p => {
              const strongText = p.querySelector('strong')?.textContent || "";
              const valueText = p.textContent.replace(strongText, "").trim();
              if (valueText) {
                  enderecoFormatado += `${strongText} ${valueText}\n`;
              }
          });
          copiarConteudoParaClipboard(enderecoFormatado.trim(), false)
            .then(() => exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackAddressCopied") || "Endereço copiado!", "success"))
            .catch(() => exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackErrorCopyingAddress") || "Erro ao copiar endereço.", "error"));
      }
  });

  // Sub-aba: CEP por Endereço
  if (DOM.buscarEnderecoBtn) DOM.buscarEnderecoBtn.addEventListener('click', handleBuscarCEPPorEndereco);
  // O resultado da busca de CEP por endereço é uma lista, a cópia individual de cada item não é implementada por padrão.
}

/**
 * Busca e exibe o endereço correspondente ao CEP informado.
 */
async function handleBuscarEnderecoPorCEP() {
    if (!DOM.cepInput || !DOM.resultadoCepDiv) return;
    const cep = DOM.cepInput.value;
    const feedbackArea = DOM.resultadoCepDiv.closest('.result-box') || DOM.feedbackGlobalArea;

    DOM.resultadoCepDiv.innerHTML = `<p class="loading-message">${chrome.i18n.getMessage("feedbackSearching") || "Buscando..."}</p>`;
    if (DOM.btnCopiarEndereco) DOM.btnCopiarEndereco.disabled = true;

    const resultado = await buscarEnderecoPorCEP(cep);

    if (resultado.erro) {
        DOM.resultadoCepDiv.innerHTML = `<p class="error">${resultado.mensagem}</p>`;
    } else {
        DOM.resultadoCepDiv.innerHTML = `
            <p><strong>CEP:</strong> ${escapeHTML(resultado.cep || "")}</p>
            <p><strong>Logradouro:</strong> ${escapeHTML(resultado.logradouro || "")}</p>
            ${resultado.complemento ? `<p><strong>Complemento:</strong> ${escapeHTML(resultado.complemento)}</p>` : ''}
            <p><strong>Bairro:</strong> ${escapeHTML(resultado.bairro || "")}</p>
            <p><strong>Localidade:</strong> ${escapeHTML(resultado.localidade || "")}</p>
            <p><strong>UF:</strong> ${escapeHTML(resultado.uf || "")}</p>
            ${resultado.ibge ? `<p><strong>IBGE:</strong> ${escapeHTML(resultado.ibge)}</p>` : ''}
            ${resultado.ddd ? `<p><strong>DDD:</strong> ${escapeHTML(resultado.ddd)}</p>` : ''}
            <p><small><em>Fonte: ${escapeHTML(resultado.fonte || "N/A")}</em></small></p>
        `;
        if (DOM.btnCopiarEndereco) DOM.btnCopiarEndereco.disabled = false;
    }
}

/**
 * Busca e exibe uma lista de CEPs com base no endereço (UF, Cidade, Logradouro) informado.
 */
async function handleBuscarCEPPorEndereco() {
    if (!DOM.ufInput || !DOM.cidadeInput || !DOM.logradouroInput || !DOM.resultadoEnderecoDiv) return;

    const uf = DOM.ufInput.value;
    const cidade = DOM.cidadeInput.value;
    const logradouro = DOM.logradouroInput.value;
    const feedbackArea = DOM.resultadoEnderecoDiv.closest('.result-box') || DOM.feedbackGlobalArea;

    if (!uf.trim() || !cidade.trim() || !logradouro.trim()) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackAddressFieldsRequired") || "UF, cidade e logradouro são obrigatórios.", "warning", 3000, feedbackArea);
        DOM.resultadoEnderecoDiv.innerHTML = "";
        return;
    }

    DOM.resultadoEnderecoDiv.innerHTML = `<p class="loading-message">${chrome.i18n.getMessage("feedbackSearching") || "Buscando..."}</p>`;
    const resultado = await buscarCEPPorEndereco(uf, cidade, logradouro);

    if (resultado.erro) {
        DOM.resultadoEnderecoDiv.innerHTML = `<p class="error">${resultado.mensagem}</p>`;
    } else if (resultado.resultados && resultado.resultados.length > 0) {
        let html = '<ul>';
        resultado.resultados.forEach(item => {
            html += `<li>
                <p><strong>CEP:</strong> ${escapeHTML(item.cep || "")}</p>
                <p><strong>Logradouro:</strong> ${escapeHTML(item.logradouro || "")}</p>
                ${item.complemento ? `<p><strong>Complemento:</strong> ${escapeHTML(item.complemento)}</p>` : ''}
                <p><strong>Bairro:</strong> ${escapeHTML(item.bairro || "")}</p>
                <p><strong>Localidade/UF:</strong> ${escapeHTML(item.localidade || "")}/${escapeHTML(item.uf || "")}</p>
            </li>`;
        });
        html += '</ul>';
        DOM.resultadoEnderecoDiv.innerHTML = html;
    } else {
         DOM.resultadoEnderecoDiv.innerHTML = `<p class="empty-list-message">${chrome.i18n.getMessage("feedbackNoAddressFound") || "Nenhum CEP encontrado para o endereço informado."}</p>`;
    }
}

// --- FIM DA PARTE 6 ---
// popup.js - Script principal para a extensão Facilita (Parte 7 - Final)

// (Continuação das Partes 1, 2, 3, 4, 5 e 6)
// ...

// --- SEÇÃO: LINKS ÚTEIS ---

/**
 * Configura os event listeners para a aba "Links Úteis".
 */
function configurarEventListenersLinks() {
  // Sub-aba: Links Salvos
  if (DOM.btnAddLinkLista) DOM.btnAddLinkLista.addEventListener('click', handleAdicionarLinkSalvo);
  if (DOM.listaLinksSalvosContainer) DOM.listaLinksSalvosContainer.addEventListener('click', handleAcaoLinkSalvo);

  // Modal de Edição de Link Salvo
  if (DOM.editLinkForm) DOM.editLinkForm.addEventListener('submit', handleSalvarEdicaoLink);
  if (DOM.cancelEditLinkBtn) DOM.cancelEditLinkBtn.addEventListener('click', () => {
      if (DOM.editLinkModal) DOM.editLinkModal.classList.remove('active');
  });

  // Sub-aba: Painel de Links Rápidos
  if (DOM.linkCategoryFiltersContainer) DOM.linkCategoryFiltersContainer.addEventListener('click', handleFiltroCategoriaLinkRapido);
}

/**
 * Adiciona um novo link à lista de links salvos.
 */
async function handleAdicionarLinkSalvo() {
    if (!DOM.listaLinkNomeInput || !DOM.listaLinkUrlInput || !DOM.listaLinkCategoriaInput) {
        console.warn("Elementos do formulário de adicionar link não encontrados.");
        return;
    }
    const nome = DOM.listaLinkNomeInput.value;
    const url = DOM.listaLinkUrlInput.value;
    const categoria = DOM.listaLinkCategoriaInput.value;
    const feedbackArea = DOM.listaLinksSalvosContainer || DOM.feedbackGlobalArea;


    try {
        currentLinksSalvos = await adicionarLinkSalvo({ nome, url, categoria }); // Função do linkManager.js
        renderizarListaLinksSalvos(); // Re-renderiza a lista
        DOM.listaLinkNomeInput.value = '';
        DOM.listaLinkUrlInput.value = '';
        DOM.listaLinkCategoriaInput.value = '';
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackLinkAdded") || "Link adicionado!", "success", 3000, feedbackArea);
    } catch (error) {
        exibirFeedbackGlobal(error.message, "error", 3000, feedbackArea);
    }
}

/**
 * Manipula ações nos links salvos (editar ou remover).
 * @param {Event} event - O evento de clique.
 */
async function handleAcaoLinkSalvo(event) {
    const targetButton = event.target.closest('button.icon-btn');
    if (!targetButton) return;

    const linkId = targetButton.dataset.id;
    if (!linkId) return;
    const feedbackArea = DOM.listaLinksSalvosContainer || DOM.feedbackGlobalArea;

    if (targetButton.classList.contains('btn-remover-link-salvo')) {
        const linkARemover = currentLinksSalvos.find(l => l.id === linkId);
        const nomeLink = linkARemover ? linkARemover.nome : "este link";
        const itemTypeMsg = chrome.i18n.getMessage("itemTypeLink") || "Link";
        if (confirm(chrome.i18n.getMessage("confirmRemoveItem", [itemTypeMsg, nomeLink]) || `Remover ${itemTypeMsg} "${nomeLink}"?`)) {
            try {
                currentLinksSalvos = await removerLinkSalvo(linkId); // Função do linkManager.js
                renderizarListaLinksSalvos();
                exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackLinkRemoved") || "Link removido!", "success", 3000, feedbackArea);
            } catch (error) {
                exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackErrorRemovingItem", [nomeLink]) || `Erro ao remover "${nomeLink}".`, "error", 3000, feedbackArea);
            }
        }
    } else if (targetButton.classList.contains('btn-editar-link-salvo')) {
        const linkParaEditar = currentLinksSalvos.find(l => l.id === linkId);
        if (linkParaEditar) {
            abrirModalEdicaoLink(linkParaEditar);
        }
    }
}

/**
 * Renderiza a lista de links salvos pelo usuário.
 */
function renderizarListaLinksSalvos() {
    if (!DOM.listaLinksSalvosContainer) return;
    DOM.listaLinksSalvosContainer.innerHTML = '';
    if (!currentLinksSalvos || currentLinksSalvos.length === 0) {
        DOM.listaLinksSalvosContainer.innerHTML = `<p class="empty-list-message">${chrome.i18n.getMessage("feedbackNoLinksSaved") || "Nenhum link salvo."}</p>`;
        return;
    }
    const ul = document.createElement('ul');
    ul.className = 'lista-links-simples';
    currentLinksSalvos.forEach(link => {
        const li = document.createElement('li');
        const categoriaDisplay = link.categoria ? `<span class="link-category-tag">(${escapeHTML(link.categoria)})</span>` : '';
        li.innerHTML = `
            <a href="${escapeHTML(link.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHTML(link.url)}">${escapeHTML(link.nome)} ${categoriaDisplay}</a>
            <div class="link-actions">
                <button class="btn-editar-link-salvo icon-btn" data-id="${link.id}" title="${chrome.i18n.getMessage("btnEditTemplateARIA") || 'Editar'}"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="btn-remover-link-salvo icon-btn delete-btn" data-id="${link.id}" title="${chrome.i18n.getMessage("btnDeleteTemplateARIA") || 'Excluir'}"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `;
        ul.appendChild(li);
    });
    DOM.listaLinksSalvosContainer.appendChild(ul);
}

/**
 * Renderiza o painel de links rápidos pré-definidos, aplicando filtros de categoria.
 */
function renderizarPainelLinksRapidos() {
    if (!DOM.linkCardsContainer || !DOM.linkCategoryFiltersContainer) return;
    const linksPredefinidos = obterLinksPredefinidos();
    DOM.linkCardsContainer.innerHTML = '';

    const categoriaAtiva = DOM.linkCategoryFiltersContainer.querySelector('.category-filter.active')?.dataset.category || 'todos';

    const linksFiltrados = categoriaAtiva === 'todos'
        ? linksPredefinidos
        : linksPredefinidos.filter(link => link.categoria === categoriaAtiva);

    if (linksFiltrados.length === 0) {
        DOM.linkCardsContainer.innerHTML = `<p class="empty-list-message">${chrome.i18n.getMessage("feedbackNoDefaultLinks") || "Nenhum link predefinido disponível."}</p>`;
        return;
    }
    linksFiltrados.forEach(link => {
        const card = document.createElement('a');
        card.className = 'link-card';
        card.href = link.url;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
        const nomeTraduzido = link.nome; // Assumindo que obterLinksPredefinidos já retorna nomes traduzidos.
        card.title = `${nomeTraduzido}\n${link.url}`;
        card.innerHTML = `
            <div class="link-card-icon">${link.icon || '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>'}</div>
            <div class="link-card-title">${escapeHTML(nomeTraduzido)}</div>
        `;
        DOM.linkCardsContainer.appendChild(card);
    });
}

/**
 * Manipula o clique nos filtros de categoria do painel de links rápidos.
 * @param {Event} event - O evento de clique.
 */
function handleFiltroCategoriaLinkRapido(event) {
    if (event.target.classList.contains('category-filter')) {
        if (DOM.linkCategoryFiltersContainer) {
            DOM.linkCategoryFiltersContainer.querySelectorAll('.category-filter').forEach(btn => btn.classList.remove('active'));
        }
        event.target.classList.add('active');
        renderizarPainelLinksRapidos();
    }
}

/**
 * Abre o modal para editar um link salvo.
 * @param {object} link - O objeto do link a ser editado.
 */
function abrirModalEdicaoLink(link) {
    if (!DOM.editLinkModal || !DOM.editLinkIdInput || !DOM.editLinkNomeInput || !DOM.editLinkUrlInput || !DOM.editLinkCategoriaInput) return;
    DOM.editLinkIdInput.value = link.id;
    DOM.editLinkNomeInput.value = link.nome;
    DOM.editLinkUrlInput.value = link.url;
    DOM.editLinkCategoriaInput.value = link.categoria || '';
    DOM.editLinkModal.classList.add('active');
    DOM.editLinkNomeInput.focus();
}

/**
 * Salva as alterações de um link editado.
 * @param {Event} event - O evento de submit do formulário de edição de link.
 */
async function handleSalvarEdicaoLink(event) {
    event.preventDefault();
    if (!DOM.editLinkIdInput || !DOM.editLinkNomeInput || !DOM.editLinkUrlInput || !DOM.editLinkCategoriaInput) return;

    const id = DOM.editLinkIdInput.value;
    const nome = DOM.editLinkNomeInput.value;
    const url = DOM.editLinkUrlInput.value;
    const categoria = DOM.editLinkCategoriaInput.value;
    const feedbackAreaModal = DOM.editLinkModal.querySelector('.feedback-area-modal-link');

    try {
        currentLinksSalvos = await editarLinkSalvo(id, { nome, url, categoria }); // Função do linkManager.js
        renderizarListaLinksSalvos();
        if (DOM.editLinkModal) DOM.editLinkModal.classList.remove('active');
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackLinkUpdated") || "Link atualizado!", "success");
    } catch (error) {
        exibirFeedbackGlobal(error.message, "error", 3000, feedbackAreaModal);
    }
}


// --- SEÇÃO: CONFIGURAÇÕES ---

/**
 * Configura os event listeners para a aba "Configurações".
 */
function configurarEventListenersConfiguracoes() {
  if (DOM.configTemaEscuroCheckbox) DOM.configTemaEscuroCheckbox.addEventListener('change', async (e) => {
      currentSettings.darkMode = e.target.checked;
      document.body.classList.toggle('dark-mode', currentSettings.darkMode);
      if(DOM.themeIconSun && DOM.themeIconMoon){
          DOM.themeIconSun.style.display = currentSettings.darkMode ? 'none' : 'inline';
          DOM.themeIconMoon.style.display = currentSettings.darkMode ? 'inline' : 'none';
      }
      try { await saveSettings(currentSettings); } catch (err) {
          console.error("Facilita: Erro ao salvar tema:", err);
          // Reverte a mudança na UI se o salvamento falhar
          currentSettings.darkMode = !e.target.checked;
          document.body.classList.toggle('dark-mode', currentSettings.darkMode);
           if(DOM.themeIconSun && DOM.themeIconMoon){
              DOM.themeIconSun.style.display = currentSettings.darkMode ? 'none' : 'inline';
              DOM.themeIconMoon.style.display = currentSettings.darkMode ? 'inline' : 'none';
          }
          if (DOM.configTemaEscuroCheckbox) DOM.configTemaEscuroCheckbox.checked = currentSettings.darkMode;
          exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackErrorSavingAppearance") || "Erro ao salvar aparência.", "error", 3000, DOM.feedbackAreaSettings);
      }
  });

  if (DOM.configIdiomaSelect) DOM.configIdiomaSelect.addEventListener('change', async (e) => {
      const novoIdioma = e.target.value;
      currentSettings.language = novoIdioma;
      try {
          await saveSettings(currentSettings);
          exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackLanguageChanged") || "Idioma alterado. Recarregue a extensão para aplicar as mudanças.", "info", 5000, DOM.feedbackAreaSettings);
          // A tradução da UI é feita na inicialização. O usuário precisará reabrir o popup ou a extensão pode tentar forçar um reload.
          // Para uma atualização imediata (parcial):
          // traduzirInterface();
          // renderizarListaTemplates(); // E outras funções de renderização que usam i18n
      } catch (err) {
          console.error("Facilita: Erro ao salvar idioma:", err);
          exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackErrorSavingAppearance") || "Erro ao salvar idioma.", "error", 3000, DOM.feedbackAreaSettings);
          // Reverter a seleção pode ser complicado se a tradução já foi parcialmente aplicada.
      }
  });

  if (DOM.btnAdicionarConstante) DOM.btnAdicionarConstante.addEventListener('click', handleAdicionarConstante);
  if (DOM.listaConstantesDiv) {
      DOM.listaConstantesDiv.addEventListener('click', handleRemoverConstante);
      DOM.listaConstantesDiv.addEventListener('change', debounce(handleValorConstanteChange, 500));
      DOM.listaConstantesDiv.addEventListener('input', debounce(handleValorConstanteChange, 500));
  }

  if (DOM.addReusableVariableBtn) DOM.addReusableVariableBtn.addEventListener('click', handleAdicionarVariavelReutilizavel);
  if (DOM.reusableVariablesListDiv) DOM.reusableVariablesListDiv.addEventListener('click', handleRemoverVariavelReutilizavel);

  if (DOM.btnExportarModelos) DOM.btnExportarModelos.addEventListener('click', handleExportarApenasModelos);
  if (DOM.btnImportarModelos) DOM.btnImportarModelos.addEventListener('click', () => {
      if (DOM.importConfigInput) {
          DOM.importConfigInput.dataset.importType = 'templates_only';
          DOM.importConfigInput.click();
      }
  });
  if (DOM.btnExportarConfig) DOM.btnExportarConfig.addEventListener('click', handleExportarTudo);
  if (DOM.btnImportarConfig) DOM.btnImportarConfig.addEventListener('click', () => {
      if (DOM.importConfigInput) {
          DOM.importConfigInput.dataset.importType = 'all_data';
          DOM.importConfigInput.click();
      }
  });
  if (DOM.importConfigInput) DOM.importConfigInput.addEventListener('change', handleImportarArquivoSelecionado);
}

function renderizarListaConstantes() {
    if (!DOM.listaConstantesDiv) return;
    DOM.listaConstantesDiv.innerHTML = '';
    const nomesConstantes = Object.keys(currentSettings.customConstants || {}).sort();
    if (nomesConstantes.length === 0) {
        DOM.listaConstantesDiv.innerHTML = `<p class="empty-list-message">${chrome.i18n.getMessage("feedbackNoConstants") || "Nenhuma constante definida."}</p>`;
        return;
    }
    nomesConstantes.forEach(nome => {
        const constante = currentSettings.customConstants[nome];
        const item = document.createElement('div');
        item.className = 'constant-item';
        item.innerHTML = `
            <span class="constant-name" title="${chrome.i18n.getMessage("itemTypeConstant") || 'Constante'}: {${nome}}">{${nome}}</span>
            <input type="text" class="constant-value-input" data-name="${nome}" value="${escapeHTML(constante.value || "")}" placeholder="${chrome.i18n.getMessage("placeholderConstantValue") || 'Valor'}">
            <select class="constant-format-select" data-name="${nome}">
                <option value="texto" ${constante.format === 'texto' ? 'selected' : ''}>${chrome.i18n.getMessage("optionFormatText") || "Texto"}</option>
                <option value="extenso" ${constante.format === 'extenso' ? 'selected' : ''}>${chrome.i18n.getMessage("optionFormatExtenso") || "Número por Extenso"}</option>
                <option value="extenso_moeda" ${constante.format === 'extenso_moeda' ? 'selected' : ''}>${chrome.i18n.getMessage("optionFormatExtensoMoeda") || "Moeda por Extenso"}</option>
                <option value="extenso_f" ${constante.format === 'extenso_f' ? 'selected' : ''}>${chrome.i18n.getMessage("optionFormatExtensoFeminino") || "Número por Extenso (Feminino)"}</option>
            </select>
            <button class="btn-remover-constante delete-btn icon-btn" data-name="${nome}" title="${chrome.i18n.getMessage("btnDeleteTemplateARIA") || 'Excluir'}"><i class="fa-solid fa-trash-can"></i></button>
        `;
        DOM.listaConstantesDiv.appendChild(item);
    });
}

async function handleValorConstanteChange(event) {
    if (event.target.classList.contains('constant-value-input') || event.target.classList.contains('constant-format-select')) {
        const name = event.target.dataset.name;
        const itemDiv = event.target.closest('.constant-item');
        if (!itemDiv) return;
        const valueInput = itemDiv.querySelector('.constant-value-input');
        const formatSelect = itemDiv.querySelector('.constant-format-select');

        if (name && currentSettings.customConstants[name] && valueInput && formatSelect) {
            currentSettings.customConstants[name].value = valueInput.value;
            currentSettings.customConstants[name].format = formatSelect.value;
            try {
                await saveSettings(currentSettings);
                exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackConstantValueUpdated", [name]) || `Constante ${name} atualizada.`, "success", 1500, DOM.feedbackAreaSettings);
                atualizarBotoesCamposDinamicos(DOM.dynamicFieldsContainerCreate);
                atualizarBotoesCamposDinamicos(DOM.dynamicFieldsContainerModal);
            } catch (error) {
                exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackErrorSavingConstant", [name]) || `Erro ao salvar ${name}.`, "error", 3000, DOM.feedbackAreaSettings);
                console.error("Erro ao salvar constante:", error);
            }
        }
    }
}

async function handleRemoverConstante(event) {
    const btn = event.target.closest('.btn-remover-constante');
    if (btn) {
        const name = btn.dataset.name;
        const itemTypeMsg = chrome.i18n.getMessage("itemTypeConstant") || "Constante";
        if (confirm(chrome.i18n.getMessage("confirmRemoveItem", [itemTypeMsg, name]) || `Remover ${itemTypeMsg} "${name}"?`)) {
            try {
                await removeCustomConstant(name);
                currentSettings = await loadSettings();
                exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackItemRemoved", [itemTypeMsg, name]) || `${itemTypeMsg} "${name}" removida.`, "success", 3000, DOM.feedbackAreaSettings);
                renderizarListaConstantes();
                atualizarBotoesCamposDinamicos(DOM.dynamicFieldsContainerCreate);
                atualizarBotoesCamposDinamicos(DOM.dynamicFieldsContainerModal);
            } catch (error) {
                exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackErrorRemovingItem", [name]) || `Erro ao remover "${name}".`, "error", 3000, DOM.feedbackAreaSettings);
                console.error("Erro ao remover constante:", error);
            }
        }
    }
}

function renderizarListaVariaveisReutilizaveis() {
    if (!DOM.reusableVariablesListDiv) return;
    DOM.reusableVariablesListDiv.innerHTML = '';
    const nomesVariaveis = Object.keys(currentSettings.reusableVariables || {}).sort();
    if (nomesVariaveis.length === 0) {
        DOM.reusableVariablesListDiv.innerHTML = `<p class="empty-list-message">${chrome.i18n.getMessage("feedbackNoReusableVars") || "Nenhuma variável reutilizável definida."}</p>`;
        return;
    }
    nomesVariaveis.forEach(nome => {
        const item = document.createElement('div');
        item.className = 'constant-item';
        item.innerHTML = `
            <span class="constant-name" title="${chrome.i18n.getMessage("itemTypeReusableVariable") || 'Variável Reutilizável'}: {${nome}}">{${nome}}</span>
            <span class="constant-value-input" style="font-style:italic; color:var(--text-muted); flex-grow:1; text-align:left;">${chrome.i18n.getMessage("reusableVarValueRequested") || "(Valor solicitado ao usar)"}</span>
            <button class="btn-remover-variavel delete-btn icon-btn" data-name="${nome}" title="${chrome.i18n.getMessage("btnDeleteTemplateARIA") || 'Excluir'}"><i class="fa-solid fa-trash-can"></i></button>
        `;
        DOM.reusableVariablesListDiv.appendChild(item);
    });
}

async function handleAdicionarConstante() {
    if (!DOM.constanteNomeInput || !DOM.constanteValorInput || !DOM.constanteFormatoSelect) return;
    const nome = DOM.constanteNomeInput.value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
    const valor = DOM.constanteValorInput.value;
    const formato = DOM.constanteFormatoSelect.value;

    if (!nome || !valor) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackConstantNameValueRequired") || "Nome e valor da constante são obrigatórios.", "error", 3000, DOM.feedbackAreaSettings); return;
    }
    if (!/^[A-Z0-9_]+$/.test(nome)) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackInvalidConstantName") || "Nome da constante inválido.", "error", 3000, DOM.feedbackAreaSettings); return;
    }
    if ((currentSettings.customConstants && currentSettings.customConstants[nome]) || (currentSettings.reusableVariables && currentSettings.reusableVariables[nome])) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackItemExists", [nome]) || `Item "${nome}" já existe.`, "error", 3000, DOM.feedbackAreaSettings); return;
    }
    try {
        await addOrUpdateCustomConstant(nome, valor, formato);
        currentSettings = await loadSettings();
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackConstantAdded", [nome]) || `Constante "${nome}" adicionada.`, "success", 3000, DOM.feedbackAreaSettings);
        renderizarListaConstantes();
        atualizarBotoesCamposDinamicos(DOM.dynamicFieldsContainerCreate);
        atualizarBotoesCamposDinamicos(DOM.dynamicFieldsContainerModal);
        DOM.constanteNomeInput.value = '';
        DOM.constanteValorInput.value = '';
        DOM.constanteFormatoSelect.value = 'texto';
    } catch (error) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackErrorAddingConstant") || "Erro ao adicionar constante.", "error", 3000, DOM.feedbackAreaSettings);
        console.error("Erro ao adicionar constante:", error);
    }
}

async function handleAdicionarVariavelReutilizavel() {
    if (!DOM.newReusableVariableNameInput) return;
    const nome = DOM.newReusableVariableNameInput.value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
    if (!nome) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackReusableVariableNameRequired") || "Nome da variável é obrigatório.", "error", 3000, DOM.feedbackAreaSettings); return;
    }
    if (!/^[A-Z0-9_]+$/.test(nome)) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackInvalidReusableVariableName") || "Nome da variável inválido.", "error", 3000, DOM.feedbackAreaSettings); return;
    }
    if ((currentSettings.reusableVariables && currentSettings.reusableVariables[nome]) || (currentSettings.customConstants && currentSettings.customConstants[nome])) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackItemExists", [nome]) || `Item "${nome}" já existe.`, "error", 3000, DOM.feedbackAreaSettings); return;
    }
    try {
        await addOrUpdateReusableVariable(nome);
        currentSettings = await loadSettings();
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackReusableVariableAdded", [nome]) || `Variável "${nome}" adicionada.`, "success", 3000, DOM.feedbackAreaSettings);
        renderizarListaVariaveisReutilizaveis();
        atualizarBotoesCamposDinamicos(DOM.dynamicFieldsContainerCreate);
        atualizarBotoesCamposDinamicos(DOM.dynamicFieldsContainerModal);
        DOM.newReusableVariableNameInput.value = '';
    } catch (error) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackErrorAddingReusableVariable") || "Erro ao adicionar variável.", "error", 3000, DOM.feedbackAreaSettings);
        console.error("Erro ao adicionar variável reutilizável:", error);
    }
}

async function handleRemoverVariavelReutilizavel(event) {
    const btn = event.target.closest('.btn-remover-variavel');
    if (btn) {
        const name = btn.dataset.name;
        const itemTypeMsg = chrome.i18n.getMessage("itemTypeReusableVariable") || "Variável Reutilizável";
        if (confirm(chrome.i18n.getMessage("confirmRemoveItem", [itemTypeMsg, name]) || `Remover ${itemTypeMsg} "${name}"?`)) {
            try {
                await removeReusableVariable(name);
                currentSettings = await loadSettings();
                exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackItemRemoved", [itemTypeMsg, name]) || `${itemTypeMsg} "${name}" removida.`, "success", 3000, DOM.feedbackAreaSettings);
                renderizarListaVariaveisReutilizaveis();
                atualizarBotoesCamposDinamicos(DOM.dynamicFieldsContainerCreate);
                atualizarBotoesCamposDinamicos(DOM.dynamicFieldsContainerModal);
            } catch (error) {
                exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackErrorRemovingItem", [name]) || `Erro ao remover "${name}".`, "error", 3000, DOM.feedbackAreaSettings);
                console.error("Erro ao remover variável reutilizável:", error);
            }
        }
    }
}

async function handleExportarApenasModelos() {
    try {
        const templatesToExport = await loadTemplates();
        if (!templatesToExport || templatesToExport.length === 0) {
            exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackNoTemplatesToExport") || "Nenhum modelo para exportar.", "warning", 3000, DOM.feedbackAreaSettings);
            return;
        }
        const dataToExport = {
            exportType: "FacilitaTemplatesOnly",
            version: "2.0.0", // Pode ser pego do manifest
            exportedAt: new Date().toISOString(),
            templates: templatesToExport
        };
        const jsonStr = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `facilita_modelos_${ts}.json`;

        chrome.downloads.download({ url, filename, saveAs: true }, downloadId => {
            if (chrome.runtime.lastError) {
                exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackErrorExporting") || "Erro ao exportar.", "error", 5000, DOM.feedbackAreaSettings);
            } else if (downloadId === undefined && !chrome.runtime.lastError) {
                 console.log("Facilita: Exportação de modelos cancelada pelo usuário.");
            } else {
                exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackTemplatesExported") || "Modelos exportados!", "success", 3000, DOM.feedbackAreaSettings);
            }
            URL.revokeObjectURL(url);
        });
    } catch (error) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackErrorGeneratingBackup") || "Erro ao gerar backup.", "error", 3000, DOM.feedbackAreaSettings);
    }
}

async function handleExportarTudo() {
    try {
        const jsonStr = await exportAllData();
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `facilita_backup_completo_${ts}.json`;

        chrome.downloads.download({ url, filename, saveAs: true }, downloadId => {
            if (chrome.runtime.lastError) {
                exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackErrorExporting") || "Erro ao exportar.", "error", 5000, DOM.feedbackAreaSettings);
            } else if (downloadId === undefined && !chrome.runtime.lastError) {
                 console.log("Facilita: Exportação completa cancelada pelo usuário.");
            } else {
                exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackBackupExported") || "Backup exportado!", "success", 3000, DOM.feedbackAreaSettings);
            }
            URL.revokeObjectURL(url);
        });
    } catch (error) {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackErrorGeneratingBackup") || "Erro ao gerar backup.", "error", 3000, DOM.feedbackAreaSettings);
    }
}

async function handleImportarArquivoSelecionado(event) {
    const file = event.target.files[0];
    if (!file) return;

    const importType = DOM.importConfigInput.dataset.importType || 'all_data';

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const jsonString = e.target.result;
            const dataToImport = JSON.parse(jsonString);

            if (importType === 'templates_only') {
                if (dataToImport.exportType !== "FacilitaTemplatesOnly" || !Array.isArray(dataToImport.templates)) {
                    throw new Error(chrome.i18n.getMessage("invalidFileFormat") || "Formato de arquivo de modelos inválido.");
                }
                const confirmMerge = confirm(chrome.i18n.getMessage("confirmMergeTemplates") || "Deseja mesclar os modelos importados com os existentes? Cancelar irá substituir todos os modelos atuais.");
                let importedCount = 0;
                if (confirmMerge) {
                    const templatesAtuais = await loadTemplates();
                    const mapAtuais = new Map(templatesAtuais.map(t => [t.id, t]));
                    let adicionados = 0;
                    let atualizados = 0;
                    dataToImport.templates.forEach(impT => {
                        const validImpT = {
                            id: impT.id || Date.now().toString() + Math.random().toString(36).substring(2),
                            name: impT.name || "Modelo Importado Sem Nome",
                            content: impT.content || "",
                            category: impT.category || "",
                            tags: Array.isArray(impT.tags) ? impT.tags.map(tag => String(tag).trim().toLowerCase()).filter(Boolean) : [],
                            createdAt: impT.createdAt || new Date().toISOString(),
                            lastModified: impT.lastModified || new Date().toISOString()
                        };
                        if (mapAtuais.has(validImpT.id)) {
                            const atual = mapAtuais.get(validImpT.id);
                            if (new Date(validImpT.lastModified) > new Date(atual.lastModified)) {
                                mapAtuais.set(validImpT.id, validImpT);
                                atualizados++;
                            }
                        } else {
                            mapAtuais.set(validImpT.id, validImpT);
                            adicionados++;
                        }
                    });
                    currentTemplates = Array.from(mapAtuais.values());
                    importedCount = adicionados + atualizados;
                } else {
                    currentTemplates = dataToImport.templates.map(t => ({
                        id: t.id || Date.now().toString() + Math.random().toString(36).substring(2),
                        name: t.name || "Modelo Importado Sem Nome",
                        content: t.content || "",
                        category: t.category || "",
                        tags: Array.isArray(t.tags) ? t.tags.map(tag => String(tag).trim().toLowerCase()).filter(Boolean) : [],
                        createdAt: t.createdAt || new Date().toISOString(),
                        lastModified: t.lastModified || new Date().toISOString()
                    }));
                    importedCount = currentTemplates.length;
                }
                await saveTemplates(currentTemplates);
                exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackTemplatesImported", [String(importedCount)]) || `${importedCount} modelo(s) importado(s)!`, "success", 3000, DOM.feedbackAreaSettings);

            } else { // all_data
                if (!confirm(chrome.i18n.getMessage("confirmImport") || "Atenção: Importar substituirá TUDO. Continuar?")) {
                    DOM.importConfigInput.value = '';
                    return;
                }
                await importAllData(jsonString);
                exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackImportedReloading") || "Importado com sucesso! Recarregando...", "success", 3000, DOM.feedbackAreaSettings);
            }
            await carregarConfiguracoesEModelos(); // Recarrega tudo
            traduzirInterface(); // Re-traduz
        } catch (err) {
            exibirFeedbackGlobal(err.message || chrome.i18n.getMessage("feedbackErrorImporting", [err.message || "Erro desconhecido."]), "error", 5000, DOM.feedbackAreaSettings);
            console.error("Erro ao importar:", err);
        } finally {
            DOM.importConfigInput.value = '';
            DOM.importConfigInput.removeAttribute('data-import-type');
        }
    };
    reader.onerror = (err) => {
        exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackErrorReadingFile") || "Erro ao ler arquivo.", "error", 3000, DOM.feedbackAreaSettings);
        console.error("Erro ao ler arquivo:", err);
        DOM.importConfigInput.value = '';
    };
    reader.readAsText(file);
}

// --- SEÇÃO: EVENT LISTENERS PARA MODAIS (GERAL) ---
function configurarEventListenersModais() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        const closeButton = modal.querySelector('.close-modal');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                modal.classList.remove('active');
                if (modal === DOM.variableModal && variableModalReject) {
                    variableModalReject('cancelled_by_x');
                    fecharModalVariaveis(true);
                }
            });
        }
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                if (modal === DOM.variableModal && variableModalReject) {
                    variableModalReject('cancelled_by_overlay_click');
                    fecharModalVariaveis(true);
                }
            }
        });
    });

    if (DOM.variableForm) DOM.variableForm.addEventListener('submit', handleSubmeterVariaveisModal);
    if (DOM.cancelVarBtn) DOM.cancelVarBtn.addEventListener('click', () => fecharModalVariaveis(true));
    if (DOM.editTemplateForm) DOM.editTemplateForm.addEventListener('submit', handleSalvarEdicaoModelo);
    if (DOM.cancelEditModalBtn) DOM.cancelEditModalBtn.addEventListener('click', fecharModalEdicao);
    if (DOM.btnFecharPreview) DOM.btnFecharPreview.addEventListener('click', () => { if(DOM.previewModal) DOM.previewModal.classList.remove('active'); });
    if (DOM.btnCopiarPreview) DOM.btnCopiarPreview.addEventListener('click', (e) => {
        const content = e.currentTarget.dataset.contentToCopy;
        if (content) {
            copiarConteudoParaClipboard(content, true)
                .then(() => {
                    exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackCopiedWithFormat") || "Copiado com formatação!", "success");
                    if(DOM.previewModal) DOM.previewModal.classList.remove('active');
                })
                .catch(() => exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackFailedToCopy") || "Falha ao copiar.", "error"));
        }
    });
    if (DOM.btnFecharInspector) DOM.btnFecharInspector.addEventListener('click', () => { if(DOM.inspectorModal) DOM.inspectorModal.classList.remove('active'); });
}

// --- EVENT LISTENERS GERAIS (Ex: Theme Toggle) ---
function configurarEventListenersGerais() {
  if (DOM.themeToggle) {
      DOM.themeToggle.addEventListener('click', async () => {
        currentSettings.darkMode = !currentSettings.darkMode;
        document.body.classList.toggle('dark-mode', currentSettings.darkMode);
        if(DOM.themeIconSun && DOM.themeIconMoon){
            DOM.themeIconSun.style.display = currentSettings.darkMode ? 'none' : 'inline';
            DOM.themeIconMoon.style.display = currentSettings.darkMode ? 'inline' : 'none';
        }
        if (DOM.configTemaEscuroCheckbox) DOM.configTemaEscuroCheckbox.checked = currentSettings.darkMode;
        try {
          await saveSettings(currentSettings);
        } catch (error) {
          console.error("Facilita: Erro ao salvar tema:", error);
          // Reverte a UI se o salvamento falhar
          currentSettings.darkMode = !currentSettings.darkMode;
          document.body.classList.toggle('dark-mode', currentSettings.darkMode);
          if(DOM.themeIconSun && DOM.themeIconMoon){
            DOM.themeIconSun.style.display = currentSettings.darkMode ? 'none' : 'inline';
            DOM.themeIconMoon.style.display = currentSettings.darkMode ? 'inline' : 'none';
          }
          if (DOM.configTemaEscuroCheckbox) DOM.configTemaEscuroCheckbox.checked = currentSettings.darkMode;
          exibirFeedbackGlobal(chrome.i18n.getMessage("feedbackErrorSavingAppearance") || "Erro ao salvar aparência.", "error");
        }
      });
  }
}



// --- CHAMADA DE INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', inicializarExtensao);

console.log("Facilita popup.js (Completo) loaded.");
