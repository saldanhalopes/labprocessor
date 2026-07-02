# Arvore de Rotas Analiticas - UX Spec

## Reader

Este documento e para a pessoa que vai implementar ou revisar a experiencia da Phase 7.

## Post-read action

Depois de ler, a pessoa deve conseguir construir a interacao da arvore de rotas sem depender desta conversa.

## Objetivo da experiencia

A visualizacao da arvore de rotas existe para responder rapidamente:
- qual e o caminho analitico do teste;
- onde o fluxo bifurca ou converge;
- quais rotas concentram mais tempo;
- e onde esse fluxo acontece fisicamente no laboratorio.

Ela nao substitui a planilha nem a simulacao. Ela fica no meio:
- mais explicativa que a planilha;
- mais estrutural que a simulacao temporal.

## Estrutura da tela

### Layout base

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Header de contexto + KPIs + controles                                     │
├───────────────────────────────────────────────────────┬────────────────────┤
│ Arvore principal                                      │ Mini mapa          │
│                                                       │ do laboratorio     │
├───────────────────────────────────────────────────────┴────────────────────┤
│ Painel de detalhes contextual                                                │
└────────────────────────────────────────────────────────────────────────────┘
```

### Blocos

1. Header
   - nome do teste
   - breadcrumbs: forma farmaceutica > teste
   - toggle `Planilha | Arvore`
   - opcionalmente `Diagrama legado` durante transicao

2. KPI strip
   - `Tempo total`
   - `Tempo MO`
   - `Tempo MAQ`
   - `Rotas envolvidas`
   - `Trocas de rota`
   - `Maior gargalo`
   - `Economia por paralelismo`

3. Arvore principal
   - canvas SVG com scroll
   - no raiz do teste
   - galhos sequenciais e paralelos
   - merges claros quando fluxos voltam a convergir

4. Mini mapa
   - usa o layout fisico do laboratorio
   - destaca apenas rotas tocadas pelo teste atual
   - mostra ordem de passagem

5. Painel de detalhes
   - aparece quando um no, aresta ou etapa e selecionado

## Modelo mental do usuario

O usuario precisa entender tres niveis ao mesmo tempo:

1. **Estrutura**
   - a analise comeca aqui, passa por estas rotas e termina ali.

2. **Paralelismo**
   - este trecho pode acontecer em paralelo.

3. **Espaco fisico**
   - essas rotas existem nesses pontos do laboratorio.

A interface deve deixar isso evidente sem exigir leitura longa.

## Interacoes principais

### 1. Hover em no

Quando o mouse passa sobre um no:
- o no ganha destaque visual;
- o caminho ate ele fica realcado;
- o mini mapa destaca a rota correspondente;
- surge tooltip curta com:
  - nome da rota
  - tempo agregado
  - tipo `MO` ou `MAQ`
  - quantidade de atividades ligadas

Objetivo:
- dar leitura rapida sem abrir painel.

### 2. Clique em no

Quando o usuario clica em um no:
- o no fica selecionado;
- o painel de detalhes abre ou atualiza;
- a etapa correspondente na arvore recebe foco visual;
- a planilha pode ser preparada para futura sincronizacao.

O painel mostra:
- nome da rota;
- tempo total da rota;
- atividades associadas;
- em quais etapas ela aparece;
- tipo de execucao;
- se e gargalo ou nao;
- links de navegacao interna, por exemplo `ver etapa`, `ver no mapa`.

### 3. Hover em aresta

Ao passar sobre uma conexao:
- a aresta engrossa levemente;
- tooltip mostra:
  - rota origem
  - rota destino
  - tempo da transicao ou trecho
  - se representa `Padrão`, `Amostra` ou misto

Objetivo:
- explicar o fluxo entre nos, nao apenas os nos isolados.

### 4. Clique em etapa paralela

Cada etapa paralela pode ser interativa.

Estados:
- expandida
- recolhida
- consolidada

Ao clicar na etapa:
- mostra resumo do ganho de paralelismo;
- destaca os galhos que pertencem a ela;
- permite alternar entre:
  - `Consolidado`
  - `Detalhado`

Em `Consolidado`:
- o usuario ve o tempo efetivo da etapa.

Em `Detalhado`:
- o usuario ve todos os galhos e atividades separadamente.

### 5. Clique no mini mapa

Ao clicar em uma estacao do mini mapa:
- a rota correspondente na arvore e destacada;
- o painel mostra a rota selecionada;
- as demais rotas ficam levemente atenuadas.

Objetivo:
- permitir navegar pelo espaco fisico para chegar ao fluxo logico.

### 6. Navegacao por teclado

Minimo esperado:
- `Tab` percorre controles, nos selecionaveis e mapa;
- `Enter` seleciona o item em foco;
- `Esc` fecha detalhe ou limpa selecao;
- setas podem navegar entre nos irmaos quando isso for simples de implementar.

## Modos de leitura

### Estrutura

Modo padrao.

Mostra:
- arvore limpa;
- tempos agregados;
- bifurcacoes;
- merges.

Nao enfatiza carga operacional.

### Gargalo

Destaca:
- rota critica;
- trecho com maior concentracao de tempo;
- caminho principal do fluxo.

### Layout

Enfatiza:
- mini mapa;
- linhas de percurso fisico;
- ordem espacial das rotas.

### Comparacao

Nao precisa entrar na primeira entrega, mas a interface deve deixar espaco conceitual para existir depois.

## Comportamentos de sincronizacao

Mesmo sem implementar tudo na primeira fase, a UX ja deve prever sincronizacao entre visoes.

### Arvore -> mapa
- hover ou clique na arvore destaca estacao no mapa.

### Mapa -> arvore
- clique no mapa destaca o no correspondente.

### Arvore -> planilha
- clique em no ou etapa pode rolar para a etapa correspondente depois.

### Planilha -> arvore
- ao clicar em atividade na planilha, a arvore pode focar o trecho correspondente.

## Regras visuais

### Nos
- `MO`: ambar
- `MAQ`: azul
- gargalo: destaque extra, nao troca total de semantica
- selecionado: borda forte
- hover: glow ou aumento leve de contraste

### Arestas
- linha solida para caminho padrao
- linha tracejada para amostra
- espessura maior quando trecho carrega mais tempo

### Etapas paralelas
- fundo ou moldura proprio da etapa
- abertura lateral clara
- reconvergencia visivel

### Legibilidade
- nomes longos de rota precisam quebrar linha
- numeros de tempo devem ficar sempre visiveis
- scroll horizontal e aceitavel
- zoom e pan sao desejaveis se o desenho crescer muito

## Estados vazios e erros

### Sem etapas
- mostrar mensagem clara:
  - `Nenhuma etapa disponivel para visualizar.`

### Sem coordenada no layout
- a arvore continua funcionando normalmente;
- o mini mapa ignora a rota ausente;
- opcionalmente mostra aviso discreto:
  - `Algumas rotas ainda nao possuem posicao no layout.`

### Teste muito grande
- permitir scroll;
- reduzir detalhes secundarios em niveis de zoom menores;
- manter KPIs sempre visiveis.

## Cenarios de uso

### Cenario 1 - leitura rapida
- usuario abre um teste;
- olha KPIs;
- passa o mouse pelos principais nos;
- identifica gargalo em menos de 10 segundos.

### Cenario 2 - entendimento de paralelismo
- usuario clica em uma etapa paralela;
- alterna para `Detalhado`;
- compara economia por paralelismo;
- entende quais galhos sao simultaneos.

### Cenario 3 - validacao com o layout
- usuario clica em uma rota critica;
- o mini mapa mostra onde ela fica;
- ele valida se o fluxo esta coerente com o espaco fisico.

## Fora de escopo da primeira entrega

- timeline completa tipo Gantt;
- animacao temporal de amostras dentro da arvore;
- comparacao multi-produto no mesmo canvas;
- edicao drag-and-drop da arvore;
- engine de auto-layout sofisticada com biblioteca externa.

## Criterios de aceite de UX

- o usuario entende onde o fluxo bifurca sem explicacao verbal;
- o gargalo principal fica visivel sem abrir a simulacao;
- o mini mapa reforca, e nao compete com, a arvore;
- um clique em no sempre responde com contexto util;
- a tela continua legivel em desktop sem depender de zoom obrigatorio;
- a experiencia funciona mesmo quando o layout nao cobre 100% das rotas.

