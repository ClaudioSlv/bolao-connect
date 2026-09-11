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
      <path d="M15 14h58v68H15z" rx="4" fill="#f7f5e8" stroke="#d4a81e" strokeWidth="3" />
      <path d="M15 14h58v17H15z" fill="#168249" />
      <path d="M25 22h38" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      {[0,1,2,3].map(row => [0,1,2,3].map(col => (
        <circle key={`${row}-${col}`} cx={26 + col * 12} cy={42 + row * 10} r="3.5" fill="#f6c734" stroke="#a87500" />
      )))}
      <path d="M67 73 80 42l7 3-13 31-8 5z" fill="#e3a129" stroke="#6d390d" strokeWidth="2" />
      <path d="m80 42 3-7 7 3-3 7z" fill="#181818" />
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
      href: `/bolao/${poolSlug}`,
      label: "VOLTAR AO BOLÃO",
      icon: HomeIcon,
      aria: "Voltar para o bolão",
    },
  ];

  return (
    <nav className="participant-actions" aria-label="Área do participante">
      {actions.map(({ href, label, icon: Icon, aria }) => (
        <Link className="participant-action-card" href={href} aria-label={aria} key={label}>
          <Icon className="participant-action-icon" />
          <strong>{label}</strong>
        </Link>
      ))}
    </nav>
  );
}
