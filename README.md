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
  whatsapp.js           Envio de confirmação pelo webhook do n8n
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
| `agendamentos`     | Agenda (um registro por horário)           |
| `clientes`         | CRM, com procedimentos em `procedimentos`  |
| `transacoes`       | Lançamentos financeiros                    |
| `centros_custo`    | Centros de custo                           |
| `formas_pagamento` | Formas de pagamento                        |
| `configuracoes`    | Configurações (ex.: URL do webhook do n8n) |

A agenda e o CRM são atualizados a cada 30 segundos para refletir mudanças feitas em
outros dispositivos.

## Rodando localmente

Na pasta do projeto:

```bash
python3 -m http.server 8000
```

e abra http://localhost:8000. Atenção: a versão local usa o **mesmo banco de produção**.
