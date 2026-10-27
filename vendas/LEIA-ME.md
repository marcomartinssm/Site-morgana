# Página de vendas — rascunho para aprovação

Página estática (HTML, CSS e JS puros, sem build), servida pelo GitHub Pages em
`/vendas/`. É um **rascunho**: está com `noindex` para não aparecer no Google antes
de a Morgana aprovar. Ao publicar de verdade, remover a linha `<meta name="robots">`
do `index.html`.

O botão flutuante **"Revisão"** liga e desliga as marcações do que ainda falta.
Desligado, a página aparece como a cliente vai ver.

## De onde vem cada número

Nenhum dado da página foi inventado. Tudo abaixo é verificável:

| Afirmação na página | Fonte |
|---|---|
| 4,9 de 5 em 70 avaliações | Perfil público no Google (Morgana Pires \| Remoção a Laser) |
| Os três depoimentos e as três frases curtas | Avaliações públicas no mesmo perfil, com o nome como aparece lá |
| Mais de 1.000 atendimentos desde janeiro de 2025 | `agendamentos` do sistema: status concluído ou confirmado, já passados, sem locação |
| Mais de 450 clientes atendidas | Mesma consulta, pessoas distintas |
| Endereço e telefone | Perfil do Google |
| "Remova aquilo que não faz mais sentido para você" | Frase da própria Morgana, da bio do Instagram |
| Lembrete 3 dias antes, orientação pós-sessão e histórico registrado | Fluxos que já rodam no sistema (n8n + CRM) |

A explicação de como o laser funciona é geral e conservadora: fala de fragmentação do
pigmento e eliminação pelo sistema linfático, sem prometer resultado, número de sessões
ou ausência de risco.

## O que falta antes de publicar

1. **Fotos.** Nenhuma foto real na página. Os quadros tracejados dizem exatamente que
   foto entra em cada lugar e em que proporção.
2. **Formação, certificações e registro profissional** da Morgana, com o nome exato.
   No Google ela aparece como "Esteticista" — a página não afirma nenhuma formação
   que não tenha sido confirmada por ela.
3. **Marca e modelo do equipamento**, e por que foi escolhido.
4. **Antes e depois** com autorização por escrito de cada cliente.
5. **Preço**: decidir se a página mostra faixa de valores ou não.
6. **Horário de atendimento** e, se houver, as **cidades do atendimento itinerante**.
7. **Recursos de conforto** durante a sessão (anestésico, resfriamento), para a
   resposta da pergunta "dói?".

## Depois de aprovada

- Trocar o `wa.me` por um número com rastreio, ou manter e marcar a origem na mensagem
  (hoje a mensagem já chega escrita: "Vim pelo site").
- Domínio próprio apontando para cá, em vez do endereço do GitHub Pages.
- Pixel do Meta e Google Analytics, se for rodar anúncio.
- Trocar os depoimentos fixos pelo widget do Google, que atualiza sozinho.
