import { createServerFn } from "@tanstack/react-start";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

async function callGateway(body: Record<string, unknown>) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const r = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, ...body }),
  });
  if (!r.ok) {
    const text = await r.text();
    if (r.status === 429) throw new Error("AI rate limited. Try again shortly.");
    if (r.status === 402) throw new Error("AI credits exhausted. Top up in Settings.");
    throw new Error(`AI error ${r.status}: ${text.slice(0, 200)}`);
  }
  return r.json();
}

// ============ 1. Customer pre-chat (waiting in queue) ============
export const customerPreChat = createServerFn({ method: "POST" })
  .inputValidator((d: { messages: { role: "user" | "assistant"; content: string }[]; customer: { name: string; reason: string; language: "UZ" | "RU" } }) => d)
  .handler(async ({ data }) => {
    const sys = `Siz SADOO bankining navbatda kutayotgan mijozlariga yordam beradigan AI yordamchisiz.
Mijoz ismi: ${data.customer.name}. Murojaat sababi: "${data.customer.reason}".
Til: ${data.customer.language === "UZ" ? "O'zbek tilida" : "На русском языке"} javob bering.
Vazifangiz:
1) Mijozning aniq ehtiyojini bilib oling (3-4 ta qisqa savol).
2) Operator kelguncha xushmuomala bo'ling.
3) Javoblar QISQA bo'lsin (1-2 jumla).
Hech qachon haqiqiy bank ma'lumotlarini so'ramang (parol, CVV).`;
    const out = await callGateway({
      messages: [{ role: "system", content: sys }, ...data.messages],
      temperature: 0.7,
    });
    const reply = out.choices?.[0]?.message?.content ?? "...";
    return { reply };
  });

// ============ 2. Build customer profile from pre-chat ============
export const buildProfile = createServerFn({ method: "POST" })
  .inputValidator((d: { transcript: string; reason: string }) => d)
  .handler(async ({ data }) => {
    const tools = [{
      type: "function",
      function: {
        name: "set_profile",
        description: "Build a structured customer profile from a pre-chat transcript.",
        parameters: {
          type: "object",
          properties: {
            needs: { type: "string", description: "Aniq ehtiyoj, 1 jumla" },
            interest: { type: "string", description: "Bank mahsuloti (kredit/depozit/karta/biznes)" },
            mood: { type: "string", enum: ["calm", "frustrated", "excited", "neutral"] },
            notes: { type: "array", items: { type: "string" }, description: "3 ta qisqa note" },
          },
          required: ["needs", "interest", "mood", "notes"],
          additionalProperties: false,
        },
      },
    }];
    const out = await callGateway({
      messages: [
        { role: "system", content: "Mijoz profilini tuzing. Faqat qisqa o'zbek tilida." },
        { role: "user", content: `Sabab: ${data.reason}\n\nSuhbat:\n${data.transcript}` },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "set_profile" } },
    });
    const tc = out.choices?.[0]?.message?.tool_calls?.[0];
    const args = tc ? JSON.parse(tc.function.arguments) : { needs: "", interest: "", mood: "neutral", notes: [] };
    return args as { needs: string; interest: string; mood: "calm" | "frustrated" | "excited" | "neutral"; notes: string[] };
  });

// ============ 3. Live operator copilot ============
export const copilot = createServerFn({ method: "POST" })
  .inputValidator((d: {
    transcript: { speaker: "operator" | "customer"; text: string }[];
    customer: { name: string; reason: string; language: "UZ" | "RU"; aiProfile?: { needs: string; interest: string; mood: string; notes: string[] } };
    crm?: { segment?: string; risk?: string; income?: number; hasLoan?: boolean; hasDeposit?: boolean; hasCard?: boolean } | null;
    memory?: { callCount: number; lastIntent: string; summary: string } | null;
    formulas: { id: string; type: string; title: string; pattern: string; successRate: number }[];
  }) => d)
  .handler(async ({ data }) => {
    const crmCtx = data.crm
      ? `Mijoz CRM: segment=${data.crm.segment}, risk=${data.crm.risk}, daromad=${(data.crm.income ?? 0).toLocaleString()} so'm, kredit=${data.crm.hasLoan}, depozit=${data.crm.hasDeposit}, karta=${data.crm.hasCard}.`
      : "CRM ma'lumoti yo'q (yangi mijoz).";
    const memCtx = data.memory
      ? `Tarix: ${data.memory.callCount} marta qo'ng'iroq qilgan. Oxirgi: ${data.memory.lastIntent}. ${data.memory.summary}`
      : "Birinchi qo'ng'iroq.";
    const profCtx = data.customer.aiProfile
      ? `AI profil: ehtiyoj="${data.customer.aiProfile.needs}", qiziqish="${data.customer.aiProfile.interest}", kayfiyat=${data.customer.aiProfile.mood}.`
      : "";
    const formCtx = data.formulas
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 6)
      .map((f) => `- ${f.id} | ${f.type} | "${f.title}" — ${(f.successRate * 100).toFixed(0)}%`)
      .join("\n");
    const tCtx = data.transcript.slice(-12).map((t) => `[${t.speaker === "operator" ? "Operator" : "Mijoz"}]: ${t.text}`).join("\n") || "(suhbat hali boshlanmagan)";

    const tools = [{
      type: "function",
      function: {
        name: "suggest",
        description: "Real-time operator copilot suggestion.",
        parameters: {
          type: "object",
          properties: {
            nextAction: { type: "string", description: "Hozir nima qilish kerak — 1 jumla" },
            script: { type: "string", description: "Aynan nima deyish kerak — to'liq jumla" },
            tone: { type: "string", description: "Qanday ohangda — 1 jumla" },
            objectionResponse: { type: "string", description: "Agar e'tiroz bo'lsa, javob" },
            recommendedProduct: { type: "string", description: "Tavsiya qilingan mahsulot" },
            sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
            salesStage: { type: "string", enum: ["greeting", "discovery", "pitch", "objection", "closing", "wrap_up"] },
            formulaId: { type: "string", description: "Eng mos formula ID" },
          },
          required: ["nextAction", "script", "tone", "sentiment", "salesStage"],
          additionalProperties: false,
        },
      },
    }];

    const sys = `Siz SADOO bank operatori uchun real-time AI copilot. Vazifa: operatorga AYNAN nima deyishni va qanday ohangda gapirishni ayting.
Til: ${data.customer.language === "UZ" ? "O'zbek" : "Russian"}.
${crmCtx}
${memCtx}
${profCtx}
Mavjud formulalar (eng yaxshilari):
${formCtx}
QOIDA: agar mijoz krediti bor + depoziti yo'q bo'lsa — depozit cross-sell taklif qiling.`;

    const out = await callGateway({
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `Suhbat:\n${tCtx}\n\nMurojaat sababi: ${data.customer.reason}` },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "suggest" } },
      temperature: 0.4,
    });
    const tc = out.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) throw new Error("AI did not return suggestion");
    return JSON.parse(tc.function.arguments);
  });

// ============ 4. Post-call summary ============
export const summarizeCall = createServerFn({ method: "POST" })
  .inputValidator((d: { transcript: { speaker: string; text: string }[]; customerName: string; reason: string }) => d)
  .handler(async ({ data }) => {
    const t = data.transcript.map((x) => `[${x.speaker === "operator" ? "Operator" : "Mijoz"}]: ${x.text}`).join("\n");
    const out = await callGateway({
      messages: [
        { role: "system", content: "Bank qo'ng'irog'ini 3-4 jumlada xulosalang. O'zbek tilida." },
        { role: "user", content: `Mijoz: ${data.customerName}. Sabab: ${data.reason}.\n\n${t}` },
      ],
      temperature: 0.3,
    });
    return { summary: out.choices?.[0]?.message?.content ?? "" };
  });
