Avaliação: GitHub Actions com IA

Dupla: Vitória Faranhas Braga, Victor Gabriel Kovalski de Barros Repositório: https://github.com/chapezx/2bim-Avalia1 Site: https://2bim-avalia1-desenho-assinado.pages.dev

Preparação

O site não tinha banco D1. Criamos o banco desenho-db, o wrangler.toml com o binding DB e a migração migrations/0001_cria_notas.sql, aplicada no remoto com wrangler d1 migrations apply. Os segredos COPILOT_PAT, CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID foram cadastrados em Settings > Secrets and variables > Actions.

Tarefa 1: CI a cada commit
Execução verde: https://github.com/chapezx/2bim-Avalia1/actions/runs/38181384750
Execução vermelha: https://github.com/chapezx/2bim-Avalia1/actions/runs/38181480974
Linha do log com o erro (step "Aplica as migrações D1 em um SQLite local"):
  Parse error near line 1: near ",": syntax error
    CREATE TABLE x (id INTEGER PRIMARY KEY,, nome TEXT);
                                          ^--- error here
  Error: Process completed with exit code 1.
Por que testar em SQLite antes do D1: o D1 usa o motor do SQLite, então um erro de sintaxe aparece numa VM descartável do CI, antes de a migração chegar ao banco de produção e deixá-lo num estado quebrado.

Observação: o padrão do git grep do esqueleto contém o texto GOCSPX-, então o próprio ci.yml era acusado como segredo. Excluímos o arquivo da busca com ':!.github/workflows/ci.yml'.

Tarefa 2: proteger a main com o CI

Ruleset protege-main (ativo, sem bypass, alvo: branch padrão) exigindo pull request (0 aprovações) e o status check verificar.

PR bloqueado e depois liberado: https://github.com/chapezx/2bim-Avalia1/pull/1
Com o erro: os dois checks ci / verificar vermelhos e o botão de merge desabilitado.
Depois da correção na mesma ramificação: "All checks have passed" e merge liberado.
Saída do git push direto na main:
  remote: error: GH013: Repository rule violations found for refs/heads/main.
  remote: - Changes must be made through a pull request.
  remote: - Required status check "verificar" is expected.
   ! [remote rejected] main -> main (push declined due to repository rule violations)
  error: failed to push some refs to 'https://github.com/chapezx/2bim-Avalia1.git'
Tarefa 3: revisão de PR por IA
PR com os comentários da IA: https://github.com/chapezx/2bim-Avalia1/pull/2
Primeiro comentário (SQL com '${nome}'): a IA apontou StringInjection de severidade alta em functions/api/notas.js:3, com o exemplo ' OR 1=1 --, e sugeriu prepare("... WHERE aluno = ?").bind(nome).
Segundo comentário (após a correção, evento synchronize): a IA confirmou que a consulta passou a usar prepare().bind() e trouxe um achado novo, a falta de autenticação no endpoint.
Log do erro de permissão (sem pull-requests: write, commit b5bcf3c): https://github.com/chapezx/2bim-Avalia1/actions/runs/38183840663/job/114601855730#step:7:57
  GraphQL: Resource not accessible by integration (addComment)
  Error: Process completed with exit code 1.

Explicação: quando o workflow declara permissions, todo escopo não listado fica sem acesso. Sem pull-requests: write, o GITHUB_TOKEN ficou só com contents: read e o gh pr comment foi recusado.

Crítica à IA (item 4): na terceira revisão, a IA afirmou que head -c 20000 poderia fazer a etapa "Monta o prompt" falhar "com pipefail" em diffs grandes. A afirmação está errada para este workflow: o step não declara shell:, e nesse caso o GitHub Actions executa bash -e, sem -o pipefail, como mostra o próprio log de depuração (/usr/bin/bash -e /home/runner/work/_temp/...sh). Sem pipefail, o código de saída do pipe é o do head, que termina com sucesso. A IA aplicou uma regra genérica sem verificar a configuração real. Além disso, em todas as revisões ela ofereceu "corrigir" e "fazer commit", algo impossível num workflow com contents: read que roda uma vez por evento, e respondeu parte do texto em inglês, apesar de o prompt pedir português.

Observações sobre a ação de IA: com actions/ai-inference@v1, o step falhava com Cannot use 'in' operator to search for 'choices' in OK, porque a v1 ainda chama o GitHub Models, serviço desativado em 30/07/2026. Trocamos para @v3, que usa o Copilot CLI. Em seguida, o log de depuração mostrou Model "gpt-4.1" from --model flag is not available: no Copilot Free só existe a seleção automática de modelo, então acrescentamos model: auto.

Tarefa 4: migrações D1 depois do merge
PR da migração 0002_adiciona_coluna.sql (passou pelo CI e pela revisão da IA): https://github.com/chapezx/2bim-Avalia1/pull/3
Execução do migrar após o merge: https://github.com/chapezx/2bim-Avalia1/actions/runs/38184396985 A primeira tentativa falhou porque os segredos CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID não tinham sido cadastrados; depois de criá-los, a execução foi refeita com "Re-run all jobs" e aplicou a migração.
Saída do PRAGMA:
  npx wrangler d1 execute desenho-db --remote --command "PRAGMA table_info(notas)"

  cid | name       | type    | notnull | dflt_value | pk
  0   | id         | INTEGER | 0       | null       | 1
  1   | aluno      | TEXT    | 1       | null       | 0
  2   | nota       | REAL    | 0       | null       | 0
  3   | observacao | TEXT    | 0       | null       | 0
Merge sem migrations/: https://github.com/chapezx/2bim-Avalia1/pull/4. O push na main gerado por esse merge disparou apenas o ci (#29); a lista do workflow migrar continua com uma única execução: https://github.com/chapezx/2bim-Avalia1/actions/workflows/migrar.yml
Bônus: a mesma execução do migrar mostra no Summary o quadro "Migrações aplicadas (resumo por IA)", gerado com actions/ai-inference e escrito em $GITHUB_STEP_SUMMARY.
Perguntas

1. Um push numa ramificação com PR aberto gera dois eventos: push, que testa o commit da ramificação, e pull_request (synchronize), que testa o commit de merge refs/pull/N/merge, ou seja, a ramificação já combinada com a main. Como os dois jobs se chamam verificar, no PR eles apareceram como ci / verificar (push) e ci / verificar (pull_request), ambos marcados como Required, e o merge só foi liberado com os dois verdes. A execução que representa o que de fato entra na main é a do pull_request.

2. Num PR vindo de fork, o código executado (inclusive o próprio workflow e os scripts) é escrito por alguém de fora, então o GitHub não entrega os segredos do repositório de destino a essa execução e dá ao GITHUB_TOKEN só leitura. Isso impede que um atacante abra um PR alterando o workflow para imprimir o COPILOT_PAT ou enviá-lo para um servidor dele (exfiltração de segredos).

3. Por menor privilégio: o workflow só precisa ler o código e comentar no PR, então declara apenas contents: read e pull-requests: write, e todo o resto fica sem acesso. Se uma ação de terceiros for comprometida ou um conteúdo malicioso no diff manipular a execução (prompt injection), o estrago possível com o token fica limitado. O teste do item 3 mostrou o efeito: sem pull-requests: write, o comentário foi recusado.

4. Não. A resposta da IA não é determinística: com código quase igual, cada revisão trouxe achados e formatos diferentes, e no item 4 ela fez uma afirmação errada sobre pipefail e ignorou a instrução de responder em português. Além disso, ela só comenta, não aprova nem bloqueia, e o revisar nem é um check exigido. O status check verificar é um teste determinístico, dá sempre o mesmo resultado para o mesmo código e é imposto pela regra da main; a IA serve como apoio à revisão, não como porteiro.