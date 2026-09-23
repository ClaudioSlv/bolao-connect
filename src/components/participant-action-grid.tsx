import Link from "next/link";

type IconProps = { className?: string };

function TicketIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 96 96" aria-hidden="true">
      <defs>
        <linearGradient id="ticketPaper" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fffdf2" />
          <stop offset="1" stopColor="#dbe9dc" />
        </linearGradient>
      </defs>
      <g transform="rotate(-8 48 48)">
        <path d="M18 20h60v56H18z" fill="url(#ticketPaper)" stroke="#d5a91c" strokeWidth="3" />
        <path d="M18 20h60v15H18z" fill="#18834b" />
        <circle cx="28" cy="27.5" r="4" fill="#f7c934" />
        <path d="M37 27.5h31" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
        {[0,1,2].map(row => [0,1,2,3,4].map(col => (
          <circle key={`${row}-${col}`} cx={28 + col * 10} cy={46 + row * 10} r="3.2" fill="#f4c431" stroke="#9b7412" />
        )))}
      </g>
      <path d="M24 18h56v55" fill="none" stroke="#f0cb4b" strokeWidth="3" opacity=".55" />
    </svg>
  );
}

function WalletIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 96 96" aria-hidden="true">
      <defs>
        <linearGradient id="walletLeather" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#d89036" />
          <stop offset="1" stopColor="#7c3c13" />
        </linearGradient>
        <linearGradient id="coinGold" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fff09a" />
          <stop offset=".45" stopColor="#f6bf22" />
          <stop offset="1" stopColor="#a76500" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="25" r="13" fill="url(#coinGold)" stroke="#fff0a3" strokeWidth="2" />
      <circle cx="75" cy="37" r="12" fill="url(#coinGold)" stroke="#fff0a3" strokeWidth="2" />
      <text x="60" y="30" textAnchor="middle" fontSize="13" fontWeight="800" fill="#8a5500">R$</text>
      <path d="M16 34c0-7 6-12 13-12h30c8 0 13 5 13 12v6H30c-5 0-9 4-9 9s4 9 9 9h42v8c0 7-5 12-13 12H28c-7 0-12-5-12-12z" fill="url(#walletLeather)" stroke="#f1b95d" strokeWidth="3" />
      <path d="M49 42h31v19H49c-5 0-9-4-9-9v-1c0-5 4-9 9-9z" fill="#9b511f" stroke="#f2bd65" strokeWidth="3" />
      <circle cx="68" cy="51.5" r="4" fill="#f8cf4d" />
    </svg>
  );
}

function GameIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 96 96" aria-hidden="true">
      <defs>
        <radialGradient id="gameGlobe" cx="35%" cy="24%" r="76%">
          <stop stopColor="#3c8f64" stopOpacity=".72" />
          <stop offset=".62" stopColor="#123d27" stopOpacity=".9" />
          <stop offset="1" stopColor="#06170e" />
        </radialGradient>
        <linearGradient id="gameGold" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fff19a" />
          <stop offset=".48" stopColor="#f6c52f" />
          <stop offset="1" stopColor="#9d6500" />
        </linearGradient>
      </defs>
      <circle cx="48" cy="41" r="30" fill="url(#gameGlobe)" stroke="#f6cf4a" strokeWidth="4" />
      <path d="M23 24c12 7 38 7 50 0M20 42c14 7 42 7 56 0M27 60c11-5 31-5 42 0" fill="none" stroke="#dff9e7" strokeWidth="1.6" opacity=".46" />
      <ellipse cx="48" cy="41" rx="14" ry="30" fill="none" stroke="#dff9e7" strokeWidth="1.6" opacity=".42" />
      {[
        [34, 31, "01"], [52, 27, "07"], [64, 39, "13"],
        [42, 43, "21"], [29, 49, "32"], [55, 53, "45"],
      ].map(([cx, cy, number]) => (
        <g key={String(number)}>
          <circle cx={cx} cy={cy} r="7.2" fill="url(#gameGold)" stroke="#fff4ad" strokeWidth="1.5" />
          <text x={cx} y={Number(cy) + 2.5} textAnchor="middle" fontSize="6.5" fontWeight="900" fill="#17311f">{number}</text>
        </g>
      ))}
      <path d="M34 70h28l5 13H29z" fill="#147340" stroke="#61ef8d" strokeWidth="2.5" />
      <path d="M25 84h46" stroke="#f6cf4a" strokeWidth="5" strokeLinecap="round" />
      <path d="M18 41h-6M84 41h-6" stroke="#f6cf4a" strokeWidth="4" strokeLinecap="round" />
      <circle cx="12" cy="41" r="3.5" fill="#f6c52f" />
      <circle cx="84" cy="41" r="3.5" fill="#f6c52f" />
    </svg>
  );
}

function CheckGameIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 96 96" aria-hidden="true">
      <path d="M15 14h53v67H15z" fill="#f7f5e8" stroke="#d4a81e" strokeWidth="3" />
      <path d="M15 14h53v16H15z" fill="#168249" />
      {[0,1,2].map(row => [0,1,2,3].map(col => (
        <circle key={`${row}-${col}`} cx={25 + col * 11} cy={42 + row * 11} r="3.2" fill="#f6c734" stroke="#a87500" />
      )))}
      <circle cx="68" cy="65" r="17" fill="#113b25" stroke="#55ef7a" strokeWidth="4" />
      <path d="m58 65 7 7 13-16" fill="none" stroke="#55ef7a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HomeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 96 96" aria-hidden="true">
      <path d="M18 45 48 17l30 28v34H18z" fill="#f7ead0" stroke="#d8b061" strokeWidth="3" />
      <path d="m10 47 38-36 38 36-8 8-30-28-30 28z" fill="#e35f35" stroke="#8d2d18" strokeWidth="3" />
      <path d="M39 53h18v26H39z" fill="#9c5b27" stroke="#643412" strokeWidth="2" />
      <path d="M24 51h10v11H24zm38 0h10v11H62z" fill="#ffe36d" stroke="#bb7b16" strokeWidth="2" />
      <circle cx="52" cy="66" r="1.8" fill="#f6cb45" />
    </svg>
  );
}

export function ParticipantActionGrid({
  token,
  poolSlug,
}: {
  token: string;
  poolSlug: string;
}) {
  const actions = [
    {
      href: `/p/${token}/comprovantes`,
      label: "BILHETES DO BOLÃO",
      icon: TicketIcon,
      aria: "Ver bilhetes do bolão",
    },
    {
      href: `/p/${token}/resultado-bolao`,
      label: "RESULTADO DO BOLÃO",
      icon: CheckGameIcon,
      aria: "Ver resultado conferido do bolão",
    },
    {
      href: `/p/${token}/carteira`,
      label: "MINHA CARTEIRA",
      icon: WalletIcon,
      aria: "Abrir minha carteira",
    },
    {
      href: `/meu-jogo?voltar=${encodeURIComponent(`/p/${token}`)}`,
      label: "CRIAR MEU JOGO",
      icon: GameIcon,
      aria: "Criar meu jogo individual",
    },
    {
      href: `/meus-jogos-salvos?voltar=${encodeURIComponent(`/p/${token}`)}`,
      label: "CONFERIR MEUS JOGOS",
      icon: CheckGameIcon,
      aria: "Conferir automaticamente meus jogos salvos",
    },
    {
      href: `/bolao/${poolSlug}`,
      label: "VOLTAR AO BOLÃO",
      icon: HomeIcon,
      aria: "Voltar para o bolão",
    },
  ];

  return (
    <nav className="participant-actions" aria-label="Área do participante">
      {actions.map(({ href, label, icon: Icon, aria }) => (
        <Link className="participant-action-card" href={href} aria-label={aria} key={label} prefetch={false}>
          <Icon className="participant-action-icon" />
          <strong>{label}</strong>
        </Link>
      ))}
    </nav>
  );
}
