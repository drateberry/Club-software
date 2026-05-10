import { getTranslations } from "next-intl/server";

export default async function VerifyPage() {
  const t = await getTranslations();
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">{t("auth.checkEmail")}</h1>
        <p className="mt-2 text-sm text-gray-600">
          {t("auth.checkEmailDescription")}
        </p>
      </div>
    </main>
  );
}
