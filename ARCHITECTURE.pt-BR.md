# Arquitetura

[English](ARCHITECTURE.md)

## O formato do problema

Três CLIs de agente, um operador, um conjunto de intenções. Claude Code, Codex e OpenCode leem
instruções, skills, subagentes, hooks e servidores MCP, e cada uma guarda tudo de um jeito
diferente o bastante para que nenhum arquivo possa ser compartilhado. Não existe formato comum
para padronizar e nem perspectiva de que exista, porque as diferenças são diferenças reais de
capacidade e não escolhas arbitrárias.

Então o trabalho é tradução, não padronização. Você escreve em um vocabulário neutro e cada
harness recebe o próprio dialeto nativo. Tudo aqui decorre disso.

## Para quem isso é

Para quem usa pelo menos uma dessas CLIs todo dia, quer a configuração dos agentes no git, e
quer que seja a mesma configuração onde quer que rode. A coisa toda tem que ser legível para
alguém que abre o diretório pela primeira vez, o que descarta qualquer solução que exija seu
próprio ferramental antes do primeiro arquivo fazer sentido.

## Três camadas

**Declaração.** Um `tackroom.jsonc` escrito no vocabulário do usuário e não no das harnesses:
`instructions`, `skills`, `subagents`, `hooks`, `mcpServers`. Nenhuma chave exige saber qual
arquivo uma harness lê ou qual formato ela quer. A validação relata todos os problemas do
arquivo de uma vez em vez de morrer no primeiro.

**Tradução.** A declaração é renderizada no formato de origem do rulesync dentro de um diretório
temporário e o motor roda em cima dele. O tackroom em si não escreve nada no seu diretório home.

**Os scripts.** Hooks são executáveis que ficam no diretório de configuração e são referenciados
por caminho absoluto, então editar um deles tem efeito sem apply e mover o diretório não os
quebra silenciosamente.

## Por que a tradução é emprestada

Escrever a tradução por harness nós mesmos era o design original e estava errado. Três harnesses
é o número de hoje; cada uma anda por conta própria, e a tabela de tradução é manutenção pura
sem nenhum discernimento dentro. O rulesync já acompanha mais de 30 agentes, e durante a
reescrita ele sabia algo que o nosso código não sabia: o Codex ganhou um formato de subagente,
ou seja, o teste que afirmava que o Codex não recebe arquivos de agente afirmava um fato que
tinha vencido.

A superfície de opções continua sendo nossa, porque essa é a parte que o usuário lê e a parte
que não deveria acompanhar o vocabulário de mais ninguém.

## Para que servem os testes

A promessa do produto é que uma regra escrita uma vez vale em todo lugar. Essa promessa só vale
alguma coisa se for verificada, então os testes rodam o motor de verdade dentro de um home
isolado e verificam o que ele produziu:

- o corpo das instruções chega idêntico byte a byte em cada harness habilitada
- um sufixo por harness chega na própria harness e em nenhuma outra
- toda skill declarada cai no diretório de skills de cada harness
- subagentes chegam em todas as harnesses, cada uma no seu schema
- um hook chega nas três, com o comando como caminho absoluto
- uma harness fora da declaração não recebe nada

Eles verificam o que o motor de fato escreveu, então uma atualização do motor que mude um layout
quebra aqui e não na máquina de alguém. Uma divergência que eles não peguem é bug do conjunto de
testes, não um resultado aceitável.

## Decisões que valem discussão

**Sem Nix.** Uma versão anterior era um módulo home-manager com o motor travado por uma
fixed-output derivation e os resultados ligados por symlink a partir da store. Isso comprava
travamento de versão do motor, que o `package-lock.json` também compra; rollback, que o git
também compra para um diretório de markdown; e apply atômico, que já era parcial porque os
documentos de configuração precisavam ser mesclados no lugar em vez de virarem symlink. Em troca
custava uma instalação de vários gigabytes, um daemon, um arquivo versionado registrando em qual
máquina você estava, e uma linguagem que o público não conhece. Também forçava a existência de
três camadas, uma derivation de projeção, um módulo de posicionamento e um script de merge, que
existiam apenas porque um sandbox de build não pode escrever no seu diretório home. Tirar o Nix
apagou todas elas.

**Um lockfile versionado em vez de uma faixa de versões.** Um apply deveria produzir os mesmos
arquivos hoje e no mês que vem. Atualizar o motor é um ato deliberado com um diff para ler.

**Hooks por caminho absoluto em vez de copiados.** Um script copiado é uma segunda fonte da
verdade que envelhece entre um apply e outro. Referenciar o arquivo onde você o edita significa
que o que roda é o que você escreveu.

**Fidelidade honesta de hooks em vez de mínimo denominador comum.** O plugin gerado do OpenCode
não consegue passar payload para o comando. O tackroom poderia ter escondido isso recusando-se a
modelar hooks, ou disfarçado escrevendo o próprio plugin do OpenCode e assumindo a manutenção da
qual acabamos de nos livrar. Em vez disso a limitação está documentada, o `doctor` avisa sobre
ela, e o exemplo gerado vira no-op quando não consegue ver o que estaria recusando.

**Os padrões de bloqueio moram em outro lugar.** O tackroom entrega a fiação e um exemplo. Uma
biblioteca mantida de padrões de comando perigoso é outro produto, e o cc-safety-net já é ele.

## Deliberadamente fora de escopo

Supervisionar agentes de longa duração, multiplexar terminal, telemetria, roteamento de prompt
ou de modelo, e configuração por projeto. Os dois primeiros têm ferramentas próprias. O resto
puxaria atrás de si a superfície de um produto inteiro cada um.

## Para onde isso vai

Sobreposições por projeto, para um repositório somar regras às da máquina. Mais harnesses, cada
uma um target no motor. Um `tackroom diff` que mostre por inteiro o que um apply mudaria, e não
apenas quais arquivos ele tocaria.
