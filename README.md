# Sistema de Requisição e Entrega de Peças 📦⚙️

Uma Single Page Application (SPA) desenvolvida no **Google Apps Script** para orquestrar o fluxo de requisição, aprovação e entrega de peças entre a Oficina Mecânica e o Almoxarifado.

## 🚀 Funcionalidades

O sistema é dividido em quatro painéis baseados na função do usuário dentro da operação[cite: 13]:

*   **Painel do Mecânico (Requisição):** Interface para identificação do veículo (Placa/Prefixo) e busca de peças. Conta com um sistema inteligente de sugestões cruzadas baseado no histórico de consumos do equipamento, chassi e carroceria[cite: 12, 13].
*   **Painel do Líder (Aprovação):** Visão geral do estado da oficina, listando todos os pedidos ativos em tempo real para acompanhamento da manutenção[cite: 13].
*   **Painel de Logística (Supply):** Controle operacional do almoxarifado para separação e entrega física das peças, permitindo o registro de requisições SAP e apontamento de falta de saldo[cite: 13].
*   **Sincronização de Dados:** Módulo administrativo para upload de arquivos CSV que atualizam as bases locais do sistema (Histórico de Consumos, Cadastro de Frota e Posicionamento no Almoxarifado) diretamente para o banco de dados do Google Sheets[cite: 13].

## 🛠️ Tecnologias Utilizadas

*   **Frontend:** HTML5, CSS3, Tailwind CSS (Design responsivo e interface limpa) e Ícones Lucide[cite: 13].
*   **Backend / Banco de Dados:** Google Apps Script (`Code.gs`) atuando como servidor de API (`google.script.run`) e Google Sheets atuando como banco de dados NoSQL[cite: 12, 13].
*   **Estado e Reatividade:** JavaScript Vanilla (ES6+) gerenciando transições de tela e estados locais sem necessidade de frameworks pesados[cite: 13].

## ⚙️ Instalação e Uso

1.  Crie uma nova planilha no Google Sheets com as seguintes abas: `Consumos`, `Posicionamento Almoxarifado`, `Veiculos` e `Pedidos`[cite: 12].
2.  Abra o editor de extensões do Google Apps Script.
3.  Crie um arquivo `Code.gs` e insira o código de backend.
4.  Substitua a variável `SPREADSHEET_ID` no topo de `Code.gs` pelo ID da sua nova planilha[cite: 12].
5.  Crie um arquivo `index.html` e insira o código de frontend[cite: 13].
6.  Publique o projeto como um "Aplicativo Web".
