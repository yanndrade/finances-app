import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { ReactNode } from "react";

export function Stage({
  children,
  accent = "#0f5ea8",
}: {
  children: ReactNode;
  accent?: string;
}) {
  return (
    <AbsoluteFill
      style={{
        background: [
          "radial-gradient(circle at 12% 18%, rgba(29, 111, 191, 0.24), transparent 26%)",
          "radial-gradient(circle at 82% 16%, rgba(15, 94, 168, 0.22), transparent 24%)",
          "radial-gradient(circle at 50% 100%, rgba(255, 255, 255, 0.65), transparent 48%)",
          "linear-gradient(145deg, #eef5fb 0%, #f7fbff 44%, #e7eff8 100%)",
        ].join(", "),
        color: "#123250",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 24,
          borderRadius: 40,
          border: "1px solid rgba(15, 94, 168, 0.12)",
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,0.55), 0 40px 120px rgba(15, 40, 70, 0.08)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(18, 50, 80, 0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(18, 50, 80, 0.035) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          opacity: 0.4,
          maskImage:
            "linear-gradient(to bottom, transparent, rgba(0,0,0,0.8) 20%, rgba(0,0,0,0.8) 80%, transparent)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 72,
          top: 62,
          width: 180,
          height: 180,
          borderRadius: 999,
          background: `${accent}14`,
          filter: "blur(8px)",
        }}
      />
      {children}
    </AbsoluteFill>
  );
}

export function SceneCopy({
  kicker,
  title,
  caption,
  align = "left",
}: {
  kicker: string;
  title: string;
  caption: string;
  align?: "left" | "center";
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = spring({
    fps,
    frame,
    config: {
      damping: 200,
      stiffness: 180,
    },
  });
  const translateY = interpolate(opacity, [0, 1], [24, 0]);

  return (
    <div
      style={{
        position: "absolute",
        top: align === "center" ? 94 : 78,
        left: align === "center" ? 140 : 96,
        right: align === "center" ? 140 : undefined,
        width: align === "center" ? undefined : 560,
        textAlign: align,
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          borderRadius: 999,
          backgroundColor: "rgba(15, 94, 168, 0.08)",
          border: "1px solid rgba(15, 94, 168, 0.16)",
          padding: "10px 18px",
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "#0f5ea8",
        }}
      >
        {kicker}
      </div>
      <h1
        style={{
          margin: "20px 0 14px",
          fontSize: align === "center" ? 72 : 64,
          lineHeight: 1,
          letterSpacing: "-0.04em",
          fontWeight: 900,
          color: "#17324c",
        }}
      >
        {title}
      </h1>
      <p
        style={{
          margin: 0,
          fontSize: 28,
          lineHeight: 1.45,
          color: "#58708a",
        }}
      >
        {caption}
      </p>
    </div>
  );
}

export function BottomCaption({ text }: { text: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({
    fps,
    frame: frame - 12,
    config: {
      damping: 180,
      stiffness: 200,
    },
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 96,
        right: 96,
        bottom: 56,
        display: "flex",
        justifyContent: "center",
        opacity: entrance,
        transform: `translateY(${interpolate(entrance, [0, 1], [16, 0])}px)`,
      }}
    >
      <div
        style={{
          maxWidth: 1320,
          borderRadius: 28,
          background: "rgba(255,255,255,0.78)",
          border: "1px solid rgba(255,255,255,0.75)",
          boxShadow: "0 20px 50px rgba(20, 42, 68, 0.12)",
          padding: "22px 30px",
          fontSize: 24,
          lineHeight: 1.45,
          color: "#26425d",
          backdropFilter: "blur(12px)",
        }}
      >
        {text}
      </div>
    </div>
  );
}

export function WindowFrame({
  children,
  title,
  subtitle,
  x,
  y,
  width,
  height,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        borderRadius: 34,
        overflow: "hidden",
        background: "rgba(247, 251, 255, 0.82)",
        border: "1px solid rgba(255,255,255,0.92)",
        boxShadow: "0 28px 80px rgba(18, 42, 70, 0.12)",
      }}
    >
      <div
        style={{
          height: 74,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(237,245,252,0.8))",
          borderBottom: "1px solid rgba(15, 94, 168, 0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((color) => (
            <div
              key={color}
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                backgroundColor: color,
              }}
            />
          ))}
        </div>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#17324c",
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                marginTop: 2,
                fontSize: 16,
                color: "#6b839d",
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
        <div style={{ width: 58 }} />
      </div>
      <div style={{ position: "relative", width: "100%", height: height - 74 }}>
        {children}
      </div>
    </div>
  );
}

export function GlassCard({
  children,
  x,
  y,
  width,
  height,
  background = "rgba(255,255,255,0.84)",
}: {
  children: ReactNode;
  x: number;
  y: number;
  width: number;
  height: number;
  background?: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        borderRadius: 28,
        padding: 24,
        background,
        border: "1px solid rgba(255,255,255,0.85)",
        boxShadow: "0 18px 50px rgba(23, 50, 76, 0.09)",
      }}
    >
      {children}
    </div>
  );
}

export function Screenshot({
  src,
  x,
  y,
  width,
  height,
  scale = 1,
  rotation = 0,
  opacity = 1,
}: {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scale?: number;
  rotation?: number;
  opacity?: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        borderRadius: 30,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.88)",
        boxShadow: "0 28px 80px rgba(17, 39, 68, 0.16)",
        transform: `rotate(${rotation}deg) scale(${scale})`,
        opacity,
      }}
    >
      <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
}

export function HighlightBox({
  x,
  y,
  width,
  height,
  color = "#0f5ea8",
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}) {
  const frame = useCurrentFrame();
  const glow = interpolate(Math.sin(frame / 8), [-1, 1], [0.55, 1]);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        borderRadius: 26,
        border: `4px solid ${color}`,
        boxShadow: `0 0 0 10px ${color}18, 0 0 38px ${color}${Math.round(
          glow * 255,
        )
          .toString(16)
          .padStart(2, "0")}`,
      }}
    />
  );
}

export function AnimatedCursor({
  x,
  y,
  clickFrame,
  scale = 1,
}: {
  x: number;
  y: number;
  clickFrame?: number;
  scale?: number;
}) {
  const frame = useCurrentFrame();
  const isClicking =
    clickFrame !== undefined && frame >= clickFrame && frame <= clickFrame + 10;
  const clickScale = isClicking
    ? interpolate(frame, [clickFrame ?? 0, (clickFrame ?? 0) + 10], [1, 0.9], {
        extrapolateRight: "clamp",
      })
    : 1;
  const ripple = clickFrame === undefined ? 0 : Math.max(0, frame - clickFrame);
  const rippleOpacity =
    clickFrame === undefined
      ? 0
      : interpolate(ripple, [0, 16], [0.36, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  return (
    <>
      {clickFrame !== undefined ? (
        <div
          style={{
            position: "absolute",
            left: x + 8 - ripple * 2,
            top: y + 10 - ripple * 2,
            width: 20 + ripple * 4,
            height: 20 + ripple * 4,
            borderRadius: 999,
            border: `4px solid rgba(15, 94, 168, ${rippleOpacity})`,
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: 42,
          height: 58,
          transform: `scale(${scale * clickScale})`,
          transformOrigin: "0 0",
          filter: "drop-shadow(0 10px 18px rgba(16, 37, 64, 0.2))",
        }}
      >
        <svg viewBox="0 0 42 58" width="42" height="58">
          <path
            d="M4 2L34 30L21 32L29 54L20 57L13 35L4 45Z"
            fill="#ffffff"
            stroke="#17324c"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </>
  );
}

export function Pill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const palette = {
    neutral: ["rgba(15, 94, 168, 0.1)", "#0f5ea8"],
    success: ["rgba(18, 150, 91, 0.12)", "#12965b"],
    warning: ["rgba(217, 133, 32, 0.14)", "#bd6d11"],
    danger: ["rgba(211, 63, 88, 0.12)", "#cf3a54"],
  } as const;
  const [background, color] = palette[tone];
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        borderRadius: 999,
        background,
        color,
        padding: "12px 18px",
        fontSize: 18,
        fontWeight: 800,
      }}
    >
      <span style={{ opacity: 0.78 }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function ProgressBar({
  label,
  amount,
  progress,
  tone,
}: {
  label: string;
  amount: string;
  progress: number;
  tone: "success" | "warning" | "danger";
}) {
  const palette = {
    success: "#12965b",
    warning: "#d98520",
    danger: "#cf3a54",
  } as const;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: "#17324c" }}>
          {label}
        </span>
        <span style={{ fontSize: 24, fontWeight: 800, color: palette[tone] }}>
          {amount}
        </span>
      </div>
      <div
        style={{
          width: "100%",
          height: 18,
          borderRadius: 999,
          background: "rgba(23, 50, 76, 0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.min(progress, 1) * 100}%`,
            height: "100%",
            borderRadius: 999,
            background: `linear-gradient(90deg, ${palette[tone]}, ${palette[tone]}bb)`,
          }}
        />
      </div>
    </div>
  );
}

export function PhoneFrame({
  children,
  x,
  y,
  width,
  height,
  rotation = 0,
}: {
  children: ReactNode;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        padding: 18,
        borderRadius: 44,
        background: "#11223b",
        boxShadow: "0 28px 80px rgba(17, 34, 59, 0.24)",
        transform: `rotate(${rotation}deg)`,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
          borderRadius: 30,
          background: "#f7fbff",
        }}
      >
        {children}
      </div>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 10,
          width: 110,
          height: 14,
          marginLeft: -55,
          borderRadius: 999,
          background: "#0a1324",
        }}
      />
    </div>
  );
}

export function NumberFlow({
  from,
  to,
  prefix = "R$ ",
  suffix = "",
  decimals = 2,
  color = "#17324c",
  size = 52,
}: {
  from: number;
  to: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  color?: string;
  size?: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = interpolate(
    spring({
      fps,
      frame: frame - 16,
      config: { damping: 120, stiffness: 140 },
    }),
    [0, 1],
    [0, 1],
    {
      easing: Easing.out(Easing.cubic),
    },
  );
  const current = from + (to - from) * progress;
  return (
    <div
      style={{
        fontSize: size,
        fontWeight: 900,
        letterSpacing: "-0.04em",
        color,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {prefix}
      {current.toFixed(decimals).replace(".", ",")}
      {suffix}
    </div>
  );
}
