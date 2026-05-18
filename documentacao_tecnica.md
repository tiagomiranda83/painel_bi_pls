# 🛠️ Documentação Técnica - Painel BI Iniciativas (v03)

Este documento fornece uma visão técnica detalhada da arquitetura, lógica e componentes do Painel de BI 2026.

---

## 🏗️ 1. Arquitetura do Projeto
O projeto segue uma arquitetura **Single Page Application (SPA)** clássica, processada inteiramente no lado do cliente (Client-side Rendering).

### Estrutura de Arquivos:
- `index.html`: Estrutura semântica HTML5, links de bibliotecas e esqueleto do layout. **Otimização recente**: A `top-bar` foi abolida para amplificar o *viewport* vertical dos gráficos, movendo controles corporativos para a `.right-sidebar`.
- `styles.css`: Design System baseado em variáveis CSS (tokens), layout em Grid/Flexbox e sistema de temas.
- `app.js`: O "cérebro" da aplicação. Gerencia estado, filtros, motor de relatórios PDF/XLSX e interações.
- `parse.mjs`: Utilitário para sanitização e parsing de dados XLSX (caso necessário via terminal).
- `Iniciativas_..._v03.xlsx`: A base de dados em formato Excel.

---

## 🧠 2. Gerenciamento de Estado (`GlobalState`)
O dashboard utiliza um objeto literal `GlobalState` no `app.js` para centralizar a verdade da aplicação.

### Propriedades Principais:
- `filters`: Retém os filtros ativos dos gráficos e mapa (cross-filtering).
- `tableFilters` e `pagination`: Gerenciam de forma autônoma o estado do grid virtual DOM para não onerar o browser.
- `customColors`: Um mapa dinâmico `Eixo -> Hexadecimal`, alimentado pela sidebar de legenda e sincronizado com as cores de tema.
- `isCustomized`: Registra quais eixos tiveram cores alteradas manualmente para garantir persistência entre temas.

### Métodos de Reação:
- `setFilter(key, value)`: Altera um filtro, remove a seleção se clicado novamente e dispara a função `processAndRender()`.
- `updateUI()`: Atualiza os badges (etiquetas) de filtros ativos na sidebar.

---

## 📊 3. Motores de Visualização

O painel utiliza uma abordagem híbrida com duas das melhores bibliotecas do mercado:

### A. Chart.js (Gráficos Estatísticos)
- **Uso**: Gráficos de Rosca, Barras Empilhadas (Capa), Barras Verticais/Horizontais e Pareto.
- **Função Core**: `createOrUpdateChart()`. 
- **Destaque**: Implementa uma lógica de reaproveitamento de instâncias. Em vez de destruir o gráfico, ela apenas atualiza os dados e as cores, garantindo animações fluidas e performance.

### B. Apache ECharts (Mapas e Dados Complexos)
- **Uso**: Mapa do Brasil (`map`), Nuvem de Termos (`wordCloud`) e Matriz de Calor (`heatmap`).
- **Integração**: Utiliza o método `setOption()` para atualizações parciais.
- **Heatmap**: O motor calcula a intensidade (`alpha`) dinamicamente com base no volume de cada célula em relação ao valor máximo global.

---

## 🎨 4. Motor de Sincronia de Cores
A grande inovação da v03 é o sistema de **Legenda Permanente**.

1.  **Cores Padrão Dinâmicas**: No `app.js`, os eixos específicos (Energia Elétrica, Água, Resíduos) buscam suas cores diretamente das variáveis CSS (`--color-energia`, etc.), permitindo que o tom mude suavemente entre os temas Escuro, Claro e Praia.
2. **Mecanismo de Resiliência (Fallback)**: Foi implementado um sistema de conversão dupla (RGB <-> HEX) no `app.js` (`hexToRGBA`, `colorToHex`) e uma trava estática hardcoded. Isso previne race conditions frequentes onde o navegador tentava ler as variáveis CSS antes de sua inicialização completa, o que resultava em gráficos pretos silenciosos.
3. **Persistência Manual**: Se o usuário ajustar um picker, o sistema marca esse eixo como "customizado" e ignora as trocas de tema para aquela cor específica.
4. **Propagação**: A função `updateAllChartsColors()` sincroniza essa lógica em todos os motores, além de ignorar instâncias que não possuem o método adequado (`chart.setOption`), cortando conflitos entre Chart.js e ECharts.

---

## 🧪 5. Processamento de Dados
O fluxo de dados segue este pipeline:
1.  **Leitura**: `XLSX.read()` converte o Excel para JSON.
2.  **Filtragem**: `getFilteredData()` aplica os filtros cumulativos (`filter()` nativo do JS).
3.  **Agregação**: `countBy()` gera as frequências para os gráficos.

5.  **Renderização**: As funções específicas (ex: `renderMap`, `renderPareto`) recebem os dados filtrados e atualizam os canvases/divs.

---

## 🖨️ 6. Motor de Relatórios e Exportação
A aba `screen-data` abriga a Tabela de Dados e a lógica de PDF/XLSX:
1. **Performance**: A tabela deixou de estampar a supercoluna "Iniciativa Bruta", poupando ciclos cruciais de CPU no browser do cliente durante rolagens e loops de pesquisa.
2. **Modal Inteligente**: O gerador de relatórios mapeia `GlobalState.filters` e `GlobalState.tableFilters` em tempo real.
   - Se o array de filtros `active.length === 0`: Ele injeta nativamente o radio button para exportação da **Base Completa**.
   - Se houver filtros presentes: A seleção muda para **Dados Filtrados**, garantindo WYSIWYG (O que você vê é o que você obtém).
3. **Injeção em PDF**: O método `exportToPDF()` não só injeta estilos transpilados baseados em `window.print()` e `@page`, como recolhe a `string` de formatação com os metadados dos filtros ativos e chumba irreversivelmente no cabeçalho do documento, para fins de arquitetura de informação.

---

## 🛠️ 7. Guia de Manutenção

### Adicionar um Novo Gráfico:
1.  Crie um `<canvas id="meu-novo-grafico">` no `index.html`.
2.  No `app.js`, dentro de `processAndRender()`, agregue os dados necessários.
3.  Chame `createOrUpdateChart('meu-novo-grafico', ...)` passando os dados e as cores customizadas do `GlobalState`.

### Alterar a Base de Dados:
Basta substituir o nome do arquivo na função `fetch` inicial do `app.js` (ou garantir que o arquivo v03 esteja na mesma pasta com o nome atualizado).

---
**Desenvolvimento**: Dash v03 - Advanced Agentic Coding.
**Licença**: Uso Interno Estratégico.
