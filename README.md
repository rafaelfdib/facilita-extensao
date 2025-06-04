# Facilita - Extensão Unificada para Chrome

**Versão:** 2.0.0

## Introdução

Bem-vindo ao **Facilita**! Esta extensão para o Google Chrome é uma ferramenta multifuncional projetada para otimizar seu fluxo de trabalho, combinando um gerenciador avançado de modelos de texto (templates) com um conjunto de utilitários práticos. Ela é o resultado da unificação e aprimoramento das extensões "Template Manager" e "Facilita (Busca CEP)", oferecendo uma solução completa para profissionais que buscam eficiência e organização.

## Funcionalidades Principais

A extensão "Facilita" é organizada em abas, cada uma contendo um conjunto de ferramentas específicas:

### 1. Modelos (Templates)
Baseado no robusto "Template Manager", esta seção permite:
* **Criar e Editar Modelos:** Utilize um editor de texto rico (Quill.js) para criar e modificar seus modelos de texto.
* **Organizar Modelos:** Atribua nomes, categorias e tags (separadas por vírgula) para fácil localização.
* **Listar e Buscar:** Visualize todos os seus modelos com opções de busca por nome, categoria, tags ou conteúdo. Filtre por categoria e ordene por nome ou data de criação/modificação.
* **Ações em Massa:** Selecione múltiplos templates para aplicar exclusão, adicionar categoria ou tags de forma conjunta.
* **Placeholders Dinâmicos:**
    * **Automáticos:** `{DATA}`, `{HORA}`, `{DATA_HORA}`, `{DD/MM/YYYY}`, `{HH:mm:ss}`, `{SEMANA}`, `{URL}` (da aba ativa), `{TITLE}` (da aba ativa), `{CLIPBOARD}` (conteúdo da área de transferência).
    * **Constantes Personalizadas:** Defina valores fixos em "Configurações" (ex: `{MEU_EMAIL}`). Use nomes em maiúsculas com números e underscores.
    * **Variáveis Reutilizáveis:** Defina nomes de variáveis em "Configurações" (ex: `{NOME_CLIENTE}`). O valor será solicitado uma única vez ao copiar um template que a utilize, mesmo que apareça múltiplas vezes ou em templates aninhados.
    * **Variáveis de Instância Única:** `{VAR:Legenda}` - O valor é solicitado para cada ocorrência no momento da cópia.
    * **Inputs de Múltiplas Linhas:** `{INPUT:Instrução}` - Similar ao `{VAR:Legenda}`, mas com uma caixa de texto maior para entrada.
    * **Invocação de Templates (Nesting):** Insira o conteúdo de um modelo dentro de outro usando `{{NomeExatoDoOutroModelo}}`. A extensão previne ciclos de invocação.
* **Formatação Avançada de Placeholders:**
    * **Número por Extenso:** `{VAR:Numero:extenso}`, `{VAR:Valor:extenso_moeda}`, `{VAR:Qtd:extenso_f}`.
    * **Formatação Numérica:** `{VAR:Preco:decimal(2)}`, `{VAR:Total:milhar}`, `{VAR:Saldo:moeda(BRL,2)}`, `{VAR:Taxa:porcentagem(1)}`.
    * **Formatos de Data Personalizados:** `{DATA:format(DD 'de' MMMM 'de' YYYY)}`.
* **Pré-visualização Interativa:** Visualize o resultado do template após preencher as variáveis, antes de copiar.
* **Inspeção de Placeholders:** Uma ferramenta no editor para analisar e listar todos os placeholders usados no modelo atual.
* **Sugestões de Placeholders:** Ajuda contextual (autocompletar simples) ao digitar `{` ou `{{` no editor.
* **Clonar Template:** Crie rapidamente variações de modelos existentes.
* **Importar/Exportar Modelos:** Faça backup ou compartilhe seus templates individualmente ou em lote.

### 2. Ferramentas de Texto
* **Número por Extenso:**
    * Converte números para sua forma escrita por extenso.
    * Opções para formato monetário (Reais - R$) e gênero feminino.
* **Limpeza de Texto Avançada:**
    * Unir parágrafos (removendo quebras de linha extras).
    * Remover espaços duplos/múltiplos.
    * Remover espaços nas bordas das linhas (trim).
    * Converter para TUDO MAIÚSCULAS, tudo minúsculas, ou Formato De Título.
    * Remover marcadores de lista (como `*`, `-`, `1.`).
    * Localizar e Substituir texto dentro da área de limpeza.
    * Ordenar linhas do texto alfabeticamente (A-Z ou Z-A).
    * Contadores de caracteres (com/sem espaços), palavras e linhas.

### 3. Documentos e Consultas
* **Formatar Documentos:**
    * Formata números de CPF, CNPJ, RG (formato SP como exemplo) e Processo CNJ.
    * Opção para limpar a formatação, mantendo apenas os dígitos (ou dígitos e 'X' para RG).
* **Consulta de Processo TJSP:**
    * Gera um link clicável para consulta de processos no portal e-SAJ do TJSP (1º ou 2º Grau) a partir do número CNJ.

### 4. CEP e Endereço
* **Buscar Endereço por CEP:**
    * Insira um CEP (8 dígitos) para obter o endereço completo.
    * Utiliza múltiplas APIs (ViaCEP, BrasilAPI, OpenCEP) para maior robustez e redundância.
* **Buscar CEP por Endereço:**
    * Insira UF (2 letras), Cidade (mín. 3 letras) e Logradouro (mín. 3 letras) para obter uma lista de CEPs (via ViaCEP).

### 5. Links Úteis
* **Links Salvos:**
    * Adicione, visualize, edite e remova links personalizados (nome, URL e categoria).
    * Os links são guardados localmente no navegador.
* **Painel de Links Rápidos:**
    * Exibe uma grade de cards com links pré-definidos úteis (ex: portais de tribunais, legislação), organizados por categoria e com filtros.

### 6. Configurações
* **Aparência:** Ativar/Desativar Modo Escuro.
* **Idioma:** Selecionar o idioma da interface da extensão (Português/Inglês).
* **Constantes Personalizadas:** Gerenciar placeholders com valores fixos (ex: `{MEU_EMAIL}`).
* **Variáveis Reutilizáveis:** Gerenciar nomes de variáveis cujo valor é solicitado uma única vez ao copiar (ex: `{NOME_CLIENTE}`).
* **Backup e Restauração:**
    * **Exportar Tudo:** Salva todas as configurações e modelos em um arquivo JSON.
    * **Importar Tudo:** Restaura configurações e modelos de um arquivo JSON de backup (sobrescreve os dados atuais).
    * **Exportar/Importar Apenas Modelos:** Funcionalidade específica para os templates.

### 7. Ajuda (Documentação)
* Aba com informações detalhadas sobre todas as funcionalidades da extensão, incluindo exemplos de uso dos placeholders e dicas.

## Estrutura da Extensão


facilita-extensao/
├── manifest.json
├── popup.html
├── popup.css
├── popup.js (type="module")
├── background.js (type="module")
├── content.js
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── libs/
│   ├── quill.min.js
│   ├── quill.snow.css
│   └── extenso.min.js
├── modules/
│   ├── cepUtils.js
│   ├── documentTools.js
│   ├── linkManager.js
│   ├── settingsManager.js
│   ├── templateManagerUtils.js
│   └── textTools.js
└── _locales/
├── en/
│   └── messages.json
└── pt_BR/
└── messages.json


## Instalação Manual

1.  **Baixe os arquivos da extensão:** Clone este repositório ou faça o download do ZIP e extraia-o.
2.  **Abra as Extensões do Chrome/Edge:**
    * No Chrome, digite `chrome://extensions` na barra de endereço e pressione Enter.
    * No Edge, digite `edge://extensions` na barra de endereço e pressione Enter.
3.  **Ative o Modo de Desenvolvedor:** No canto superior direito (Chrome) ou inferior esquerdo (Edge) da página de extensões, ative o "Modo de desenvolvedor".
4.  **Carregue a Extensão:**
    * Clique no botão "Carregar sem compactação" (ou "Load unpacked").
    * Navegue até a pasta `facilita-extensao` (a pasta que contém o `manifest.json`) e clique em "Selecionar pasta".
5.  **Pronto!** A extensão "Facilita" deverá aparecer na sua lista de extensões e estará pronta para uso.

## Como Usar

1.  Clique no ícone da extensão "Facilita" na barra de ferramentas do seu navegador.
2.  O popup da extensão será aberto.
3.  Navegue entre as abas principais (Modelos, Texto, Docs & Consultas, etc.) para acessar a ferramenta desejada.
4.  Dentro de cada aba, utilize as sub-abas (se houver) para funcionalidades mais específicas.
5.  Siga as instruções e preencha os campos conforme necessário em cada ferramenta.
6.  Consulte a aba "Ajuda" para informações detalhadas sobre cada funcionalidade e o uso de placeholders.

## Permissões Necessárias

* `storage`: Para salvar seus modelos, links personalizados e configurações da extensão localmente.
* `activeTab` e `scripting`: Para interagir com a página da web ativa, permitindo que a extensão obtenha informações como URL e título (para placeholders automáticos) e insira o conteúdo dos templates em campos de texto.
* `clipboardRead` e `clipboardWrite`: Para a funcionalidade do placeholder `{CLIPBOARD}` (ler da área de transferência) e para copiar o conteúdo dos templates para a área de transferência.
* `downloads`: Para permitir que você exporte seus backups de modelos e configurações.
* `host_permissions` (para URLs específicas e `<all_urls>`):
    * APIs de CEP: `https://viacep.com.br/*`, `https://brasilapi.com.br/*`, `https://opencep.com/*`.
    * Portal eSAJ TJSP: `https://esaj.tjsp.jus.br/*` para a funcionalidade de consulta de processos.
    * `<all_urls>`: Necessário para que o `content.js` possa ser injetado em qualquer página e permitir a inserção de templates em campos de texto de qualquer site.

## Desenvolvimento

Esta extensão foi desenvolvida com foco na modularidade, utilizando módulos ES6 para organizar o código em arquivos menores e mais gerenciáveis (`modules/`). Isso facilita a manutenção, a leitura e a reutilização de código. As traduções são gerenciadas através da API `chrome.i18n`.

## Licença

Este projeto é distribuído sob a licença MIT.
