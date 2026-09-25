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
  responsive.css        Tablet (menu recolhido) e celular (barra de navegação inferior)
js/
  config.js             Chaves do Supabase e constantes (meses, estágios, procedimentos…)
  utils.js              Funções auxiliares: datas, formatação, localStorage e ícones SVG
  api.js                Leitura e gravação no Supabase (conversão banco ⇄ tela)
  agenda.js             Calendário, agendamentos do dia e modal de agendamento
  crm.js                Clientes: lista, kanban, ficha e procedimentos
  financeiro.js         Cálculos por período, gráficos e cadastros financeiros
  whatsapp.js           Confirmação e mensagem de pós-atendimento pelo webhook do n8n
  configuracoes.js      Tela de configurações
  app.js                Navegação, carregamento dos dados, sincronização e inicialização
tools/
  importar_agenda.html  Ferramenta avulsa usada para importar a agenda do Google Calendar
```

Os scripts são carregados em ordem no final do `index.html` e compartilham variáveis
globais; o `app.js` vem por último porque inicializa a aplicação.

## Banco de dados (Supabase)

| Tabela             | Conteúdo                                   |
|--------------------|--------------------------------------------|
| `agendamentos`     | Agenda (um registro por horário); `reagendamentos` conta mudanças de dia/horário, `transacao_id` liga o atendimento concluído à sua receita e `pos_enviado_em` registra o envio da mensagem de pós-atendimento |
| `clientes`         | CRM, com procedimentos em `procedimentos`; duplicados mesclados ficam ocultos (`mesclado_em`) |
| `transacoes`       | Lançamentos financeiros; `data_br` é a competência, `recebido` e `data_quitacao` controlam recebimento/pagamento (fluxo de caixa); cópias de importação ficam ocultas (`duplicado_de`); ids `plan26_…` vieram da planilha "Financeiro 2026" (abr–ago) |
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

No pós-atendimento o n8n deve **esperar** `delayMinutes` (nó Wait) antes de mandar a mensagem, que
já vem pronta no campo `message`. O texto fica em `MSG_POS_ATENDIMENTO`, em `js/config.js`.
O envio só acontece com webhook configurado, cliente vinculado com telefone e sem envio anterior
(`pos_enviado_em`).

A agenda e o CRM são atualizados a cada 30 segundos para refletir mudanças feitas em
outros dispositivos.

## Rodando localmente

Na pasta do projeto:

```bash
python3 -m http.server 8000
```

e abra http://localhost:8000. Atenção: a versão local usa o **mesmo banco de produção**.
