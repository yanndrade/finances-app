import { TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Fragment } from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { linearTiming } from "@remotion/transitions";

import {
  AnimatedCursor,
  BottomCaption,
  GlassCard,
  HighlightBox,
  NumberFlow,
  PhoneFrame,
  Pill,
  SceneCopy,
  Screenshot,
  Stage,
  WindowFrame,
} from "../components/primitives";
import {
  TRANSITION_DURATION,
  TUTORIAL_SCENES,
  type TutorialScene,
} from "../data/tutorial-script";

import dashboardOverview from "../../../../output/dashboard-1080p.png";
import mobileOverview from "../../../../output/mobile-overview.png";
import logo from "../../../../packages/frontend/public/meucofri-logo.png";

const transitionTiming = linearTiming({
  durationInFrames: TRANSITION_DURATION,
});

export function TutorialVideo() {
  return (
    <AbsoluteFill>
      <TransitionSeries>
        {TUTORIAL_SCENES.map((scene, index) => (
          <Fragment key={scene.id}>
            <TransitionSeries.Sequence durationInFrames={scene.durationInFrames}>
              <SceneRenderer scene={scene} />
            </TransitionSeries.Sequence>
            {index < TUTORIAL_SCENES.length - 1 ? (
              <TransitionSeries.Transition
                presentation={fade()}
                timing={transitionTiming}
              />
            ) : null}
          </Fragment>
        ))}
      </TransitionSeries>
    </AbsoluteFill>
  );
}

function SceneRenderer({ scene }: { scene: TutorialScene }) {
  switch (scene.id) {
    case "intro":
      return <IntroScene scene={scene} />;
    case "accounts":
      return <AccountsScene scene={scene} />;
    case "quick-entry":
      return <QuickEntryScene scene={scene} />;
    case "cards":
      return <CardsScene scene={scene} />;
    case "recurring":
      return <RecurringScene scene={scene} />;
    case "reimbursements":
      return <ReimbursementsScene scene={scene} />;
    case "budgets":
      return <BudgetsScene scene={scene} />;
    case "lan":
      return <LanScene scene={scene} />;
    case "outro":
      return <OutroScene scene={scene} />;
    default:
      return null;
  }
}

function IntroScene({ scene }: { scene: TutorialScene }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const intro = spring({
    fps,
    frame,
    config: { damping: 170, stiffness: 120 },
  });
  const logoScale = interpolate(intro, [0, 1], [0.82, 1]);

  return (
    <Stage accent="#1a72c9">
      <Screenshot
        src={dashboardOverview}
        x={930}
        y={170}
        width={840}
        height={520}
        scale={1.03}
        rotation={-4}
        opacity={0.92}
      />
      <SceneCopy
        kicker={scene.kicker}
        title={scene.title}
        caption={scene.caption}
      />
      <div
        style={{
          position: "absolute",
          left: 112,
          top: 404,
          display: "flex",
          gap: 18,
        }}
      >
        <Pill label="Privacidade" value="local-first" tone="neutral" />
        <Pill label="Tempo" value="< 10s" tone="success" />
        <Pill label="Foco" value="caixa + cartão" tone="warning" />
      </div>
      <GlassCard x={118} y={522} width={330} height={212}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 24,
              background: "linear-gradient(135deg, #8f49ff, #185ec0)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${logoScale})`,
            }}
          >
            <Img src={logo} style={{ width: 58, height: 58, objectFit: "contain" }} />
          </div>
          <div>
            <div style={{ fontSize: 34, fontWeight: 900, color: "#17324c" }}>
              Meu Cofri
            </div>
            <div style={{ fontSize: 22, color: "#68819b", marginTop: 6 }}>
              Controle pessoal, sem ruído.
            </div>
          </div>
        </div>
      </GlassCard>
      <BottomCaption text={scene.caption} />
    </Stage>
  );
}

function AccountsScene({ scene }: { scene: TutorialScene }) {
  const frame = useCurrentFrame();
  const modalLift = interpolate(frame, [0, 24], [36, 0], {
    extrapolateRight: "clamp",
  });
  return (
    <Stage accent="#0f5ea8">
      <SceneCopy
        kicker={scene.kicker}
        title={scene.title}
        caption={scene.caption}
      />
      <WindowFrame
        title="Contas"
        subtitle="Estruture seu caixa real"
        x={720}
        y={132}
        width={1080}
        height={740}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(247,251,255,0.9), rgba(232,241,250,0.7))",
          }}
        />
        <GlassCard x={34} y={34} width={338} height={184}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#6b839d" }}>
            Saldo geral
          </div>
          <div style={{ marginTop: 14 }}>
            <NumberFlow from={0} to={1500} color="#0d7f5c" size={54} />
          </div>
          <div style={{ marginTop: 18, fontSize: 22, color: "#57718d" }}>
            Caixa pronto para começar o mês.
          </div>
        </GlassCard>
        <GlassCard x={34} y={246} width={470} height={202}>
          <div style={{ fontSize: 20, color: "#6b839d", fontWeight: 700 }}>
            Conta criada
          </div>
          <div style={{ marginTop: 18, fontSize: 42, color: "#17324c", fontWeight: 900 }}>
            Nubank
          </div>
          <div style={{ marginTop: 8, fontSize: 24, color: "#6b839d" }}>
            Conta corrente
          </div>
          <div style={{ marginTop: 24 }}>
            <Pill label="Saldo inicial" value="R$ 1.500,00" tone="success" />
          </div>
        </GlassCard>
        <GlassCard x={562} y={78 - modalLift} width={454} height={334}>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#17324c" }}>
            Nova conta
          </div>
          <FieldRow label="Nome" value="Nubank" />
          <FieldRow label="Tipo" value="Conta corrente" />
          <FieldRow label="Saldo inicial" value="R$ 1.500,00" />
          <ActionButton color="#0f5ea8" text="Salvar conta" />
        </GlassCard>
        <HighlightBox x={562} y={78 - modalLift} width={454} height={334} />
        <AnimatedCursor x={886} y={366 - modalLift} clickFrame={44} />
      </WindowFrame>
      <BottomCaption text={scene.caption} />
    </Stage>
  );
}

function QuickEntryScene({ scene }: { scene: TutorialScene }) {
  return (
    <Stage accent="#13965b">
      <SceneCopy
        kicker={scene.kicker}
        title={scene.title}
        caption={scene.caption}
      />
      <WindowFrame
        title="Lançamento rápido"
        subtitle="Sem perder o contexto"
        x={730}
        y={136}
        width={1060}
        height={716}
      >
        <GlassCard x={42} y={42} width={470} height={560}>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#17324c" }}>
            Nova transação
          </div>
          <FieldRow label="Valor" value="R$ 50,00" />
          <FieldRow label="Categoria" value="Alimentação" />
          <FieldRow label="Método" value="PIX" />
          <FieldRow label="Conta" value="Nubank" />
          <ActionButton color="#12965b" text="Registrar gasto" />
        </GlassCard>
        <GlassCard x={560} y={42} width={456} height={248}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#6b839d" }}>
            Saldo da conta
          </div>
          <div style={{ marginTop: 18 }}>
            <NumberFlow from={1500} to={1450} color="#17324c" size={58} />
          </div>
          <div style={{ marginTop: 18 }}>
            <Pill label="Variação" value="- R$ 50,00" tone="danger" />
          </div>
        </GlassCard>
        <GlassCard x={560} y={330} width={456} height={184}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#6b839d" }}>
            Tempo de registro
          </div>
          <div
            style={{
              marginTop: 20,
              fontSize: 70,
              fontWeight: 900,
              letterSpacing: "-0.05em",
              color: "#17324c",
            }}
          >
            09s
          </div>
          <div style={{ marginTop: 6, fontSize: 22, color: "#6b839d" }}>
            sem abrir fluxo extra nem tela paralela
          </div>
        </GlassCard>
        <HighlightBox x={42} y={42} width={470} height={560} color="#12965b" />
        <AnimatedCursor x={376} y={486} clickFrame={52} />
      </WindowFrame>
      <BottomCaption text={scene.caption} />
    </Stage>
  );
}

function CardsScene({ scene }: { scene: TutorialScene }) {
  const frame = useCurrentFrame();
  const barWidth = interpolate(frame, [14, 92], [0.12, 0.78], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <Stage accent="#215fad">
      <SceneCopy
        kicker={scene.kicker}
        title={scene.title}
        caption={scene.caption}
      />
      <GlassCard
        x={760}
        y={120}
        width={1040}
        height={760}
        background="rgba(255,255,255,0.68)"
      >
        <div style={{ display: "flex", gap: 26, height: "100%" }}>
          <div style={splitPanelStyle("rgba(17,150,91,0.08)")}>
            <div style={eyebrowStyle("#12965b")}>Caixa</div>
            <div style={bigValueStyle}>R$ 1.450,00</div>
            <div style={{ marginTop: 18 }}>
              <Pill label="Compra no crédito" value="não reduz agora" tone="success" />
            </div>
            <div style={conceptCardStyle}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#17324c" }}>
                Saldo preservado até pagar a fatura
              </div>
              <div style={{ marginTop: 10, fontSize: 18, color: "#58708a" }}>
                O app separa obrigação futura de dinheiro disponível hoje.
              </div>
            </div>
          </div>
          <div style={splitPanelStyle("rgba(15,94,168,0.1)")}>
            <div style={eyebrowStyle("#0f5ea8")}>Cartão</div>
            <div style={bigValueStyle}>Fatura R$ 120,00</div>
            <div style={{ marginTop: 20 }}>
              <Pill label="Compra" value="Celular 10x" tone="neutral" />
            </div>
            <div style={{ marginTop: 30, fontSize: 22, fontWeight: 800, color: "#58708a" }}>
              Parcelas futuras
            </div>
            <div style={progressTrackStyle}>
              <div
                style={{
                  width: `${barWidth * 100}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: "linear-gradient(90deg, #0f5ea8, #3a7fd1)",
                }}
              />
            </div>
            <div
              style={{
                marginTop: 20,
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: 12,
              }}
            >
              {["Abr", "Mai", "Jun", "Jul", "Ago"].map((month, index) => (
                <InstallmentMonth key={month} active={index === 0} month={month} />
              ))}
            </div>
          </div>
        </div>
      </GlassCard>
      <div
        style={{
          position: "absolute",
          left: 1260,
          top: 488,
          width: 44,
          height: 160,
          borderRadius: 999,
          background:
            "linear-gradient(180deg, rgba(15,94,168,0), rgba(15,94,168,0.12), rgba(15,94,168,0))",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 1225,
          top: 426,
          padding: "10px 18px",
          borderRadius: 999,
          background: "rgba(255,255,255,0.86)",
          fontSize: 18,
          fontWeight: 800,
          color: "#0f5ea8",
        }}
      >
        separacao inteligente
      </div>
      <BottomCaption text={scene.caption} />
    </Stage>
  );
}

function RecurringScene({ scene }: { scene: TutorialScene }) {
  const frame = useCurrentFrame();
  const confirmed = frame > 78;
  return (
    <Stage accent="#a76a1e">
      <SceneCopy
        kicker={scene.kicker}
        title={scene.title}
        caption={scene.caption}
      />
      <WindowFrame
        title="Gastos fixos"
        subtitle="Cadastro de regras e pendencias do mes"
        x={700}
        y={134}
        width={1100}
        height={748}
      >
        <GlassCard x={42} y={42} width={430} height={610}>
          <div style={{ fontSize: 30, fontWeight: 900, color: "#17324c" }}>
            Cadastros fixos
          </div>
          <RecurringRuleRow name="Internet fibra" amount="R$ 100,00" meta="Todo dia 10 • PIX" />
          <RecurringRuleRow name="Academia" amount="R$ 89,90" meta="Todo dia 12 • Cartão" />
          <RecurringRuleRow name="Spotify" amount="R$ 21,90" meta="Todo dia 15 • Cartão" />
        </GlassCard>
        <GlassCard x={516} y={42} width={542} height={610}>
          <div style={{ fontSize: 30, fontWeight: 900, color: "#17324c" }}>
            Pendências de março
          </div>
          <div
            style={{
              marginTop: 26,
              borderRadius: 24,
              padding: 24,
              background: confirmed ? "rgba(18,150,91,0.12)" : "rgba(217,133,32,0.10)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#17324c" }}>
                  Internet
                </div>
                <div style={{ marginTop: 8, fontSize: 20, color: "#68819b" }}>
                  Vence hoje • Conta Nubank
                </div>
              </div>
              <div style={{ fontSize: 34, fontWeight: 900, color: "#17324c" }}>
                R$ 100,00
              </div>
            </div>
            <div style={{ marginTop: 26, display: "flex", gap: 14, alignItems: "center" }}>
              <ActionChip
                color={confirmed ? "#12965b" : "#d98520"}
                text={confirmed ? "Pago" : "Confirmar"}
              />
              {confirmed ? (
                <Pill label="Caixa" value="- R$ 100,00" tone="danger" />
              ) : (
                <Pill label="Ação" value="1 clique" tone="warning" />
              )}
            </div>
          </div>
          <AnimatedCursor x={708} y={424} clickFrame={74} />
        </GlassCard>
      </WindowFrame>
      <BottomCaption text={scene.caption} />
    </Stage>
  );
}

function ReimbursementsScene({ scene }: { scene: TutorialScene }) {
  return (
    <Stage accent="#0f7b8f">
      <SceneCopy
        kicker={scene.kicker}
        title={scene.title}
        caption={scene.caption}
      />
      <GlassCard x={760} y={168} width={490} height={240}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#6b839d" }}>
          Compra para terceiro
        </div>
        <div style={{ marginTop: 18, fontSize: 42, fontWeight: 900, color: "#17324c" }}>
          Restaurante com João
        </div>
        <div style={{ marginTop: 12 }}>
          <Pill label="Responsável" value="João" tone="neutral" />
        </div>
        <div style={{ marginTop: 16 }}>
          <Pill label="Status" value="pendente" tone="warning" />
        </div>
      </GlassCard>
      <GlassCard x={1320} y={314} width={392} height={256}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#6b839d" }}>
          Tela A Receber
        </div>
        <div style={{ marginTop: 16, fontSize: 34, fontWeight: 900, color: "#17324c" }}>
          João
        </div>
        <div style={{ marginTop: 12, fontSize: 56, fontWeight: 900, color: "#17324c" }}>
          R$ 80,00
        </div>
        <ActionButton color="#12965b" text="Marcar recebido" />
      </GlassCard>
      <div
        style={{
          position: "absolute",
          left: 1228,
          top: 308,
          fontSize: 58,
          color: "#0f5ea8",
          fontWeight: 800,
        }}
      >
        →
      </div>
      <AnimatedCursor x={1568} y={516} clickFrame={82} />
      <GlassCard x={818} y={618} width={360} height={172}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#6b839d" }}>
          Caixa após receber
        </div>
        <div style={{ marginTop: 16 }}>
          <NumberFlow from={1450} to={1530} color="#12965b" size={52} />
        </div>
      </GlassCard>
      <BottomCaption text={scene.caption} />
    </Stage>
  );
}

function BudgetsScene({ scene }: { scene: TutorialScene }) {
  const frame = useCurrentFrame();
  const lazerProgress = interpolate(frame, [12, 100], [0.32, 1.18], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lazerTone =
    lazerProgress > 1 ? "danger" : lazerProgress > 0.7 ? "warning" : "success";

  return (
    <Stage accent="#cf3a54">
      <SceneCopy
        kicker={scene.kicker}
        title={scene.title}
        caption={scene.caption}
      />
      <GlassCard x={792} y={174} width={962} height={618}>
        <div style={{ fontSize: 30, fontWeight: 900, color: "#17324c" }}>
          Orçamentos do mês
        </div>
        <div style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 34 }}>
          <BudgetRow
            label="Lazer"
            amount={`R$ ${(500 * Math.min(lazerProgress, 1.2))
              .toFixed(0)
              .replace(".", ",")},00`}
            progress={Math.min(lazerProgress, 1)}
            tone={lazerTone}
          />
          <BudgetRow
            label="Mercado"
            amount="R$ 380,00"
            progress={0.58}
            tone="success"
          />
          <BudgetRow
            label="Transporte"
            amount="R$ 160,00"
            progress={0.72}
            tone="warning"
          />
        </div>
        <div style={{ marginTop: 42, display: "flex", gap: 14 }}>
          <Pill label="Cartão incluso" value="sim" tone="neutral" />
          <Pill
            label="Alerta visual"
            value={lazerProgress > 1 ? "estourou" : "no radar"}
            tone={lazerProgress > 1 ? "danger" : "warning"}
          />
        </div>
      </GlassCard>
      <BottomCaption text={scene.caption} />
    </Stage>
  );
}

function LanScene({ scene }: { scene: TutorialScene }) {
  const frame = useCurrentFrame();
  const phoneX = interpolate(frame, [6, 80], [1500, 1324], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <Stage accent="#1861c5">
      <SceneCopy
        kicker={scene.kicker}
        title={scene.title}
        caption={scene.caption}
      />
      <WindowFrame
        title="Modo LAN"
        subtitle="Pareamento local por QR Code"
        x={706}
        y={150}
        width={882}
        height={650}
      >
        <GlassCard x={36} y={38} width={340} height={522}>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#17324c" }}>
            Configurações LAN
          </div>
          <div style={{ marginTop: 24 }}>
            <Pill label="Status" value="Ativado" tone="success" />
          </div>
          <div
            style={{
              marginTop: 26,
              width: 250,
              height: 250,
              borderRadius: 28,
              background:
                "conic-gradient(from 45deg, #17324c 0 25%, #ffffff 25% 50%, #17324c 50% 75%, #ffffff 75% 100%)",
              backgroundSize: "28px 28px",
              boxShadow: "inset 0 0 0 18px #ffffff",
            }}
          />
          <div style={{ marginTop: 20, fontSize: 20, color: "#68819b", lineHeight: 1.5 }}>
            Escaneie com o celular na mesma rede Wi-Fi para abrir a interface mobile.
          </div>
        </GlassCard>
        <Screenshot
          src={dashboardOverview}
          x={414}
          y={54}
          width={426}
          height={498}
          opacity={0.95}
        />
      </WindowFrame>
      <PhoneFrame x={phoneX} y={206} width={286} height={584} rotation={3}>
        <Img src={mobileOverview} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </PhoneFrame>
      <BottomCaption text={scene.caption} />
    </Stage>
  );
}

function OutroScene({ scene }: { scene: TutorialScene }) {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 80], [1.08, 1], {
    extrapolateRight: "clamp",
  });
  return (
    <Stage accent="#0f5ea8">
      <Screenshot
        src={dashboardOverview}
        x={190}
        y={154}
        width={1540}
        height={694}
        scale={scale}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(239,245,251,0.2), rgba(239,245,251,0.06), rgba(239,245,251,0.75))",
        }}
      />
      <SceneCopy
        kicker={scene.kicker}
        title={scene.title}
        caption={scene.caption}
        align="center"
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 456,
          width: 720,
          marginLeft: -360,
          display: "flex",
          justifyContent: "center",
          gap: 18,
        }}
      >
        <Pill label="Caixa" value="claro" tone="success" />
        <Pill label="Cartão" value="organizado" tone="neutral" />
        <Pill label="Rotina" value="mais leve" tone="warning" />
      </div>
      <BottomCaption text={scene.caption} />
    </Stage>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={fieldLabelStyle}>{label}</div>
      <div style={fieldValueStyle}>{value}</div>
    </div>
  );
}

function ActionButton({ color, text }: { color: string; text: string }) {
  return (
    <div
      style={{
        marginTop: 24,
        display: "inline-flex",
        borderRadius: 18,
        background: color,
        color: "#ffffff",
        padding: "16px 24px",
        fontSize: 22,
        fontWeight: 800,
      }}
    >
      {text}
    </div>
  );
}

function ActionChip({ color, text }: { color: string; text: string }) {
  return (
    <div
      style={{
        borderRadius: 18,
        background: color,
        color: "#ffffff",
        padding: "14px 20px",
        fontSize: 22,
        fontWeight: 800,
      }}
    >
      {text}
    </div>
  );
}

function InstallmentMonth({
  month,
  active,
}: {
  month: string;
  active: boolean;
}) {
  return (
    <div
      style={{
        borderRadius: 18,
        background: active ? "rgba(15,94,168,0.16)" : "rgba(23,50,76,0.06)",
        padding: "16px 12px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 800, color: "#6b839d" }}>{month}</div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#17324c" }}>
        R$ 120
      </div>
    </div>
  );
}

function RecurringRuleRow({
  name,
  amount,
  meta,
}: {
  name: string;
  amount: string;
  meta: string;
}) {
  return (
    <div
      style={{
        marginTop: 18,
        borderRadius: 22,
        background: "rgba(23,50,76,0.05)",
        padding: 20,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#17324c" }}>{name}</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: "#17324c" }}>{amount}</div>
      </div>
      <div style={{ marginTop: 10, fontSize: 18, color: "#68819b" }}>{meta}</div>
    </div>
  );
}

function BudgetRow({
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
        <span style={{ fontSize: 26, fontWeight: 800, color: "#17324c" }}>{label}</span>
        <span style={{ fontSize: 24, fontWeight: 800, color: palette[tone] }}>{amount}</span>
      </div>
      <div style={progressTrackStyle}>
        <div
          style={{
            width: `${progress * 100}%`,
            height: "100%",
            borderRadius: 999,
            background: `linear-gradient(90deg, ${palette[tone]}, ${palette[tone]}bb)`,
          }}
        />
      </div>
    </div>
  );
}

function eyebrowStyle(color: string) {
  return {
    fontSize: 20,
    letterSpacing: "0.18em",
    fontWeight: 800,
    color,
    textTransform: "uppercase" as const,
  };
}

function splitPanelStyle(background: string) {
  return {
    flex: 1,
    borderRadius: 30,
    background: `linear-gradient(180deg, ${background}, rgba(255,255,255,0.95))`,
    padding: 28,
    position: "relative" as const,
  };
}

const bigValueStyle = {
  marginTop: 18,
  fontSize: 58,
  fontWeight: 900,
  color: "#17324c",
};

const conceptCardStyle = {
  position: "absolute" as const,
  left: 28,
  right: 28,
  bottom: 28,
  borderRadius: 24,
  background: "rgba(18,150,91,0.08)",
  padding: 22,
};

const progressTrackStyle = {
  marginTop: 14,
  height: 20,
  width: "100%",
  borderRadius: 999,
  background: "rgba(15,94,168,0.08)",
  overflow: "hidden" as const,
};

const fieldLabelStyle = {
  fontSize: 18,
  fontWeight: 800,
  color: "#6b839d",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
};

const fieldValueStyle = {
  marginTop: 10,
  borderRadius: 20,
  border: "1px solid rgba(15,94,168,0.12)",
  background: "rgba(247,251,255,0.95)",
  padding: "18px 20px",
  fontSize: 24,
  fontWeight: 700,
  color: "#17324c",
};
