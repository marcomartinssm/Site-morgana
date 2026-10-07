# Morgana Pires Laser Removal — Sistema de gestão

Sistema web da clínica com **agenda**, **CRM de clientes**, **financeiro** e envio de
confirmações por **WhatsApp** (via webhook do n8n). Os dados ficam no **Supabase**.

É um site estático (HTML, CSS e JavaScript puros, sem etapa de build), publicado pelo
GitHub Pages a partir da branch `main`.

## Estrutura

```
index.html              Estrutura das telas e modais (sem estilos nem lógica embutidos)
css/
  base.css              Tokens de design (cores, raios, sombras), layout, botões, cards, formulários e modais
  agenda.css            Calendário, linha do tempo e modal de agendamento
  crm.css               Lista, kanban e ficha do cliente
  financeiro.css        KPIs, gráficos, lançamentos, centros de custo e formas de pagamento
  painel.css            Painel de métricas: KPIs, resultado em escada e gráfico de linhas
  responsive.css        Tablet (menu recolhido) e celular (barra de navegação inferior)
js/
  config.js             Chaves do Supabase e constantes (meses, estágios, procedimentos…)
  utils.js              Funções auxiliares: datas, formatação, localStorage e ícones SVG
  api.js                Leitura e gravação no Supabase (conversão banco ⇄ tela)
  agenda.js             Calendário, agendamentos do dia e modal de agendamento
  crm.js                Clientes: lista, kanban, ficha e procedimentos
  financeiro.js         Cálculos por período, gráficos e cadastros financeiros
  painel.js             Painel de métricas: resultado, agenda, clientes e qualidade dos dados
  whatsapp.js           Confirmação e mensagem de pós-atendimento pelo webhook do n8n
  configuracoes.js      Tela de configurações
  app.js                Navegação, carregamento dos dados, sincronização e inicialização
tools/
  importar_agenda.html  Ferramenta avulsa usada para importar a agenda do Google Calendar
```

Os scripts são carregados em ordem no final do `index.html` e compartilham variáveis
globais; o `app.js` vem por último porque inicializa a aplicação.

## Painel de métricas

Tela própria (menu "Painel"), com seletor de mês e cinco abas. Todos os números saem dos
dados carregados — `transacoes` para dinheiro, `agendamentos` para volume e `clientes` para
a base — e nenhum valor é fixo no código.

| Aba | O que mostra |
|-----|--------------|
| Visão geral | Receita, resultado da empresa, retiradas e sobra do mês, com atendimentos, ticket médio e clientes; gráfico das três linhas ao longo do ano |
| Resultado | Resultado em escada, receita e resultado por centro de custo, despesas por grupo, recebimentos por forma e pendências |
| Agenda | Concluídos, cancelados e reagendamentos; procedimento, dia da semana, faixa de horário e as automações de WhatsApp |
| Clientes | Funil do CRM, atendidos no período, receita por cliente, quem mais gerou receita e a lista de reativação |
| Qualidade dos dados | O quanto cada campo está preenchido — é o acompanhamento da virada para 2027 |

**Resultado em escada.** A tela separa o desempenho da empresa da destinação do lucro:

```
Receita da operação (Estética + Locações)
(−) Custos variáveis        = Margem de contribuição
(−) Despesas fixas          = Resultado operacional
(−) Financiamento da máquina = Resultado da empresa
(+) Aportes (−) Retiradas (−) Dízimo = Sobra do mês
```

As retiradas (centro de custo "Distribuição de lucros") e o dízimo ficam **abaixo da linha**:
são destinação do lucro, não custo de operar, e por isso não entram no resultado da empresa.
A separação entre pró-labore e distribuição de lucros está prevista para 2027, depois de um
ano de média medida.

Em que linha da escada cada despesa entra é decidido por `DRE_REGRAS`, em `js/config.js`:
a primeira regra cuja expressão casa com a descrição vale, e o que não casa vai para
"Outras despesas". Mudar a classificação é mexer só nessa lista.

**Limites conhecidos dos dados.** O financeiro é confiável desde janeiro de 2026. A agenda só
passou a ter cliente vinculado, valor e conclusão em setembro de 2026 — antes disso veio de
importação, sem cliente nem procedimento. Por isso as métricas de cliente e de ticket só
fecham a partir de setembro, e os 182 cadastros marcados como `Importado` ficam de fora da
contagem de novos clientes.

## Banco de dados (Supabase)

| Tabela             | Conteúdo                                   |
|--------------------|--------------------------------------------|
| `agendamentos`     | Agenda (um registro por horário); `reagendamentos` conta mudanças de dia/horário, `transacao_id` liga o atendimento concluído à sua receita, `pos_enviado_em` registra o pós-atendimento e `conf3d_enviada_em` a confirmação automática |
| `clientes`         | CRM, com procedimentos em `procedimentos`; duplicados mesclados ficam ocultos (`mesclado_em`) |
| `transacoes`       | Lançamentos financeiros; `data_br` é a competência (o Financeiro tem um seletor Competência/Caixa), `recebido` e `data_quitacao` controlam recebimento/pagamento (fluxo de caixa); cópias de importação ficam ocultas (`duplicado_de`); ids `plan26_…` vieram da planilha "Financeiro 2026" (abr–ago) |
| `centros_custo`    | Centros de custo                           |
| `formas_pagamento` | Formas de pagamento                        |
| `configuracoes`    | Configurações (ex.: URL do webhook do n8n) |

## WhatsApp (n8n)

O sistema não envia mensagens: ele chama o webhook do n8n (tela de Configurações) e o n8n envia.
São dois eventos, distinguidos pelo campo `event` do corpo da requisição:

| `event` | Quando | Campos próprios |
|---------|--------|-----------------|
| `whatsapp_confirmation` | Botão de confirmação no card do agendamento | — |
| `whatsapp_pos_atendimento` | Ao concluir o atendimento | `delayMinutes` (5) e `sendAt` (horário calculado para o envio) |

Há ainda uma **confirmação automática** que não sai do site: o fluxo "Confirmação 3 dias antes — Morgana",
no n8n, roda todo dia às 9h, lê a view `v_confirmacoes_3d` (agendamentos ativos de amanhã até 3 dias à
frente, com cliente vinculada e telefone, sem locação) e grava `agendamentos.conf3d_enviada_em` depois de
enviar, para não repetir.

No pós-atendimento o n8n deve **esperar** `delayMinutes` (nó Wait) antes de mandar a mensagem, que
já vem pronta no campo `message`. O texto fica em `MSG_POS_ATENDIMENTO`, em `js/config.js`.
O envio só acontece com webhook configurado, cliente vinculado com telefone e sem envio anterior
(`pos_enviado_em`).

## Nutrição (régua de 6 meses)

Quando o estágio de um cliente vira `nutricao`, um gatilho no banco cria a linha dele em
`nutricao_fila` (início hoje, ciclo de 6 meses). O fluxo "Nutrição — régua diária (Morgana)", no n8n,
roda às 10h, lê `v_nutricao_devidas` (no máximo 20 por dia, um envio a cada 30s) e chama
`nutricao_marcar_enviado(cliente_id, passo)` para avançar.

| Tabela / função | Papel |
|---|---|
| `nutricao_passos` | Catálogo dos 14 passos: 1 a 4 semanais (`dias_depois` 0, 7, 14, 21) e 5 a 14 periódicos. `mensagem` vazia = passo não envia |
| `nutricao_fila` | Uma linha por cliente: `proximo_passo`, `proximo_em`, `enviadas`, `interagiu_em`, `optout`, `encerra_em` |
| `v_nutricao_devidas` | O que vence hoje, já com nome, telefone e texto (`{nome}` é trocado no n8n) |
| `nutricao_marcar_enviado` | Avança o passo: +7 dias na fase semanal, +15 para quem interagiu e +30 para quem está em silêncio; encerra no passo 14 |

Regras: a régua para sozinha se o cliente sair de `nutricao` (virou ativo ou descartado), se `optout`
estiver marcado ou ao fim dos 6 meses. Um agendamento criado para quem está em nutrição conta como
interação (gatilho em `agendamentos`).

A agenda e o CRM são atualizados a cada 30 segundos para refletir mudanças feitas em
outros dispositivos.

## Rodando localmente

Na pasta do projeto:

```bash
python3 -m http.server 8000
```

e abra http://localhost:8000. Atenção: a versão local usa o **mesmo banco de produção**.
