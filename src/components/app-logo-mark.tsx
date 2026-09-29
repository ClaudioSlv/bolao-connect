export function AppLogoMark({ className = "" }: { className?: string }) {
  return (
    <span className={`app-logo-mark ${className}`} aria-hidden="true">
      <img src="/juntasorte-logo-mark.jpg" alt="" />
    </span>
  );
}
