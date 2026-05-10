import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";

export default async function Home() {
  const t = await getTranslations();
  const session = await auth();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-semibold">{t("home.welcome")}</h1>
      <p className="text-base text-gray-600">{t("home.tagline")}</p>

      {session ? (
        <div className="flex flex-col items-center gap-2 text-sm text-gray-700">
          <span>Signed in as {session.user?.email}</span>
          <Link href="/dashboard" className="underline">
            Go to dashboard
          </Link>
        </div>
      ) : (
        <Link
          href="/login"
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white"
        >
          {t("auth.signIn")}
        </Link>
      )}
    </main>
  );
}
