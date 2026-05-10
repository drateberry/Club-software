import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth, signIn } from "@/auth";

function safeRedirectTo(raw: string | null | undefined): string {
  if (!raw) return "/";
  // Only allow same-origin paths to prevent open redirects
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const session = await auth();
  const { error, callbackUrl } = await searchParams;
  const target = safeRedirectTo(callbackUrl);
  if (session) redirect(target);

  const t = await getTranslations();

  async function magicLink(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    const cb = safeRedirectTo(String(formData.get("callbackUrl") ?? "/"));
    if (!email) return;
    await signIn("nodemailer", { email, redirectTo: cb });
  }

  async function passwordSignIn(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const cb = safeRedirectTo(String(formData.get("callbackUrl") ?? "/"));
    await signIn("credentials", { email, password, redirectTo: cb });
  }

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold">{t("auth.signIn")}</h1>

        {error && (
          <p className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
            {t("auth.invalidCredentials")}
          </p>
        )}

        <form action={magicLink} className="space-y-3">
          <input type="hidden" name="callbackUrl" value={target} />
          <label className="block text-sm font-medium">
            {t("auth.email")}
            <input
              type="email"
              name="email"
              required
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded bg-black px-4 py-2 text-sm font-medium text-white"
          >
            {t("auth.magicLink")}
          </button>
        </form>

        <div className="flex items-center gap-2 text-xs uppercase text-gray-400">
          <div className="h-px flex-1 bg-gray-200" />
          <span>{t("auth.or")}</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <form action={passwordSignIn} className="space-y-3">
          <input type="hidden" name="callbackUrl" value={target} />
          <label className="block text-sm font-medium">
            {t("auth.email")}
            <input
              type="email"
              name="email"
              required
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            {t("auth.password")}
            <input
              type="password"
              name="password"
              required
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded border border-gray-300 px-4 py-2 text-sm font-medium"
          >
            {t("auth.signIn")}
          </button>
        </form>
      </div>
    </main>
  );
}
