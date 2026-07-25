"use client";

import Link from "next/link";

export default function AppError({ error }: { error: Error }) {
  return (
    <div className="card p-6">
      <h1 className="text-lg font-semibold text-stone-900">
        That didn&apos;t work
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        {error.message || "Something went wrong."}
      </p>
      <Link className="btn-secondary mt-4" href="/homes">
        Back to homes
      </Link>
    </div>
  );
}
