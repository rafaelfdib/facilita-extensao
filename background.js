// background.js - Service Worker da Extensão Facilita

// Log para indicar que o Service Worker iniciou
console.log("Facilita Extension Service Worker started.");

// Listener para quando a extensão é instalada ou atualizada
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === "install") {
    console.log("Facilita extension installed for the first time.");
    // Pode-se inicializar configurações padrão aqui, se necessário.
    // Exemplo:
    // chrome.storage.sync.set({
    //   settings: {
    //     darkMode: false,
    //     language: 'pt_BR',
    //     customConstants: {},
    //     reusableVariables: {}
    //   },
    //   templates: []
    // });
  } else if (details.reason === "update") {
    const newVersion = chrome.runtime.getManifest().version;
    console.log(`Facilita extension updated to version: ${newVersion}. Previous version was ${details.previousVersion}.`);
    // Lógica de migração de dados pode ser adicionada aqui, se necessário,
    // comparando details.previousVersion com newVersion.
  }
});

// Listener para mensagens de outras partes da extensão (popup, content scripts)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received in Service Worker:", request);

  if (request.action === "getTabInfo") {
    // Exemplo de como obter informações da aba ativa
    // Certifique-se de que a permissão "activeTab" está no manifest.json
    // e que esta mensagem é enviada de um contexto que tem acesso à aba (ex: popup)
    if (sender.tab && sender.tab.id) {
        chrome.tabs.get(sender.tab.id, (tab) => {
            if (chrome.runtime.lastError) {
                console.error("Error getting tab info:", chrome.runtime.lastError.message);
                sendResponse({ error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ title: tab.title, url: tab.url });
            }
        });
        return true; // Indica que a resposta será assíncrona
    } else if (request.tabId) { // Se o tabId for passado explicitamente
         chrome.tabs.get(request.tabId, (tab) => {
            if (chrome.runtime.lastError) {
                console.error("Error getting tab info for tabId:", request.tabId, chrome.runtime.lastError.message);
                sendResponse({ error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ title: tab.title, url: tab.url });
            }
        });
        return true;
    } else {
        // Fallback se não houver informação da aba do remetente
        // Tenta obter a aba ativa na janela atual (pode não ser a aba correta em todos os cenários)
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs.length > 0) {
                sendResponse({ title: tabs[0].title, url: tabs[0].url });
            } else {
                sendResponse({ title: null, url: null, error: "No active tab found." });
            }
        });
        return true; // Indica que a resposta será assíncrona
    }
  } else if (request.action === "copyToClipboard") {
    // Esta é uma maneira de contornar restrições de clipboard em content scripts
    // O popup pode enviar o texto para o background, que tem mais permissões.
    // No entanto, para Manifest V3, o clipboard.writeText é preferível diretamente no popup.
    // Esta lógica é mais para cenários onde o popup não pode acessar diretamente.
    if (request.text) {
      navigator.clipboard.writeText(request.text)
        .then(() => {
          sendResponse({ success: true, message: "Text copied to clipboard by background." });
        })
        .catch(err => {
          console.error("Background: Failed to copy text to clipboard:", err);
          sendResponse({ success: false, message: "Background: Failed to copy.", error: err.message });
        });
      return true; // Resposta assíncrona
    }
  }
  // Adicione mais tratadores de mensagens conforme necessário

  // Se nenhuma ação específica for tratada, pode-se enviar uma resposta padrão ou não enviar nada.
  // sendResponse({ status: "Message processed by background." });
  return false; // Indica resposta síncrona ou nenhuma resposta se não houver sendResponse
});

// Exemplo de como adicionar um item ao menu de contexto (clique direito)
// Requer a permissão "contextMenus" no manifest.json
/*
chrome.contextMenus.create({
  id: "facilitaLogSelection",
  title: "Facilita: Logar Seleção",
  contexts: ["selection"]
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "facilitaLogSelection" && tab) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (selectedText) => {
        console.log("Texto selecionado (via menu de contexto):", selectedText);
        // Aqui você poderia, por exemplo, abrir o popup com o texto pré-carregado
        // ou realizar alguma outra ação com o texto.
      },
      args: [info.selectionText]
    });
  }
});
*/

console.log("Facilita Service Worker event listeners set up.");
