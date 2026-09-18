import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/app/lib/actions";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string; email?: string }>;
}) {
  const { error, from, email } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-12">
      <Card className="[--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="text-brand text-xl">recipe-fetcher</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={login} className="space-y-4">
            <input type="hidden" name="from" value={from ?? "/"} />
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                // Remounts whenever `email` changes (e.g. a failed login
                // redirects here with ?email=... pre-filled) so defaultValue
                // is only ever set once per mount, never changed after init.
                // Base UI's Input warns on that otherwise ("changing the
                // default value state of an uncontrolled FieldControl").
                key={email ?? "empty"}
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                defaultValue={email}
                required
                autoFocus={!email}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                name="password"
                autoComplete="current-password"
                required
                // After a failed attempt the email is pre-filled (see the
                // login action), so focus goes straight to the field that
                // actually needs retyping instead of back to the start.
                autoFocus={!!email}
              />
            </div>
            {error && (
              <p className="text-destructive text-sm">Wrong email or password.</p>
            )}
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
          <p className="text-muted-foreground mt-4 text-center text-sm">
            No account yet?{" "}
            <Link href="/signup" className="text-primary underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
