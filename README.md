# Bolão Connect

Aplicativo independente para organização e gestão transparente de bolões.

Base inicial do projeto Bolão Connect.

## Pagamentos InfinitePay

1. Aplique a migration `supabase/migrations/0020_infinitepay_participant_checkout.sql`.
2. Configure `INFINITEPAY_HANDLE` na Vercel com a InfiniteTag, sem o caractere `$`.
3. Habilite o Checkout Integrado na conta InfinitePay.

Cada cobrança usa um `order_nsu` exclusivo ligado ao participante. O webhook
`/api/webhooks/infinitepay` confirma o valor diretamente na InfinitePay antes de
atualizar a cota, a carteira, os créditos e enviar a notificação de pagamento.
