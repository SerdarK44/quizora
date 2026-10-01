import * as XLSX from "xlsx";

export interface Question {
  id?: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  seconds: number;
  points?: number;
  imageUrl?: string;
}

export const SAMPLE_QUESTIONS: Question[] = [
  {
    prompt: "Türkiye'nin başkenti neresidir?",
    options: ["Ankara", "İstanbul", "İzmir", "Bursa"],
    correctIndex: 0,
    seconds: 20,
    points: 1000,
  },
  {
    prompt: "Güneş sistemindeki en büyük gezegen hangisidir?",
    options: ["Dünya", "Satürn", "Jüpiter", "Mars"],
    correctIndex: 2,
    seconds: 20,
    points: 1000,
  },
  {
    prompt: "Işık bir saniyede yaklaşık kaç kilometre yol alır?",
    options: ["30 bin", "300 bin", "3 milyon", "30 milyon"],
    correctIndex: 1,
    seconds: 30,
    points: 1000,
  },
];

function normalizeCorrectAnswer(val: unknown, options: string[]): number {
  if (typeof val === "number" && val >= 0 && val <= 3) return val;
  const str = String(val ?? "").trim().toUpperCase();
  if (str === "A" || str === "1") return 0;
  if (str === "B" || str === "2") return 1;
  if (str === "C" || str === "3") return 2;
  if (str === "D" || str === "4") return 3;

  // Match option text if full answer is provided
  const idx = options.findIndex(
    (o) => o.trim().toLowerCase() === String(val ?? "").trim().toLowerCase(),
  );
  if (idx !== -1) return idx;

  return 0;
}

export async function parseQuestionsFile(file: File): Promise<Question[]> {
  const fileName = file.name.toLowerCase();

  // 1. JSON PARSING
  if (fileName.endsWith(".json")) {
    const text = await file.text();
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : data.questions;
    if (!Array.isArray(list)) {
      throw new Error("JSON formatı bir soru dizisi içermelidir.");
    }

    return list.map((item, i) => {
      const prompt = String(item.prompt || item.soru || item.question || "").trim();
      if (!prompt) throw new Error(`${i + 1}. soruda soru metni eksik.`);

      let options: string[] = [];
      if (Array.isArray(item.options)) {
        options = item.options.map((o: unknown) => String(o).trim());
      } else if (Array.isArray(item.secenekler)) {
        options = item.secenekler.map((o: unknown) => String(o).trim());
      } else {
        options = [
          String(item.a || item.A || item.optionA || "").trim(),
          String(item.b || item.B || item.optionB || "").trim(),
          String(item.c || item.C || item.optionC || "").trim(),
          String(item.d || item.D || item.optionD || "").trim(),
        ];
      }

      while (options.length < 4) options.push("");
      options = options.slice(0, 4);

      const rawCorrect =
        item.correctIndex ??
        item.dogruCevap ??
        item.dogru ??
        item.correct ??
        0;

      return {
        prompt,
        options,
        correctIndex: normalizeCorrectAnswer(rawCorrect, options),
        seconds: Math.max(5, Math.min(120, Number(item.seconds || item.sure) || 20)),
        points: Math.max(0, Math.min(5000, Number(item.points || item.puan) || 1000)),
        imageUrl: String(item.imageUrl || item.gorsel || ""),
      };
    });
  }

  // 2. EXCEL & CSV PARSING via SheetJS
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Dosyada geçerli bir çalışma sayfası bulunamadı.");

  const sheet = workbook.Sheets[sheetName];
  // Parse rows as raw 2D array
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (!rows || rows.length === 0) throw new Error("Dosya boş görünüyor.");

  // Check if first row is a header row
  const firstRow = rows[0] || [];
  const firstCell = String(firstRow[0] || "").toLowerCase().trim();
  const hasHeader =
    firstCell.includes("soru") ||
    firstCell.includes("question") ||
    firstCell.includes("prompt") ||
    firstCell === "text";

  const dataRows = hasHeader ? rows.slice(1) : rows;
  const questions: Question[] = [];

  for (let idx = 0; idx < dataRows.length; idx++) {
    const row = dataRows[idx];
    if (!row || row.length === 0) continue;

    const prompt = String(row[0] || "").trim();
    if (!prompt) continue; // Skip blank lines

    const optA = String(row[1] ?? "").trim();
    const optB = String(row[2] ?? "").trim();
    const optC = String(row[3] ?? "").trim();
    const optD = String(row[4] ?? "").trim();
    const options = [optA, optB, optC, optD];

    const rawCorrect = row[5];
    const rawSeconds = row[6];
    const rawPoints = row[7];
    const rawImage = row[8];

    questions.push({
      prompt,
      options,
      correctIndex: normalizeCorrectAnswer(rawCorrect, options),
      seconds: Math.max(5, Math.min(120, Number(rawSeconds) || 20)),
      points: Math.max(0, Math.min(5000, Number(rawPoints) || 1000)),
      imageUrl: String(rawImage || "").trim(),
    });
  }

  if (questions.length === 0) {
    throw new Error("Yüklenebilir geçerli bir soru bulunamadı. Lütfen şablonu inceleyin.");
  }

  return questions;
}

export function downloadSampleTemplate(type: "csv" | "xlsx" | "json") {
  if (typeof window === "undefined") return;

  if (type === "json") {
    const jsonStr = JSON.stringify(SAMPLE_QUESTIONS, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ornek_sorular.json";
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const aoa = [
    [
      "Soru",
      "Seçenek A",
      "Seçenek B",
      "Seçenek C",
      "Seçenek D",
      "Doğru Cevap (A/B/C/D)",
      "Süre (sn)",
      "Puan",
      "Görsel URL (Opsiyonel)",
    ],
    ...SAMPLE_QUESTIONS.map((q) => [
      q.prompt,
      q.options[0] || "",
      q.options[1] || "",
      q.options[2] || "",
      q.options[3] || "",
      ["A", "B", "C", "D"][q.correctIndex] || "A",
      q.seconds,
      q.points || 1000,
      q.imageUrl || "",
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sorular");

  if (type === "xlsx") {
    XLSX.writeFile(wb, "ornek_sorular.xlsx");
  } else if (type === "csv") {
    XLSX.writeFile(wb, "ornek_sorular.csv", { bookType: "csv" });
  }
}
