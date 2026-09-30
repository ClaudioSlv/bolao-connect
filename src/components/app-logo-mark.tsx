export function AppLogoMark({ className = "" }: { className?: string }) {
  return (
    <img
      className={`app-logo-mark ${className}`}
      src="/juntasorte-logo-mark.jpg"
      alt=""
      aria-hidden="true"
    />
  );
}
