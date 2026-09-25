/* ==========================================================================
   Configuração e constantes globais
   ========================================================================== */

// Supabase — chave pública "anon" (o acesso é controlado pelas políticas RLS)
const SUPA_URL = 'https://tvqbftidjhytnadyayoo.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2cWJmdGlkamh5dG5hZHlheW9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTM0MTMsImV4cCI6MjA5MTA2OTQxM30.THkQ8mViDJaT4UEzLafU1yk0ag8KwLBM5uBF-aWgYG0';

// Intervalo de sincronização com outros dispositivos
const POLLING_MS = 30000;

// Financeiro
const ANO_BASE = 2026;
const SALDO_INICIAL = 28537.50;

// Calendário
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WDAYS_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Estágios do funil do CRM
const STAGES = [
  { id: 'novo_lead',          label: 'Novo lead',     color: '#7c9cbf', bg: '#edf2f8' },
  { id: 'nutricao',           label: 'Nutrição',      color: '#c9a035', bg: '#fdf4e3' },
  { id: 'cliente_ativo',      label: 'Cliente ativo', color: '#4a9068', bg: '#eaf5ee' },
  { id: 'cliente_finalizado', label: 'Finalizado',    color: '#6b4fa0', bg: '#f0eafe' },
  { id: 'descartado',         label: 'Descartado',    color: '#999',    bg: '#f5f5f5' },
];

// Procedimentos: nome completo (CRM) e rótulo curto (gravado no agendamento)
const PROC_LABELS = {
  avaliacao: 'Avaliação',
  micropigmentacao: 'Remoção de micropigmentação',
  tatuagem: 'Remoção de tatuagem',
  microagulhamento: 'Microagulhamento',
  locacao: 'Locação',
};
const SVC_SHORT_LABELS = {
  avaliacao: 'Avaliação',
  micropigmentacao: 'Remoção micropig.',
  tatuagem: 'Remoção tatuagem',
  microagulhamento: 'Microagulhamento',
  locacao: 'Locação',
};
// Procedimentos que contam sessões na ficha do cliente
const PROCS_COM_SESSAO = ['micropigmentacao', 'tatuagem', 'microagulhamento'];

// Mensagem de pós-atendimento (WhatsApp) enviada ao concluir um atendimento.
// O envio sai pelo n8n, que espera POS_ATENDIMENTO_DELAY_MIN antes de mandar.
const POS_ATENDIMENTO_DELAY_MIN = 5;
const MSG_POS_ATENDIMENTO = `Oi {nome} 🤍
Quero te agradecer por ter confiado em mim e no meu trabalho hoje.
Foi um prazer te atender ✨

Para que você tenha o melhor resultado possível e uma boa recuperação da pele, seguem alguns cuidados importantes no pós-atendimento:

✔️ Evite exposição ao sol na região tratada.
✔️ Não utilize produtos ou cosméticos no local sem orientação.
✔️ Beba muita água.
✔️ Mantenha a pele limpa e observe a evolução nos próximos dias.

Esses cuidados fazem parte da experiência do meu atendimento e ajudam a garantir uma recuperação tranquila e segura 🤍

Qualquer dúvida ou se notar algo diferente, pode me chamar aqui sem receio.
Estarei acompanhando sua evolução ✨`;

const AVATAR_CLASSES = ['av-rose', 'av-gold', 'av-green', 'av-purple'];
