# FelpAutomations

Sistema de Automação.

Central desktop local para executar fluxos de navegação com Electron, TypeScript e Playwright. A primeira versão oferece um fluxo genérico: abrir uma URL no Chromium visível, validar a resposta HTTP, obter o título e salvar uma captura da página.

A identidade FelpAutomations utiliza um robô angular, painéis grafite, violeta e ciano. O logo transparente, o ícone Windows e suas variações de tamanho ficam em `public/brand`, com guia de uso em `public/brand/IDENTITY.md`. Para reconstruir os tamanhos de ícone a partir do mestre, execute `./scripts/build-icons.ps1` no PowerShell. A troca de nome preserva o diretório de dados original para manter o histórico existente.

## Desenvolvimento

Requer Node.js 22.12+ (ou 24+) e Windows. Na primeira preparação:

```powershell
npm install
npm run browser:install
npm run dev
```

Após a preparação, `npm start` abre a última compilação. `npm run dev` recompila e abre o aplicativo. `npm test` compila e valida os contratos de entrada. `npm run test:desktop` verifica a interface e a navegação real usando um site de teste local, incluindo resposta HTTP de erro e cancelamento. Ainda não há instalador distribuível.

## Uso

Nesta máquina, o atalho **Abrir FelpAutomations.lnk**, na raiz do projeto, abre a versão compilada sem terminal. Ele depende desta pasta e das dependências instaladas; não é um instalador portátil.

Informe uma URL HTTP/HTTPS e clique em **Executar fluxo**. O Chromium abre em uma janela separada. Acompanhe as etapas e abra a captura pelo resultado. Com **Manter navegador aberto**, a execução termina e o navegador permanece disponível para exploração; encerre-o pelo app ou pela própria janela antes do próximo fluxo. **Cancelar execução** interrompe a execução ativa.

O histórico das últimas 100 execuções e as capturas ficam no diretório de dados do aplicativo (`app.getPath('userData')`). Apenas o histórico é limitado a 100 itens; a limpeza automática dos arquivos de evidência ainda não está implementada. URLs e capturas podem conter dados do site, portanto utilize dados de teste. O histórico não armazena cookies ou sessões de autenticação. Cada execução abre um contexto de navegador novo.

## Estrutura

- `src/renderer`: interface local, sem acesso direto ao Node.js.
- `src/shared`: contratos de comunicação e validação das entradas.
- `src/electron/main.ts`: coordenação, histórico e ponte IPC restrita.
- `src/electron/worker.ts`: processo separado que executa o Playwright.
- `src/electron/preload.ts`: métodos permitidos à interface.

O renderer não carrega sites externos. A navegação ocorre exclusivamente no navegador controlado pelo Playwright. Novos fluxos podem substituir a operação de navegação preservando os contratos de execução, logs e evidências. Esta etapa usa a biblioteca Playwright; integração de suítes com Playwright Test e reporters é uma evolução posterior.
