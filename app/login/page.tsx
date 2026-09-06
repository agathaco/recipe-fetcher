import { login } from "@/app/lib/actions";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const { error, from } = await searchParams;

  return (
    <main className="mx-auto max-w-sm px-4 py-24">
      <h1 className="text-xl font-semibold tracking-tight">recipe-fetcher</h1>
      <p className="mt-1 text-sm text-gray-500">Enter the password to continue.</p>

      <form action={login} className="mt-6 space-y-3">
        <input type="hidden" name="from" value={from ?? "/"} />
        <input
          type="password"
          name="password"
          required
          autoFocus
          placeholder="Password"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="w-full rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Sign in
        </button>
        {error && <p className="text-sm text-red-600">Wrong password.</p>}
      </form>
    </main>
  );
}
