import { count } from "drizzle-orm";
import { hash, mockForecast } from "@/engine/mock";
import { modelRegistry } from "@/engine/registry";
import type { Db } from "./client";
import * as schema from "./schema";

/**
 * Demo content for a fresh local database.
 *
 * Everything here is invented: the "resolved" questions never happened and
 * their outcomes are random. Slugs start with "demo-" so the site can label
 * them. Do not run this against a production database.
 */

const DAY = 24 * 60 * 60 * 1000;

/** Fake per-model skill, only so the demo leaderboard is not a tie. */
const demoSkill: Record<string, number> = {
  "claude-opus-5-5": 0.82,
  "gpt-sol": 0.8,
  "gemini-4": 0.76,
  "grok-4-7": 0.68,
  "claude-haiku-5-5": 0.55,
  "gpt-luna": 0.5,
  deepseek: 0.58,
  llama: 0.42,
};

type Seed = { he: string; en?: string; category: string };

const openLocal: (Seed & { criteria: string; days: number })[] = [
  {
    he: "האם בנק ישראל יוריד את הריבית בהחלטה הקרובה?",
    criteria: "בנק ישראל מודיע על הורדת ריבית בהחלטת הריבית הקרובה, לפי הודעה רשמית של הבנק.",
    category: "economy",
    days: 34,
  },
  {
    he: "האם מדד המחירים לצרכן לחודש הבא יעלה ב-0.3% או יותר?",
    criteria: "הלשכה המרכזית לסטטיסטיקה מפרסמת עלייה חודשית של 0.3% או יותר במדד המחירים לצרכן.",
    category: "economy",
    days: 27,
  },
  {
    he: "האם תקציב המדינה יאושר בכנסת בקריאה שלישית עד סוף הרבעון?",
    criteria: "הכנסת מאשרת את חוק התקציב בקריאה שלישית עד היום האחרון של הרבעון הנוכחי.",
    category: "politics",
    days: 46,
  },
  {
    he: "האם מכבי תל אביב תסיים את סיבוב הליגה הנוכחי במקום הראשון?",
    criteria: "מכבי תל אביב בכדורגל במקום הראשון בטבלת ליגת העל בתום הסיבוב הנוכחי, לפי אתר המנהלת.",
    category: "sports",
    days: 52,
  },
  {
    he: "האם שער הדולר היציג יהיה מתחת ל-3.5 שקלים בסוף החודש הבא?",
    criteria: "השער היציג של הדולר שמפרסם בנק ישראל ביום המסחר האחרון של החודש הבא נמוך מ-3.5.",
    category: "economy",
    days: 41,
  },
  {
    he: "האם סרט ישראלי ייכנס לרשימה הקצרה של האוסקר לסרט הבינלאומי?",
    criteria: "האקדמיה האמריקאית מפרסמת רשימה קצרה לקטגוריית הסרט הבינלאומי, וסרט ישראלי נכלל בה.",
    category: "culture",
    days: 38,
  },
];

const openGlobal: (Seed & { criteriaEn: string; criteriaHe: string; days: number })[] = [
  {
    en: "Will the US Federal Reserve cut rates at its next meeting?",
    he: "האם הפדרל ריזרב יוריד ריבית בישיבה הקרובה?",
    criteriaEn: "The FOMC statement after its next scheduled meeting announces a lower target range.",
    criteriaHe: "הודעת ה-FOMC בתום הישיבה המתוכננת הבאה מודיעה על הורדת טווח הריבית.",
    category: "economy",
    days: 30,
  },
  {
    en: "Will a new frontier AI model top the LMArena text leaderboard within 60 days?",
    he: "האם מודל AI חדש יגיע למקום הראשון בדירוג הטקסט של LMArena בתוך 60 יום?",
    criteriaEn: "A model released after this question opened holds rank 1 on the LMArena text leaderboard on the resolution date.",
    criteriaHe: "מודל ששוחרר אחרי פתיחת השאלה מדורג ראשון בדירוג הטקסט של LMArena בתאריך ההכרעה.",
    category: "tech",
    days: 60,
  },
  {
    en: "Will Brent crude close above $80 on the last trading day of next month?",
    he: "האם נפט ברנט ייסגר מעל 80 דולר ביום המסחר האחרון של החודש הבא?",
    criteriaEn: "The Brent front-month futures settlement price on the last trading day of next month is above $80.",
    criteriaHe: "מחיר הסגירה של חוזה ברנט הקרוב ביום המסחר האחרון של החודש הבא גבוה מ-80 דולר.",
    category: "economy",
    days: 44,
  },
  {
    en: "Will a crewed Artemis mission launch before the end of next quarter?",
    he: "האם משימת ארטמיס מאוישת תשוגר לפני סוף הרבעון הבא?",
    criteriaEn: "NASA confirms liftoff of a crewed Artemis mission before the last day of next quarter.",
    criteriaHe: "נאס\"א מאשרת שיגור של משימת ארטמיס מאוישת לפני היום האחרון של הרבעון הבא.",
    category: "science",
    days: 110,
  },
];

const resolvedLocal: Seed[] = [
  { he: "האם הריבית ירדה בהחלטת הבנק?", category: "economy" },
  { he: "האם המדד החודשי עלה ביותר מ-0.2%?", category: "economy" },
  { he: "האם החוק עבר בקריאה שלישית עד המועד?", category: "politics" },
  { he: "האם הקבוצה סיימה את הסיבוב בצמרת?", category: "sports" },
  { he: "האם שיעור האבטלה ירד מתחת ל-3%?", category: "economy" },
  { he: "האם הסרט עבר מיליון צופים בקולנוע?", category: "culture" },
  { he: "האם מדד ת\"א 35 סגר את החודש בעלייה?", category: "economy" },
  { he: "האם הנבחרת העפילה לשלב הבא?", category: "sports" },
];

const resolvedGlobal: Seed[] = [
  { en: "Did the central bank cut rates at the meeting?", he: "האם הבנק המרכזי הוריד ריבית בישיבה?", category: "economy" },
  { en: "Did monthly inflation come in above forecast?", he: "האם האינפלציה החודשית עלתה על התחזית?", category: "economy" },
  { en: "Did the index close the month higher?", he: "האם המדד סגר את החודש בעלייה?", category: "economy" },
  { en: "Did the bill pass before the deadline?", he: "האם הצעת החוק עברה לפני המועד?", category: "politics" },
  { en: "Did the incumbent party win the by-election?", he: "האם מפלגת השלטון ניצחה בבחירות המשנה?", category: "politics" },
  { en: "Did the launch happen within the window?", he: "האם השיגור יצא בחלון הזמן?", category: "science" },
  { en: "Did the trial meet its primary endpoint?", he: "האם הניסוי עמד ביעד הראשי?", category: "science" },
  { en: "Did the product ship before the quarter ended?", he: "האם המוצר שוחרר לפני סוף הרבעון?", category: "tech" },
  { en: "Did the model beat the benchmark record?", he: "האם המודל שבר את שיא הבנצ'מרק?", category: "tech" },
  { en: "Did the merger receive regulatory approval?", he: "האם המיזוג קיבל אישור רגולטורי?", category: "tech" },
  { en: "Did the favourite win the final?", he: "האם הפייבוריטית ניצחה בגמר?", category: "sports" },
  { en: "Did the record fall at the championships?", he: "האם השיא נשבר באליפות?", category: "sports" },
  { en: "Did the film open at number one?", he: "האם הסרט נפתח במקום הראשון?", category: "culture" },
  { en: "Did the album debut in the top five?", he: "האם האלבום נכנס לחמישייה הראשונה?", category: "culture" },
  { en: "Did the ceasefire hold through the month?", he: "האם הפסקת האש החזיקה עד סוף החודש?", category: "world" },
  { en: "Did the summit end with a joint statement?", he: "האם הפסגה הסתיימה בהצהרה משותפת?", category: "world" },
];

export async function seedIfEmpty(db: Db) {
  const [{ n }] = await db.select({ n: count() }).from(schema.models);
  if (n > 0) return;
  await seed(db);
}

export async function seed(db: Db, now = new Date()) {
  const joinedAt = new Date(now.getTime() - 200 * DAY);
  await db
    .insert(schema.models)
    .values(modelRegistry.map((m) => ({ ...m, joinedAt })))
    .onConflictDoNothing();

  const forecastRows: (typeof schema.forecasts.$inferInsert)[] = [];
  const priceRows: (typeof schema.marketPrices.$inferInsert)[] = [];

  async function addQuestion(args: {
    slug: string;
    edition: string;
    lang: string;
    title: schema.Localized;
    criteria: schema.Localized;
    category: string;
    openAt: Date;
    lockAt: Date;
    resolveBy: Date;
    status: schema.QuestionStatus;
    outcome?: boolean;
    suggestedBy?: string;
  }) {
    const [row] = await db
      .insert(schema.questions)
      .values({
        ...args,
        outcome: args.outcome ?? null,
        resolvedAt: args.status === "resolved" ? new Date(args.lockAt.getTime() + DAY) : null,
        votes: Math.floor(hash(`v:${args.slug}`) * 40),
      })
      .returning({ id: schema.questions.id });

    const end = args.status === "open" ? now : args.lockAt;

    // About two thirds of the demo questions also have a made-up market price.
    if (hash(`mkt:${args.slug}`) < 0.66) {
      const weeks = Math.max(1, Math.floor((end.getTime() - args.openAt.getTime()) / (7 * DAY)) + 1);
      for (let w = 0; w < weeks; w++) {
        const f = mockForecast({
          questionSlug: args.slug,
          modelId: "market",
          track: "open",
          round: w,
          lang: args.lang,
          skill: 0.72,
          outcome: args.status === "resolved" ? args.outcome : undefined,
        });
        priceRows.push({
          questionId: row.id,
          probability: f.probability,
          source: "polymarket",
          mock: true,
          createdAt: new Date(args.openAt.getTime() + w * 7 * DAY + 120_000),
        });
      }
    }
    for (const m of modelRegistry) {
      const trackList = m.supportsOpenBook ? (["closed", "open"] as const) : (["closed"] as const);
      for (const track of trackList) {
        const rounds =
          track === "closed"
            ? 1
            : Math.max(1, Math.floor((end.getTime() - args.openAt.getTime()) / (7 * DAY)) + 1);
        for (let round = 0; round < rounds; round++) {
          const f = mockForecast({
            questionSlug: args.slug,
            modelId: m.id,
            track,
            round,
            lang: args.lang,
            skill: demoSkill[m.id],
            outcome: args.status === "resolved" ? args.outcome : undefined,
          });
          forecastRows.push({
            questionId: row.id,
            modelId: m.id,
            track,
            round,
            probability: f.probability,
            rationale: f.rationale,
            keyFactors: f.keyFactors,
            changeMind: f.changeMind,
            mock: true,
            createdAt: new Date(args.openAt.getTime() + round * 7 * DAY + 60_000),
          });
        }
      }
    }
  }

  // Open questions: real-sounding, still unresolved.
  for (const [i, q] of openLocal.entries()) {
    const openAt = new Date(now.getTime() - (3 + i * 3) * DAY);
    const resolveBy = new Date(now.getTime() + q.days * DAY);
    await addQuestion({
      slug: `demo-il-open-${i + 1}`,
      edition: "il",
      lang: "he",
      title: { he: q.he },
      criteria: { he: q.criteria },
      category: q.category,
      openAt,
      lockAt: new Date(resolveBy.getTime() - DAY),
      resolveBy,
      status: "open",
      suggestedBy: ["נועה", "איתי", "מערכת", "דנה", "מערכת", "יואב"][i],
    });
  }
  for (const [i, q] of openGlobal.entries()) {
    const openAt = new Date(now.getTime() - (2 + i * 4) * DAY);
    const resolveBy = new Date(now.getTime() + q.days * DAY);
    await addQuestion({
      slug: `demo-global-open-${i + 1}`,
      edition: "global",
      lang: "en",
      title: { en: q.en!, he: q.he },
      criteria: { en: q.criteriaEn, he: q.criteriaHe },
      category: q.category,
      openAt,
      lockAt: new Date(resolveBy.getTime() - DAY),
      resolveBy,
      status: "open",
      suggestedBy: "Editors",
    });
  }

  // Resolved questions: two passes over each list so every model clears the ranking minimum.
  let n = 0;
  for (const pass of [1, 2]) {
    for (const [list, edition, lang] of [
      [resolvedLocal, "il", "he"],
      [resolvedGlobal, "global", "en"],
    ] as const) {
      for (const [i, q] of list.entries()) {
        n++;
        const slug = `demo-${edition}-resolved-${pass}-${i + 1}`;
        const openAt = new Date(now.getTime() - (30 + pass * 28 + (i % 9) * 2) * DAY);
        const lockAt = new Date(openAt.getTime() + (14 + (i % 3) * 7) * DAY);
        const suffixHe = ` (סבב ${pass})`;
        const suffixEn = ` (round ${pass})`;
        await addQuestion({
          slug,
          edition,
          lang,
          title: lang === "he" ? { he: q.he + suffixHe } : { en: q.en! + suffixEn, he: q.he + suffixHe },
          criteria:
            lang === "he"
              ? { he: "שאלת הדגמה. התוצאה נקבעה באקראי." }
              : { en: "Demo question. The outcome was set at random.", he: "שאלת הדגמה. התוצאה נקבעה באקראי." },
          category: q.category,
          openAt,
          lockAt,
          resolveBy: new Date(lockAt.getTime() + DAY),
          status: "resolved",
          outcome: hash(`o:${slug}:${n}`) > 0.5,
        });
      }
    }
  }

  // Two suggestions waiting in the admin queue.
  await db.insert(schema.questions).values([
    {
      slug: "demo-pending-1",
      status: "pending",
      edition: "il",
      lang: "he",
      title: { he: "האם תחנת הרכבת הקלה החדשה תיפתח לנוסעים עד סוף החודש הבא?" },
      criteria: { he: "הודעה רשמית על פתיחת התחנה לנוסעים עד היום האחרון של החודש הבא." },
      category: "world",
      suggestedBy: "רוני",
      resolveBy: new Date(now.getTime() + 45 * DAY),
      votes: 12,
    },
    {
      slug: "demo-pending-2",
      status: "pending",
      edition: "il",
      lang: "he",
      title: { he: "האם מחיר הדלק יעלה בעדכון החודשי הקרוב?" },
      criteria: { he: "משרד האנרגיה מודיע על עלייה במחיר המרבי לליטר בנזין 95 בעדכון הקרוב." },
      category: "economy",
      suggestedBy: "מאיה",
      resolveBy: new Date(now.getTime() + 18 * DAY),
      votes: 7,
    },
  ]);

  if (priceRows.length) await db.insert(schema.marketPrices).values(priceRows);
  for (let i = 0; i < forecastRows.length; i += 200) {
    await db.insert(schema.forecasts).values(forecastRows.slice(i, i + 200));
  }
}
