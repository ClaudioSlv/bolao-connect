import type {ReactNode} from "react";

type IconName="identity"|"wallet"|"ticket"|"check"|"users"|"generator"|"archive"|"timer";
const paths:Record<IconName,ReactNode>={
  identity:<><circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></>,
  wallet:<><path d="M4 7h14a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V7a3 3 0 0 1 3-3h12"/><path d="M16 12h6v4h-6a2 2 0 0 1 0-4Z"/></>,
  ticket:<><path d="M3 9a3 3 0 0 0 0 6l-1 3 17 4 1-3a3 3 0 0 0 1-6l1-3L5 6 4 9Z"/><path d="m9 10 6 1.5M8 14l6 1.5"/></>,
  check:<><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
  users:<><circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 16a5 5 0 0 1 7 4"/></>,
  generator:<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M6.5 6.5h.01M17.5 6.5h.01M6.5 17.5h.01M17.5 17.5h.01"/></>,
  archive:<><path d="M3 7h18v13H3z"/><path d="M2 4h20v4H2zM9 12h6"/></>,
  timer:<><circle cx="12" cy="13" r="9"/><path d="M12 8v5l3 2M9 2h6"/></>
};
export function DashboardIcon({name}:{name:IconName}){return <span className="dashboard-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg></span>}
