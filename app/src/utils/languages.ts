/**
 * Comprehensive language list with ISO 639-1 codes and country flags
 * Based on ISO 639-1 standard with common languages
 */

export interface Language {
  code: string; // ISO 639-1 code
  name: string; // English name
  nativeName: string; // Native name
  flag: string; // Country flag emoji (primary country where language is spoken)
  countries: string[]; // Country codes where this language is primarily spoken
}

export const languages: Language[] = [
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸", countries: ["US", "GB", "AU", "CA", "NZ", "IE"] },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸", countries: ["ES", "MX", "AR", "CO", "CL", "PE"] },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷", countries: ["FR", "CA", "BE", "CH", "LU"] },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪", countries: ["DE", "AT", "CH", "LI", "LU"] },
  { code: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹", countries: ["IT", "CH", "SM", "VA"] },
  { code: "pt", name: "Portuguese", nativeName: "Português", flag: "🇵🇹", countries: ["PT", "BR", "AO", "MZ"] },
  { code: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺", countries: ["RU", "BY", "KZ", "KG"] },
  { code: "zh", name: "Chinese", nativeName: "中文", flag: "🇨🇳", countries: ["CN", "TW", "HK", "SG"] },
  { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵", countries: ["JP"] },
  { code: "ko", name: "Korean", nativeName: "한국어", flag: "🇰🇷", countries: ["KR", "KP"] },
  { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦", countries: ["SA", "EG", "AE", "IQ", "DZ"] },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳", countries: ["IN"] },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", flag: "🇳🇱", countries: ["NL", "BE", "SR"] },
  { code: "pl", name: "Polish", nativeName: "Polski", flag: "🇵🇱", countries: ["PL"] },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", flag: "🇹🇷", countries: ["TR", "CY"] },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", flag: "🇻🇳", countries: ["VN"] },
  { code: "th", name: "Thai", nativeName: "ไทย", flag: "🇹🇭", countries: ["TH"] },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", flag: "🇮🇩", countries: ["ID"] },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu", flag: "🇲🇾", countries: ["MY", "SG", "BN"] },
  { code: "cs", name: "Czech", nativeName: "Čeština", flag: "🇨🇿", countries: ["CZ"] },
  { code: "sv", name: "Swedish", nativeName: "Svenska", flag: "🇸🇪", countries: ["SE", "FI"] },
  { code: "no", name: "Norwegian", nativeName: "Norsk", flag: "🇳🇴", countries: ["NO"] },
  { code: "da", name: "Danish", nativeName: "Dansk", flag: "🇩🇰", countries: ["DK"] },
  { code: "fi", name: "Finnish", nativeName: "Suomi", flag: "🇫🇮", countries: ["FI"] },
  { code: "ro", name: "Romanian", nativeName: "Română", flag: "🇷🇴", countries: ["RO", "MD"] },
  { code: "hu", name: "Hungarian", nativeName: "Magyar", flag: "🇭🇺", countries: ["HU"] },
  { code: "el", name: "Greek", nativeName: "Ελληνικά", flag: "🇬🇷", countries: ["GR", "CY"] },
  { code: "he", name: "Hebrew", nativeName: "עברית", flag: "🇮🇱", countries: ["IL"] },
  { code: "uk", name: "Ukrainian", nativeName: "Українська", flag: "🇺🇦", countries: ["UA"] },
  { code: "bg", name: "Bulgarian", nativeName: "Български", flag: "🇧🇬", countries: ["BG"] },
  { code: "hr", name: "Croatian", nativeName: "Hrvatski", flag: "🇭🇷", countries: ["HR"] },
  { code: "sr", name: "Serbian", nativeName: "Српски", flag: "🇷🇸", countries: ["RS", "BA", "ME"] },
  { code: "sk", name: "Slovak", nativeName: "Slovenčina", flag: "🇸🇰", countries: ["SK"] },
  { code: "sl", name: "Slovenian", nativeName: "Slovenščina", flag: "🇸🇮", countries: ["SI"] },
  { code: "et", name: "Estonian", nativeName: "Eesti", flag: "🇪🇪", countries: ["EE"] },
  { code: "lv", name: "Latvian", nativeName: "Latviešu", flag: "🇱🇻", countries: ["LV"] },
  { code: "lt", name: "Lithuanian", nativeName: "Lietuvių", flag: "🇱🇹", countries: ["LT"] },
  { code: "ca", name: "Catalan", nativeName: "Català", flag: "🇪🇸", countries: ["ES"] },
  { code: "eu", name: "Basque", nativeName: "Euskara", flag: "🇪🇸", countries: ["ES"] },
  { code: "gl", name: "Galician", nativeName: "Galego", flag: "🇪🇸", countries: ["ES"] },
  { code: "is", name: "Icelandic", nativeName: "Íslenska", flag: "🇮🇸", countries: ["IS"] },
  { code: "ga", name: "Irish", nativeName: "Gaeilge", flag: "🇮🇪", countries: ["IE"] },
  { code: "mt", name: "Maltese", nativeName: "Malti", flag: "🇲🇹", countries: ["MT"] },
  { code: "mk", name: "Macedonian", nativeName: "Македонски", flag: "🇲🇰", countries: ["MK"] },
  { code: "sq", name: "Albanian", nativeName: "Shqip", flag: "🇦🇱", countries: ["AL", "XK"] },
  { code: "bs", name: "Bosnian", nativeName: "Bosanski", flag: "🇧🇦", countries: ["BA"] },
  { code: "sw", name: "Swahili", nativeName: "Kiswahili", flag: "🇰🇪", countries: ["KE", "TZ", "UG"] },
  { code: "af", name: "Afrikaans", nativeName: "Afrikaans", flag: "🇿🇦", countries: ["ZA", "NA"] },
  { code: "zu", name: "Zulu", nativeName: "isiZulu", flag: "🇿🇦", countries: ["ZA"] },
  { code: "xh", name: "Xhosa", nativeName: "isiXhosa", flag: "🇿🇦", countries: ["ZA"] },
  { code: "fa", name: "Persian", nativeName: "فارسی", flag: "🇮🇷", countries: ["IR", "AF", "TJ"] },
  { code: "ur", name: "Urdu", nativeName: "اردو", flag: "🇵🇰", countries: ["PK", "IN"] },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", flag: "🇧🇩", countries: ["BD", "IN"] },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", flag: "🇮🇳", countries: ["IN", "LK", "SG"] },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", flag: "🇮🇳", countries: ["IN"] },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം", flag: "🇮🇳", countries: ["IN"] },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", flag: "🇮🇳", countries: ["IN"] },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", flag: "🇮🇳", countries: ["IN"] },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", flag: "🇮🇳", countries: ["IN", "PK"] },
  { code: "mr", name: "Marathi", nativeName: "मराठी", flag: "🇮🇳", countries: ["IN"] },
  { code: "ne", name: "Nepali", nativeName: "नेपाली", flag: "🇳🇵", countries: ["NP", "IN"] },
  { code: "si", name: "Sinhala", nativeName: "සිංහල", flag: "🇱🇰", countries: ["LK"] },
  { code: "my", name: "Burmese", nativeName: "မြန်မာ", flag: "🇲🇲", countries: ["MM"] },
  { code: "km", name: "Khmer", nativeName: "ខ្មែរ", flag: "🇰🇭", countries: ["KH"] },
  { code: "lo", name: "Lao", nativeName: "ລາວ", flag: "🇱🇦", countries: ["LA"] },
  { code: "ka", name: "Georgian", nativeName: "ქართული", flag: "🇬🇪", countries: ["GE"] },
  { code: "hy", name: "Armenian", nativeName: "Հայերեն", flag: "🇦🇲", countries: ["AM"] },
  { code: "az", name: "Azerbaijani", nativeName: "Azərbaycan", flag: "🇦🇿", countries: ["AZ"] },
  { code: "kk", name: "Kazakh", nativeName: "Қазақ", flag: "🇰🇿", countries: ["KZ"] },
  { code: "ky", name: "Kyrgyz", nativeName: "Кыргызча", flag: "🇰🇬", countries: ["KG"] },
  { code: "uz", name: "Uzbek", nativeName: "O'zbek", flag: "🇺🇿", countries: ["UZ"] },
  { code: "mn", name: "Mongolian", nativeName: "Монгол", flag: "🇲🇳", countries: ["MN"] },
  { code: "be", name: "Belarusian", nativeName: "Беларуская", flag: "🇧🇾", countries: ["BY"] },
  { code: "am", name: "Amharic", nativeName: "አማርኛ", flag: "🇪🇹", countries: ["ET"] },
  { code: "yo", name: "Yoruba", nativeName: "Yorùbá", flag: "🇳🇬", countries: ["NG"] },
  { code: "ig", name: "Igbo", nativeName: "Asụsụ Igbo", flag: "🇳🇬", countries: ["NG"] },
  { code: "ha", name: "Hausa", nativeName: "Hausa", flag: "🇳🇬", countries: ["NG", "NE"] },
  { code: "pt-BR", name: "Portuguese (Brazil)", nativeName: "Português (Brasil)", flag: "🇧🇷", countries: ["BR"] },
  { code: "zh-CN", name: "Chinese (Simplified)", nativeName: "中文 (简体)", flag: "🇨🇳", countries: ["CN"] },
  { code: "zh-TW", name: "Chinese (Traditional)", nativeName: "中文 (繁體)", flag: "🇹🇼", countries: ["TW"] },
  { code: "es-ES", name: "Spanish (Spain)", nativeName: "Español (España)", flag: "🇪🇸", countries: ["ES"] },
  { code: "es-MX", name: "Spanish (Mexico)", nativeName: "Español (México)", flag: "🇲🇽", countries: ["MX"] },
  { code: "fr-CA", name: "French (Canada)", nativeName: "Français (Canada)", flag: "🇨🇦", countries: ["CA"] },
  { code: "en-US", name: "English (US)", nativeName: "English (US)", flag: "🇺🇸", countries: ["US"] },
  { code: "en-GB", name: "English (UK)", nativeName: "English (UK)", flag: "🇬🇧", countries: ["GB"] },
  { code: "en-AU", name: "English (Australia)", nativeName: "English (Australia)", flag: "🇦🇺", countries: ["AU"] },
];

/**
 * Get language by code
 */
export function getLanguageByCode(code: string): Language | undefined {
  return languages.find((lang) => lang.code === code);
}

/**
 * Search languages by query (searches in name, nativeName, and code)
 */
export function searchLanguages(query: string): Language[] {
  if (!query.trim()) {
    return languages;
  }

  const lowerQuery = query.toLowerCase().trim();
  
  return languages.filter((lang) => {
    return (
      lang.code.toLowerCase().includes(lowerQuery) ||
      lang.name.toLowerCase().includes(lowerQuery) ||
      lang.nativeName.toLowerCase().includes(lowerQuery) ||
      lang.countries.some((country) => country.toLowerCase().includes(lowerQuery))
    );
  });
}

/**
 * Get all language codes
 */
export function getAllLanguageCodes(): string[] {
  return languages.map((lang) => lang.code);
}

