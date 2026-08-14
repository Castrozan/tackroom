# tackroom

[English](README.md)

Declare sua configuração de Claude Code, Codex e OpenCode uma vez. Aplique em qualquer lugar.

Um tackroom é a sala do estábulo onde os arreios ficam guardados, consertados e ajustados antes
do uso. Esta é essa sala para as CLIs de agente que você usa: um diretório com as regras, as
skills, os subagentes, os hooks e os servidores MCP, projetados sobre qualquer uma delas.

```bash
npx tackroom init ~/agents
```

Isso gera a configuração, aplica, e deixa você com um diretório comum de markdown e scripts.
Depois disso você edita arquivos e roda `npx tackroom apply`. Não há nada a instalar além do
Node, que você já tem, e você nunca mais mexe em `~/.claude`, `~/.codex` ou
`~/.config/opencode` na mão.

## O problema que ele resolve

As três CLIs querem as mesmas coisas e guardam cada uma de um jeito. Suas regras ficam em
`CLAUDE.md` numa e em `AGENTS.md` nas outras. As skills ficam em três diretórios distintos. Um
frontmatter de subagente que o Claude aceita quebra a configuração do OpenCode por completo, e o
Codex quer TOML para a mesma coisa. Hooks são uma chave de configuração numa, um arquivo próprio
na outra, e um plugin JavaScript na terceira.

Manter tudo em dia na mão não falha alto. Falha divergindo, então uma regra que você achava que
valia em todo lugar passa a valer em uma CLI só, e você só percebe quando um agente faz
exatamente aquilo que você mandou não fazer.

## O que você escreve

```jsonc
{
  "harnesses": ["claude", "codex", "opencode"],

  "instructions": "instructions/AGENTS.md",
  "skills": "skills",
  "subagents": "subagents",

  "hooks": {
    "preToolUse": [{ "matcher": "[Bb]ash", "command": "./hooks/refuse-force-push.mjs" }],
  },

  "mcpServers": {
    "chrome-devtools": { "command": "npx", "args": ["chrome-devtools-mcp@latest"] },
  },
}
```

## Onde cada coisa vai parar

| Você declara   | Claude Code               | Codex                  | OpenCode                           |
| -------------- | ------------------------- | ---------------------- | ---------------------------------- |
| `instructions` | `~/.claude/CLAUDE.md`     | `~/.codex/AGENTS.md`   | `~/.config/opencode/AGENTS.md`     |
| `skills`       | `~/.claude/skills/`       | `~/.agents/skills/`    | `~/.config/opencode/skills/`       |
| `subagents`    | `~/.claude/agents/`       | `~/.codex/agents/`     | `~/.config/opencode/agents/`       |
| `hooks`        | `~/.claude/settings.json` | `~/.codex/hooks.json`  | `~/.config/opencode/plugins/`      |
| `mcpServers`   | `~/.claude.json`          | `~/.codex/config.toml` | `~/.config/opencode/opencode.json` |

O corpo das instruções chega idêntico byte a byte nas três, e um teste quebra a build se algum
dia deixar de chegar. O frontmatter dos subagentes é reescrito por harness no caminho, porque o
OpenCode trata um arquivo de agente que não consegue interpretar como erro fatal de configuração
em vez de ignorar, e o Codex quer TOML em vez de markdown.

## Hooks

Um hook é um executável comum. Ele roda em um evento do ciclo de vida do agente, e recusar é o
que justifica a existência dele: saia com código diferente de zero e a ação é bloqueada. Um
comando que começa com `./` é resolvido a partir do seu diretório de configuração e marcado como
executável no apply, então o script continua fazendo parte do repositório em vez de virar algo
que você instala à parte.

As três harnesses não oferecem a mesma coisa aqui, e o tackroom não finge o contrário:

**Claude Code** recebe hooks nativos no `settings.json`. Seu script recebe o payload completo do
evento como JSON no stdin e pode responder no stdout com um `permissionDecision` e um motivo que
o modelo lê. Esse é o protocolo completo.

**Codex** recebe hooks nativos em `.codex/hooks.json`, apenas do tipo comando.

**OpenCode** recebe um plugin gerado. O plugin chama o seu comando mas não passa payload nenhum
no stdin e descarta o stdout, então o script consegue recusar saindo com código diferente de
zero, mas não consegue ver o que está recusando. Escreva hooks que viram no-op quando não
recebem payload, do jeito que o exemplo gerado faz, em vez de hooks que bloqueiam às cegas.

Um `matcher` é uma regex testada contra o nome da ferramenta de cada harness, e esses nomes
diferem em maiúsculas e minúsculas entre elas, então use `[Bb]ash` em vez de `Bash`. Essa é uma
das poucas coisas numa configuração do tackroom que não é totalmente portável.

Se o que você quer é um conjunto de padrões mantido por alguém em vez dos seus próprios scripts,
o [cc-safety-net](https://github.com/kenryu42/cc-safety-net) faz isso em doze agentes.

## Comandos

```
npx tackroom init [dir]     Gera uma configuração e aplica
npx tackroom apply [dir]    Projeta a configuração em cada harness declarada
npx tackroom doctor [dir]   Diz o que está declarado, o que está aplicado, o que está velho
```

O `doctor` pergunta ao próprio motor se os arquivos aplicados ainda batem com a sua declaração,
então ele nomeia os arquivos que um apply reescreveria em vez de adivinhar a partir de caminhos
que ele decorou.

## Guia

**Começar.** `npx tackroom init ~/agents` escreve o esqueleto e aplica. Você fica com um
diretório contendo `tackroom.jsonc`, um `instructions/AGENTS.md`, uma skill, um subagente e um
hook, e com as três CLIs configuradas.

**Mudar uma regra.** Edite `instructions/AGENTS.md` e rode `npx tackroom apply ~/agents`. As três
harnesses recebem o novo corpo, byte a byte. Reinicie qualquer sessão de agente aberta para ela
recarregar.

**Adicionar uma skill.** Crie `skills/<nome>/SKILL.md`. Só isso. Ela cai nos três diretórios de
skill no próximo apply.

**Adicionar um subagente.** Coloque um markdown no formato do Claude em `subagents/`. Ele é
reescrito para o schema de frontmatter do OpenCode e para o TOML do Codex na saída.

**Adicionar um hook.** Escreva o script em `hooks/` e cite ele no `tackroom.jsonc`:

```jsonc
"hooks": {
  "preToolUse": [{ "matcher": "[Bb]ash", "command": "./hooks/meu-guarda.mjs" }]
}
```

O apply marca ele como executável e reescreve o comando como caminho absoluto. Teste o script na
mão antes de confiar nele, porque um hook que sempre sai com código diferente de zero bloqueia
toda chamada que casar com o matcher:

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' | ./hooks/meu-guarda.mjs; echo $?
```

**Usar só uma harness.** Tire nomes de `harnesses`. A harness removida para de receber arquivos,
e o `doctor` avisa em vez de deixar você adivinhando.

**Conferir o estado.** `npx tackroom doctor ~/agents` diz o que está declarado, o que está
aplicado e o que um apply reescreveria. Ele sai com código diferente de zero quando algo está
velho, então serve num prompt de shell ou numa linha de cron.

**Levar para outro lugar.** `git init`, commit, push, clone em outra máquina, `npx tackroom
apply`. Para voltar atrás, `git checkout <sha>` e outro apply.

## Por que não usar o rulesync direto?

Pode usar, e se você não se importa de escrever o `.rulesync/` na mão, use. O tackroom é um
invólucro em cima dele, e vale dizer exatamente o que esse invólucro compra.

O ponto substantivo são os caminhos dos hooks. Os comandos de hook do rulesync são strings
repassadas para cada harness, então um script do próprio repositório declarado como
`./hooks/guard.mjs` em modo global chega como `"$CLAUDE_PROJECT_DIR"/hooks/guard.mjs` no Claude
Code e como um `./hooks/guard.mjs` cru no Codex e no OpenCode. As três então resolvem o caminho
a partir de qualquer projeto em que o agente estiver, ou seja, o hook aponta para um arquivo que
não existe ali e silenciosamente nunca dispara. O tackroom resolve o comando a partir do seu
diretório de configuração e marca como executável, então um hook global de fato roda.

O resto é ergonomia. Um `instructions/AGENTS.md` e um mapa `instructionsSuffix` em vez de um
arquivo de regra por harness com frontmatter e lista de `targets` próprios. Um validador que
relata todos os problemas da sua configuração de uma vez, no seu vocabulário, e recusa as
configurações que não aplicariam nada. Um vocabulário para aprender em vez do layout do
`.rulesync/`, do frontmatter dele, da lista de features e dos nomes de target.

O que o tackroom não acrescenta é tradução própria. Toda decisão específica de harness é do
rulesync, e esse é justamente o ponto.

## Quem faz a tradução

O tackroom não escreve esses arquivos. Ele renderiza a sua declaração no formato de origem do
[rulesync](https://github.com/dyoshikawa/rulesync) e roda ele, para que o conhecimento
específico de cada harness fique num projeto que acompanha mais de 30 agentes em vez de num
módulo que ficaria para trás. A versão está travada no `package-lock.json`, então um apply
produz a mesma saída até você decidir atualizar.

Seus arquivos de configuração vivos não são atropelados. O motor mescla o que você declarou com
o que já está lá, então as chaves que uma harness escreve sozinha sobrevivem ao apply.

## Levando para outra máquina

A configuração é um diretório comum. Coloque no git, dê push, clone em outro lugar e rode
`npx tackroom apply`. Nada nela registra qual máquina a escreveu, então não existe arquivo por
máquina para reconciliar. Voltar atrás é `git checkout` seguido de outro apply.

## O que ele não é

Ele não supervisiona agentes de longa duração; o [clawde](https://github.com/castrozan/clawde)
faz isso. Ele não multiplexa seu terminal; o [herdr](https://github.com/castrozan/herdr) faz
isso. Ele configura as CLIs e sai da frente.

## Design

O [ARCHITECTURE.pt-BR.md](ARCHITECTURE.pt-BR.md) cobre as camadas, o que é emprestado e as
decisões que valem discussão.

## Licença

MIT.
