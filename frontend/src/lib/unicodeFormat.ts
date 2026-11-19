/**
 * Unicode Rich Text Formatter & Clipboard Helper for LinkedIn / X / Social Networks.
 * Social platforms do not parse Markdown (**bold**) or HTML (<b>bold</b>),
 * so Mathematical Sans-Serif Unicode characters are used for native bold/italic emphasis.
 */

const BOLD_UPPER_START = 0x1d5d4; // 𝗔
const BOLD_LOWER_START = 0x1d5ee; // 𝗮
const BOLD_DIGIT_START = 0x1d7ec; // 𝟬

const ITALIC_UPPER_START = 0x1d608; // 𝘈
const ITALIC_LOWER_START = 0x1d622; // 𝘢

const BOLD_ITALIC_UPPER_START = 0x1d63c; // 𝘼
const BOLD_ITALIC_LOWER_START = 0x1d656; // 𝙖

function mapChar(ch: string, mode: "bold" | "italic" | "boldItalic"): string {
  const code = ch.charCodeAt(0);

  if (code >= 65 && code <= 90) {
    // A-Z
    const offset = code - 65;
    const base =
      mode === "bold"
        ? BOLD_UPPER_START
        : mode === "italic"
        ? ITALIC_UPPER_START
        : BOLD_ITALIC_UPPER_START;
    return String.fromCodePoint(base + offset);
  }
  if (code >= 97 && code <= 122) {
    // a-z
    const offset = code - 97;
    const base =
      mode === "bold"
        ? BOLD_LOWER_START
        : mode === "italic"
        ? ITALIC_LOWER_START
        : BOLD_ITALIC_LOWER_START;
    return String.fromCodePoint(base + offset);
  }
  if (code >= 48 && code <= 57 && mode === "bold") {
    // 0-9 (bold only)
    return String.fromCodePoint(BOLD_DIGIT_START + (code - 48));
  }
  return ch;
}

export function stripUnicodeFormatting(text: string): string {
  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= BOLD_UPPER_START && cp <= BOLD_UPPER_START + 25) {
      out += String.fromCharCode(65 + (cp - BOLD_UPPER_START));
    } else if (cp >= BOLD_LOWER_START && cp <= BOLD_LOWER_START + 25) {
      out += String.fromCharCode(97 + (cp - BOLD_LOWER_START));
    } else if (cp >= BOLD_DIGIT_START && cp <= BOLD_DIGIT_START + 9) {
      out += String.fromCharCode(48 + (cp - BOLD_DIGIT_START));
    } else if (cp >= ITALIC_UPPER_START && cp <= ITALIC_UPPER_START + 25) {
      out += String.fromCharCode(65 + (cp - ITALIC_UPPER_START));
    } else if (cp >= ITALIC_LOWER_START && cp <= ITALIC_LOWER_START + 25) {
      out += String.fromCharCode(97 + (cp - ITALIC_LOWER_START));
    } else if (cp >= BOLD_ITALIC_UPPER_START && cp <= BOLD_ITALIC_UPPER_START + 25) {
      out += String.fromCharCode(65 + (cp - BOLD_ITALIC_UPPER_START));
    } else if (cp >= BOLD_ITALIC_LOWER_START && cp <= BOLD_ITALIC_LOWER_START + 25) {
      out += String.fromCharCode(97 + (cp - BOLD_ITALIC_LOWER_START));
    } else {
      out += ch;
    }
  }
  return out.normalize("NFC");
}

export function applyUnicodeStyle(
  text: string,
  mode: "bold" | "italic" | "boldItalic"
): string {
  const plain = stripUnicodeFormatting(text).normalize("NFD");
  let out = "";
  for (const ch of plain) {
    out += mapChar(ch, mode);
  }
  return out;
}

export const toUnicodeBold = (text: string) => applyUnicodeStyle(text, "bold");
export const toUnicodeItalic = (text: string) => applyUnicodeStyle(text, "italic");

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Copies text to clipboard preserving exact line breaks & paragraph spacing
 * in rich-text editors like LinkedIn's "Create a post" modal.
 */
export async function copyPreservingLineBreaks(rawText: string): Promise<boolean> {
  const normalizedPlain = rawText.replace(/\r\n/g, "\n").trim();

  // Build clean HTML paragraphs so rich-text composers (LinkedIn) keep every blank line
  const htmlLines = normalizedPlain
    .split("\n")
    .map((line) => (line.trim() === "" ? "<p><br></p>" : `<p>${escapeHtml(line)}</p>`))
    .join("");

  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof ClipboardItem !== "undefined" &&
      navigator.clipboard.write
    ) {
      const item = new ClipboardItem({
        "text/plain": new Blob([normalizedPlain], { type: "text/plain" }),
        "text/html": new Blob([htmlLines], { type: "text/html" }),
      });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch {
    // fallback to writeText below
  }

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(normalizedPlain);
      return true;
    }
  } catch {
    // fallback to execCommand below
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = normalizedPlain;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export const EMOJI_CATEGORIES: Array<{ label: string; emojis: string[] }> = [
  {
    label: "Gancho e Impacto",
    emojis: ["🚀", "🔥", "⚡", "💡", "🎯", "💥", "✨", "🚨"],
  },
  {
    label: "Negocios y B2B",
    emojis: ["💼", "📈", "📊", "💰", "🤝", "🏢", "🧠", "⚙️"],
  },
  {
    label: "Estructura y Lectura",
    emojis: ["👉", "👇", "✅", "❌", "📌", "🔹", "1️⃣", "2️⃣"],
  },
  {
    label: "Cercanía y Debate",
    emojis: ["👋", "🙌", "💬", "❤️", "🙏", "👀", "🤔", "💪"],
  },
];
