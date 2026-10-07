# Exercícios 1 a 5 — configuração segura de ambiente

Aplicação HTTP mínima em TypeScript para demonstrar carregamento de `.env`, separação de ambientes, validação centralizada com Joi e inicialização segura do servidor.

## Preparação e execução

Requisitos: Node.js 20 ou superior e npm.

```powershell
npm install
Copy-Item .env.example .env
npm run build
npm run start:dev
```

O `.env.example` não contém credenciais. Depois de copiá-lo, preencha `API_KEY` apenas no `.env` local antes de iniciar. O servidor responde em `http://127.0.0.1:3000/health`.

Para desenvolvimento com recarga automática: `npm run dev`.
Para produção: crie `.env.production` com as configurações do ambiente e execute `npm run build` seguido de `npm start`. Não coloque credenciais reais no Git.

Execute os testes com `npm test`. A aplicação e os testes são escritos em TypeScript e compilados pelo mesmo `tsconfig.json`; o JavaScript em `dist/` é somente saída gerada para execução pelo Node.js e não é versionado. Os testes cobrem conversão e limites de porta, ausência de variáveis obrigatórias, validação conjunta de erros, resposta HTTP e porta já ocupada.

## Exercício 1 — Criando e usando o `.env`

**Sintoma:** variáveis lidas antes do carregamento do dotenv apareciam como `undefined`. Valores recebidos do ambiente também são texto: somar `1` a `"3000"` resulta em `"30001"`, não em `3001`.

**Comando executado para reproduzir o tipo textual (PowerShell):**

```powershell
$env:PORT = '3000'
node -e "const p = process.env.PORT; console.log({valor: p, tipo: typeof p, soma: p + 1})"
```

**Resultado esperado vs. obtido:** para a soma numérica, `3000` (`number`) + `1` (`number`) deve resultar em `3001` (`number`). A leitura direta do ambiente obtém `"3000"` (`string`) e `"30001"` (`string`). Depois da validação, `config.port` é `3000` (`number`).

**Hipótese, investigação e causa:** imports estáticos podem executar módulos dependentes antes de uma chamada posterior a `dotenv.config()`. Além disso, `process.env` sempre fornece strings. O projeto carrega dotenv no início de `config.ts`, antes de validar e exportar os valores consumidos pela aplicação; os arquivos `.env` usam valores sem aspas desnecessárias.

**Correção e validação:** `src/config.ts` concentra o carregamento e converte `PORT` com Joi. O caminho do arquivo é resolvido a partir do próprio módulo, e não do diretório em que o comando foi chamado. `npm test` verifica que `"4321"` passa a ser `4321` (`number`). A chave não é impressa; o endpoint `/health` também não expõe configuração.

## Exercício 2 — Separando ambientes (`development` e `production`)

**Sintoma:** atribuir `env = 'production'` altera a variável em vez de comparar; chamar `dotenv.config()` mais de uma vez sem `override` não troca valores já carregados; scripts que definem variáveis no formato Unix não funcionam em todos os terminais do Windows.

**Comando executado para validar os modos:**

```powershell
npm run start:dev
npm start
```

**Resultado esperado vs. obtido:** sem `NODE_ENV`, a configuração seleciona `development`; em `npm start`, `cross-env` define `production`. O arquivo `.env.<ambiente>` tem precedência sobre `.env`, e cada variável fica disponível como o tipo validado, não como texto bruto.

**Hipótese, investigação e causa:** o erro decorre de atribuição no condicional, de carregar arquivos em ordem que impede a sobreposição e de sintaxe de shell específica. A seleção do arquivo é feita uma única vez, com base em uma lista permitida de ambientes.

**Correção e validação:** os scripts usam `cross-env`; `config.ts` usa `path.resolve` relativo ao projeto e adota `development` quando `NODE_ENV` não foi informado. O teste de configuração valida o ambiente `test`; os scripts de desenvolvimento e produção definem seus modos explicitamente.

## Exercício 3 — Segurança no Git e `.env.example`

**Sintoma:** um `.env` pode continuar aparecendo no `git status` mesmo depois de incluído no `.gitignore`, se já tiver sido rastreado; uma regra ampla para `.env.*` também pode ignorar o arquivo de exemplo.

**Comando executado para conferir o rastreamento:**

```powershell
git status --short
git check-ignore -v .env .env.example
```

**Resultado esperado vs. obtido:** `.env` e `.env.*` devem ser ignorados, enquanto `.env.example` deve permanecer visível ao Git. Ignorar um arquivo não remove do índice um arquivo que já era rastreado.

**Hipótese, investigação e causa:** `.gitignore` só afeta arquivos não rastreados. Uma credencial já enviada ao histórico precisa ser tratada como exposta, não apenas apagada da versão atual.

**Correção e validação:** `.gitignore` ignora `.env` e `.env.*`, com a exceção `!.env.example`. O exemplo não contém valor de API key. Neste diretório novo não havia `.env` rastreado; num repositório em que ele já esteja no índice, remova apenas o rastreamento sem apagar a cópia local com `git rm --cached -- .env`. Se uma credencial real chegou ao Git, revogue-a e gere outra imediatamente.

## Exercício 4 — Validação de variáveis obrigatórias

**Sintoma:** uma aplicação sem `API_KEY` inicia e só falha mais tarde, quando a variável é usada.

**Comando executado para validar inicialização:**

```powershell
$env:API_KEY = ''
npm run start:dev
```

**Resultado esperado vs. obtido:** sem chave válida, a aplicação deve encerrar durante a inicialização e informar `API_KEY`; não deve começar a aceitar requisições. Com `API_KEY` preenchida, o processo inicia. A chave é validada como `string` não vazia e não é impressa.

**Hipótese, investigação e causa:** um esquema opcional adia a descoberta do erro; validar uma variável por vez também esconde as demais configurações incorretas.

**Correção e validação:** Joi exige `API_KEY`, valida `PORT` e `HOST` e usa `{ abortEarly: false }`. A aplicação lança um erro explícito antes de iniciar o servidor. `npm test` cobre chave ausente e a apresentação conjunta dos erros de `API_KEY` e `PORT`.

## Exercício 5 — Porta com fallback e tratamento de erros

**Sintoma:** `process.env.PORT || 3000` usa o fallback quando a porta está vazia; valores fora da faixa e conflitos de porta podem provocar falhas pouco claras.

**Comando executado para reproduzir conflito (duas janelas PowerShell):**

```powershell
npm run start:dev
```

Execute-o novamente na segunda janela, com o mesmo `.env`.

**Resultado esperado vs. obtido:** uma porta omitida usa `3000` (`number`); uma porta vazia ou inválida falha na validação, sem fallback silencioso. Para uma porta livre, o servidor informa o endereço real após `listen`. Para uma porta ocupada, informa `A porta <n> já está em uso.` e encerra com código `1`, sem mostrar segredos.

**Hipótese, investigação e causa:** o operador `||` não distingue ausência de valor de string vazia. `listen` reporta conflitos de porta pelo evento `error` com código `EADDRINUSE`; o log imediato de uma porta presumida também não comprova que o bind teve sucesso.

**Correção e validação:** Joi aplica o valor padrão apenas quando `PORT` está ausente e aceita somente inteiros de `1024` a `65535`. O evento `error` trata `EADDRINUSE`; o endereço é obtido em `server.address()` no callback de sucesso. Os testes iniciam o servidor, chamam `/health` e tentam iniciar uma segunda instância na mesma porta, verificando a mensagem e o código de saída.

## Regra de segurança

O único arquivo da aplicação que consulta `process.env` é `src/config.ts`. Não registre o objeto completo de ambiente, nem `API_KEY`, senhas ou tokens. Use somente o objeto validado exportado pela configuração.
