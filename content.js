// content.js - Facilita Extensão

/**
 * Listener para mensagens vindas do popup ou outras partes da extensão.
 * Espera por uma mensagem com type "INSERT_TEMPLATE" e content.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Verifica se a mensagem é para inserir um template e se há conteúdo
  if (request.type === "INSERT_TEMPLATE" && request.content) {
    const activeElement = document.activeElement;

    // Verifica se o elemento focado é um campo de input, textarea ou editável
    if (activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA" || activeElement.isContentEditable)) {
      try {
        // Tenta inserir o conteúdo processado no elemento ativo
        insertProcessedContent(activeElement, request.content);
        // Envia uma resposta de sucesso para o popup (usando chave i18n)
        sendResponse({ success: true, message: chrome.i18n.getMessage("contentMsgInsertedSuccess") });
      } catch (error) {
        console.error("Facilita - Erro ao inserir conteúdo:", error);
        // Envia uma resposta de erro para o popup (usando chave i18n com substituição)
        sendResponse({ success: false, message: chrome.i18n.getMessage("contentMsgErrorInserting", [error.message]) });
      }
    } else {
      // Avisa no console se nenhum elemento adequado for encontrado
      console.warn(`Facilita: ${chrome.i18n.getMessage("contentMsgNoActiveElement")}`);
      // Envia uma resposta de falha se nenhum elemento adequado for encontrado (usando chave i18n)
      sendResponse({ success: false, message: chrome.i18n.getMessage("contentMsgNoActiveElement") });
    }
  } else if (request.action === "getSelectionDetails") {
    // Ação para obter detalhes da seleção atual na página (se necessário pelo popup)
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const selectedText = selection.toString();
      const commonAncestorContainer = range.commonAncestorContainer;
      let isEditable = false;
      if (commonAncestorContainer) {
        let el = commonAncestorContainer.nodeType === Node.ELEMENT_NODE ? commonAncestorContainer : commonAncestorContainer.parentElement;
        while (el) {
          if (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
            isEditable = true;
            break;
          }
          el = el.parentElement;
        }
      }
      sendResponse({
        selectedText: selectedText,
        isEditable: isEditable,
        startOffset: range.startOffset,
        endOffset: range.endOffset
      });
    } else {
      sendResponse({ selectedText: "", isEditable: false });
    }
    return true; // Resposta assíncrona
  }

  // Retorna false para indicar que sendResponse será chamado sincronamente (ou já foi chamado).
  // Retornar true só é necessário se sendResponse for chamado de forma assíncrona.
  return false;
});

/**
 * Insere o conteúdo (que pode ser HTML) no elemento especificado.
 * Adapta a inserção para INPUT/TEXTAREA (texto puro) e contentEditable (HTML).
 * @param {HTMLElement} element - O elemento alvo (input, textarea, ou contentEditable).
 * @param {string} content - O conteúdo (potencialmente HTML) a ser inserido.
 */
function insertProcessedContent(element, content) {
  // Verifica o tipo do elemento para determinar como inserir o conteúdo
  if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
    // Para inputs e textareas, extrai o texto puro do HTML
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = content; // Interpreta o HTML
    const textToInsert = tempDiv.textContent || tempDiv.innerText || ""; // Obtém apenas o texto

    // Insere o texto na posição atual do cursor
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const currentValue = element.value;
    element.value = currentValue.substring(0, start) + textToInsert + currentValue.substring(end);

    // Move o cursor para o final do texto inserido
    const newCursorPosition = start + textToInsert.length;
    element.selectionStart = element.selectionEnd = newCursorPosition;

  } else if (element.isContentEditable) {
    // Para elementos contentEditable, insere como HTML usando a API de Seleção
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) { // Verifica se há uma seleção/cursor
      const range = sel.getRangeAt(0); // Pega o range atual
      range.deleteContents(); // Remove o conteúdo selecionado (se houver)

      // Cria um fragmento de documento para inserir o HTML de forma segura e eficiente
      const fragment = range.createContextualFragment(content);
      const lastNode = fragment.lastChild; // Guarda referência ao último nó inserido para posicionar o cursor
      range.insertNode(fragment); // Insere o conteúdo HTML

      // Move o cursor para depois do conteúdo inserido
      if (lastNode) {
        const newRange = document.createRange();
        // Tenta posicionar o cursor após o último nó. Se for um nó de texto, posiciona no final dele.
        if (lastNode.nodeType === Node.TEXT_NODE) {
          newRange.setStart(lastNode, lastNode.length);
        } else {
          newRange.setStartAfter(lastNode);
        }
        newRange.collapse(true); // Colapsa o range para um ponto (cursor)
        sel.removeAllRanges(); // Limpa seleções antigas
        sel.addRange(newRange); // Define a nova posição do cursor
      }
    } else {
      // Fallback: Se não houver seleção (menos comum), tenta usar execCommand
      console.warn(chrome.i18n.getMessage("contentWarnNoSelection"));
      element.focus(); // Garante que o elemento tem foco
      document.execCommand('insertHTML', false, content);
    }
  }

  // Dispara eventos 'input' e 'change' para notificar a página (e frameworks como React/Vue)
  // que o conteúdo foi alterado programaticamente.
  element.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
  element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));

  // Garante que o elemento ainda tenha foco após a inserção
  element.focus();
}

console.log("Facilita content script loaded.");
