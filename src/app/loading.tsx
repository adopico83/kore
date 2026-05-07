export default function Loading() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        backgroundColor: "#090b10",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <style>{`
        @keyframes koreBreath {
          0% {
            transform: scale(0.95);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.02);
            opacity: 1;
          }
          100% {
            transform: scale(0.95);
            opacity: 0.6;
          }
        }
      `}</style>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          animation: "koreBreath 2.5s ease-in-out infinite",
          transformOrigin: "center",
          willChange: "transform, opacity",
        }}
      >
        <svg width="220" height="220" viewBox="0 0 160 160" fill="none" aria-hidden>
          <circle cx="62" cy="80" r="44" stroke="#4CC9A0" strokeWidth="1.8" fill="none" />
          <circle cx="98" cy="80" r="44" stroke="#9B8FE8" strokeWidth="1.8" fill="none" />
          <circle cx="82" cy="80" r="5" fill="white" opacity="0.95" />
        </svg>

        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-dm-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 12,
            letterSpacing: "0.12em",
            textTransform: "lowercase",
            color: "rgba(255,255,255,0.3)",
          }}
        >
          sincronizando hogar...
        </p>
      </div>
    </main>
  );
}
