# Arquitetura inicial — Bolão Connect

## 1. Multi-loterias
`src/lib/lotteries/rules.ts` centraliza as modalidades suportadas. Cada modalidade poderá receber um adaptador próprio para regras especiais.

## 2. Resultados e conferência
`LotteryResultProvider` desacopla o app da fonte externa de resultados. `checker.ts` fornece o núcleo simples e marca modalidades ainda não implementadas por completo como `manual_validation_required`.

A interface do usuário deve tratar qualquer detecção como **possível premiação** até a validação oficial.

## 3. Carteira do Bolão
A carteira é um controle transparente da arrecadação do grupo, não uma conta de custódia. Participantes autorizados podem ver resumo financeiro; dados privados de outros participantes e comprovantes não devem ser expostos.

Toda confirmação, cancelamento ou ajuste financeiro deve gerar movimento e auditoria. A atualização transacional será adicionada em migração/RPC específica.

## 4. Supabase
A primeira migração cria perfis, bolões, participantes, pagamentos, carteira, jogos, resultados, conferências, preferências de lembrete e auditoria. RLS é habilitado desde a fundação.

## Próximos passos técnicos
- completar RLS e views financeiras seguras;
- criar RPC/trigger transacional pagamento → carteira;
- armazenamento privado de comprovantes;
- adaptadores completos de conferência por modalidade;
- integração com fonte autorizada/estável de resultados;
- telas Criar Bolão, Carteira, Jogos e Conferência;
- compartilhamento WhatsApp/Telegram;
- Web Push com consentimento explícito.
