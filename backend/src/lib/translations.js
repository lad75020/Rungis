import fs from 'node:fs/promises';

const defaultTranslations = {
  en: {},
  fr: {}
};

export function createTranslationResolver(translationsPath) {
  let cachedTranslations = { ...defaultTranslations };
  let cachedTranslationsMtimeMs = 0;

  return async function getTranslations() {
    try {
      const stats = await fs.stat(translationsPath);
      if (cachedTranslationsMtimeMs === stats.mtimeMs) {
        return cachedTranslations;
      }

      const raw = await fs.readFile(translationsPath, 'utf8');
      const parsed = JSON.parse(raw);
      cachedTranslations = {
        en: parsed?.en ?? {},
        fr: parsed?.fr ?? {}
      };
      cachedTranslationsMtimeMs = stats.mtimeMs;
    } catch {
      // Keep defaults if file is missing or invalid.
    }

    return cachedTranslations;
  };
}