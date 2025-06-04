// modules/cepUtils.js - Facilita Extensão
// Lógica para busca de CEP e Endereço utilizando múltiplas APIs.

/**
 * Busca um endereço completo a partir de um CEP.
 * Tenta em sequência: ViaCEP, BrasilAPI, OpenCEP.
 * @param {string} cep - O CEP a ser consultado (pode conter máscara).
 * @returns {Promise<object>} Objeto com os dados do endereço ou um objeto de erro.
 * Exemplo de sucesso: { cep, logradouro, complemento, bairro, localidade, uf, ibge, gia, ddd, siafi, fonte }
 * Exemplo de erro: { erro: true, mensagem: "CEP inválido." }
 */
export async function buscarEnderecoPorCEP(cep) {
  const cepLimpo = String(cep).replace(/\D/g, '');

  if (cepLimpo.length !== 8) {
    return { erro: true, mensagem: chrome.i18n.getMessage("feedbackInvalidCEP") || 'CEP deve conter 8 dígitos.' };
  }

  const apis = [
    {
      nome: "ViaCEP",
      url: `https://viacep.com.br/ws/${cepLimpo}/json/`,
      parser: (data) => {
        if (data.erro) return null;
        return {
          cep: data.cep,
          logradouro: data.logradouro,
          complemento: data.complemento,
          bairro: data.bairro,
          localidade: data.localidade,
          uf: data.uf,
          ibge: data.ibge,
          gia: data.gia,
          ddd: data.ddd,
          siafi: data.siafi,
          fonte: "ViaCEP"
        };
      }
    },
    {
      nome: "BrasilAPI",
      url: `https://brasilapi.com.br/api/cep/v2/${cepLimpo}`, // Usar v2 para melhor tratamento de erro
      parser: (data) => {
        // BrasilAPI v2 retorna erro em `type` e `name` em caso de CEP não encontrado
        if (data.type && data.name === "CepPromiseError") return null;
        if (data.errors && data.errors.length > 0) return null; // Tratamento para v1, se v2 falhar
        return {
          cep: data.cep,
          logradouro: data.street,
          complemento: data.complement, // BrasilAPI pode não ter complemento
          bairro: data.neighborhood,
          localidade: data.city,
          uf: data.state,
          // BrasilAPI não fornece todos os campos do ViaCEP
          ibge: null,
          gia: null,
          ddd: null, // Pode estar em data.service.ddd
          siafi: null,
          fonte: "BrasilAPI"
        };
      }
    },
    {
      nome: "OpenCEP",
      url: `https://opencep.com/v1/${cepLimpo}.json`,
      parser: (data) => {
        // OpenCEP retorna erro em `error` ou simplesmente não retorna campos obrigatórios
        if (data.error || !data.cep) return null;
        return {
          cep: data.cep,
          logradouro: data.logradouro,
          complemento: data.complemento,
          bairro: data.bairro,
          localidade: data.cidade ? data.cidade.nome : data.localidade, // OpenCEP pode ter estrutura diferente
          uf: data.estado ? data.estado.sigla : data.uf,
          ibge: data.cidade ? data.cidade.ibge : data.ibge,
          ddd: data.estado ? data.estado.ddd : data.ddd,
          gia: null,
          siafi: null,
          fonte: "OpenCEP"
        };
      }
    }
  ];

  for (const api of apis) {
    try {
      const response = await fetch(api.url, { signal: AbortSignal.timeout(5000) }); // Timeout de 5 segundos
      if (!response.ok) {
        console.warn(`API ${api.nome} HTTP Error: ${response.status}`);
        continue; // Tenta a próxima API
      }
      const data = await response.json();
      const parsedData = api.parser(data);
      if (parsedData && parsedData.logradouro && parsedData.localidade && parsedData.uf) { // Validação mínima
        return parsedData;
      }
    } catch (error) {
      console.error(`Erro ao buscar CEP na API ${api.nome}:`, error);
      // Continua para a próxima API em caso de erro de rede ou timeout
    }
  }

  return { erro: true, mensagem: chrome.i18n.getMessage("feedbackCEPNotFound") || 'CEP não encontrado em nenhuma API.' };
}

/**
 * Busca uma lista de CEPs a partir de UF, Cidade e Logradouro.
 * Utiliza a API ViaCEP.
 * @param {string} uf - Unidade Federativa (ex: "SP").
 * @param {string} cidade - Nome da cidade.
 * @param {string} logradouro - Nome do logradouro (rua, avenida, etc.).
 * @returns {Promise<object>} Objeto com a lista de resultados ou um objeto de erro.
 * Exemplo de sucesso: { resultados: [{cep, logradouro, ...}], fonte: "ViaCEP" }
 * Exemplo de erro: { erro: true, mensagem: "UF deve conter 2 caracteres." }
 */
export async function buscarCEPPorEndereco(uf, cidade, logradouro) {
  const ufVal = String(uf).trim().toUpperCase();
  const cidadeVal = String(cidade).trim();
  const logradouroVal = String(logradouro).trim();

  if (ufVal.length !== 2) {
    return { erro: true, mensagem: chrome.i18n.getMessage("feedbackAddressFieldsRequired") || 'UF deve conter 2 caracteres.' };
  }
  if (cidadeVal.length < 3) {
    return { erro: true, mensagem: chrome.i18n.getMessage("feedbackAddressFieldsRequired") || 'Cidade deve conter pelo menos 3 caracteres.' };
  }
  if (logradouroVal.length < 3) {
    return { erro: true, mensagem: chrome.i18n.getMessage("feedbackAddressFieldsRequired") || 'Logradouro deve conter pelo menos 3 caracteres.' };
  }

  try {
    const encodedCidade = encodeURIComponent(cidadeVal);
    const encodedLogradouro = encodeURIComponent(logradouroVal);
    const url = `https://viacep.com.br/ws/${ufVal}/${encodedCidade}/${encodedLogradouro}/json/`;

    const response = await fetch(url, { signal: AbortSignal.timeout(7000) }); // Timeout maior para buscas complexas
    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }
    const data = await response.json();

    if (Array.isArray(data) && data.length > 0 && !data[0].erro) { // ViaCEP retorna [{ "erro": true }] se nada for encontrado
      return {
        resultados: data.map(item => ({
          cep: item.cep,
          logradouro: item.logradouro,
          complemento: item.complemento,
          bairro: item.bairro,
          localidade: item.localidade,
          uf: item.uf,
          ibge: item.ibge,
          gia: item.gia,
          ddd: item.ddd,
          siafi: item.siafi
        })),
        fonte: "ViaCEP"
      };
    } else if (data.erro || (Array.isArray(data) && data.length === 0)) {
        return { erro: true, mensagem: chrome.i18n.getMessage("feedbackNoAddressFound") || 'Nenhum CEP encontrado para o endereço informado.' };
    }
     return { erro: true, mensagem: chrome.i18n.getMessage("feedbackNoAddressFound") || 'Nenhum CEP encontrado para o endereço informado.' };
  } catch (error) {
    console.error('Erro ao buscar CEP por endereço:', error);
    return { erro: true, mensagem: `${chrome.i18n.getMessage("feedbackErrorSearchAddress") || 'Erro ao buscar endereço:'} ${error.message}` };
  }
}

console.log("Facilita cepUtils.js loaded.");
