import Link from "next/link";

export function EmptyState({
  title,
  description,
  cta,
}: {
  title: string;
  description?: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
      <h3 className="text-base font-semibold text-gray-700">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>
      )}
      {cta && (
        <Link
          href={cta.href}
          className="mt-4 rounded bg-black px-4 py-2 text-sm font-medium text-white"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
