import { getRequestConfig } from "next-intl/server";

const SUPPORTED_LOCALES = ["en-US"] as const;
const DEFAULT_LOCALE = "en-US";

export default getRequestConfig(async () => {
  const locale = DEFAULT_LOCALE;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});

export { SUPPORTED_LOCALES, DEFAULT_LOCALE };
