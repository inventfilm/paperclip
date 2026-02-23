import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "../api/auth";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";

type AuthMode = "sign_in" | "sign_up";

export function AuthPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const nextPath = useMemo(() => searchParams.get("next") || "/", [searchParams]);
  const { data: session, isLoading: isSessionLoading } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });

  useEffect(() => {
    if (session) {
      navigate(nextPath, { replace: true });
    }
  }, [session, navigate, nextPath]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "sign_in") {
        await authApi.signInEmail({ email: email.trim(), password });
        return;
      }
      await authApi.signUpEmail({
        name: name.trim(),
        email: email.trim(),
        password,
      });
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      navigate(nextPath, { replace: true });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Authentication failed");
    },
  });

  const canSubmit =
    email.trim().length > 0 &&
    password.trim().length >= 8 &&
    (mode === "sign_in" || name.trim().length > 0);

  if (isSessionLoading) {
    return <div className="mx-auto max-w-md py-16 text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-md py-10">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold">
          {mode === "sign_in" ? "Sign in to Paperclip" : "Create your Paperclip account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "sign_in"
            ? "Use your email and password to access this instance."
            : "Create an account for this instance. Email confirmation is not required in v1."}
        </p>

        <form
          className="mt-5 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          {mode === "sign_up" && (
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Name</span>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Email</span>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Password</span>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
            />
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={!canSubmit || mutation.isPending} className="w-full">
            {mutation.isPending
              ? "Working..."
              : mode === "sign_in"
                ? "Sign In"
                : "Create Account"}
          </Button>
        </form>

        <div className="mt-4 text-sm text-muted-foreground">
          {mode === "sign_in" ? "Need an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="font-medium text-foreground underline underline-offset-2"
            onClick={() => {
              setError(null);
              setMode(mode === "sign_in" ? "sign_up" : "sign_in");
            }}
          >
            {mode === "sign_in" ? "Create one" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
