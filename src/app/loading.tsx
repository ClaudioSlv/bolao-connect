import Image from "next/image";

export default function Loading() {
  return (
    <main
      aria-live="polite"
      aria-busy="true"
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at 50% 35%, #123d2b 0%, #071b14 42%, #030b08 100%)",
        padding: "24px",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "420px",
          minHeight: "70dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <Image
          src="/juntasorte-logo-transparent.png"
          alt="JuntaSorte"
          width={190}
          height={190}
          priority
          style={{
            width: "min(86vw, 360px)",
            height: "auto",
            objectFit: "contain",
            filter: "drop-shadow(0 14px 28px rgba(0,0,0,.38))",
          }}
        />

        <h1
          style={{
            margin: "10px 0 4px",
            fontSize: "clamp(2rem, 10vw, 3rem)",
            lineHeight: 1,
            letterSpacing: "-0.04em",
            color: "#f7f7f2",
          }}
        >
          Junta<span style={{ color: "#f5c84b" }}>Sorte</span>
        </h1>

        <p
          style={{
            margin: "10px 0 30px",
            color: "rgba(255,255,255,.72)",
            fontSize: ".9rem",
            letterSpacing: ".12em",
            textTransform: "uppercase",
          }}
        >
          Bolão entre amigos
        </p>

        <div
          role="status"
          aria-label="Carregando JuntaSorte"
          style={{
            width: "min(64vw, 250px)",
            height: "5px",
            overflow: "hidden",
            borderRadius: "999px",
            background: "rgba(255,255,255,.13)",
          }}
        >
          <div
            className="juntasorte-splash-progress"
            style={{
              width: "48%",
              height: "100%",
              borderRadius: "999px",
              background: "#18d86b",
            }}
          />
        </div>

        <span
          style={{
            marginTop: "12px",
            color: "rgba(255,255,255,.7)",
            fontSize: ".85rem",
          }}
        >
          Carregando...
        </span>

        <style>{`
          @keyframes juntasorteSplashProgress {
            0% { transform: translateX(-115%); }
            50% { transform: translateX(110%); }
            100% { transform: translateX(215%); }
          }
          .juntasorte-splash-progress {
            animation: juntasorteSplashProgress 1.35s ease-in-out infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .juntasorte-splash-progress { animation: none; width: 100% !important; }
          }
        `}</style>
      </section>
    </main>
  );
}
