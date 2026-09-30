export function AppLogoMark({ className = "" }: { className?: string }) {
  return (
    <img
      className={`app-logo-mark ${className}`}
      src="/juntasorte-logo-cutout.png"
      alt=""
      aria-hidden="true"
    />
  );
}
