import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { accessApi } from "../api/access";
import { authApi } from "../api/auth";
import { healthApi } from "../api/health";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import type { JoinRequest } from "@paperclip/shared";

type JoinType = "human" | "agent";

function dateTime(value: string) {
  return new Date(value).toLocaleString();
}

export function InviteLandingPage() {
  const queryClient = useQueryClient();
  const params = useParams();
  const token = (params.token ?? "").trim();
  const [joinType, setJoinType] = useState<JoinType>("human");
  const [agentName, setAgentName] = useState("");
  const [adapterType, setAdapterType] = useState("");
  const [capabilities, setCapabilities] = useState("");
  const [result, setResult] = useState<{ kind: "bootstrap" | "join"; payload: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const healthQuery = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => healthApi.get(),
    retry: false,
  });
  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });
  const inviteQuery = useQuery({
    queryKey: queryKeys.access.invite(token),
    queryFn: () => accessApi.getInvite(token),
    enabled: token.length > 0,
    retry: false,
  });

  const invite = inviteQuery.data;
  const allowedJoinTypes = invite?.allowedJoinTypes ?? "both";
  const availableJoinTypes = useMemo(() => {
    if (invite?.inviteType === "bootstrap_ceo") return ["human"] as JoinType[];
    if (allowedJoinTypes === "both") return ["human", "agent"] as JoinType[];
    return [allowedJoinTypes] as JoinType[];
  }, [invite?.inviteType, allowedJoinTypes]);

  useEffect(() => {
    if (!availableJoinTypes.includes(joinType)) {
      setJoinType(availableJoinTypes[0] ?? "human");
    }
  }, [availableJoinTypes, joinType]);

  const requiresAuthForHuman =
    joinType === "human" &&
    healthQuery.data?.deploymentMode === "authenticated" &&
    !sessionQuery.data;

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!invite) throw new Error("Invite not found");
      if (invite.inviteType === "bootstrap_ceo") {
        return accessApi.acceptInvite(token, { requestType: "human" });
      }
      if (joinType === "human") {
        return accessApi.acceptInvite(token, { requestType: "human" });
      }
      return accessApi.acceptInvite(token, {
        requestType: "agent",
        agentName: agentName.trim(),
        adapterType: adapterType.trim() || undefined,
        capabilities: capabilities.trim() || null,
      });
    },
    onSuccess: async (payload) => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      const asBootstrap =
        payload && typeof payload === "object" && "bootstrapAccepted" in (payload as Record<string, unknown>);
      setResult({ kind: asBootstrap ? "bootstrap" : "join", payload });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to accept invite");
    },
  });

  if (!token) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-destructive">Invalid invite token.</div>;
  }

  if (inviteQuery.isLoading || healthQuery.isLoading || sessionQuery.isLoading) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-muted-foreground">Loading invite...</div>;
  }

  if (inviteQuery.error || !invite) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-lg font-semibold">Invite not available</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This invite may be expired, revoked, or already used.
          </p>
        </div>
      </div>
    );
  }

  if (result?.kind === "bootstrap") {
    return (
      <div className="mx-auto max-w-xl py-10">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-lg font-semibold">Bootstrap complete</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The first instance admin is now configured. You can continue to the board.
          </p>
          <Button asChild className="mt-4">
            <Link to="/">Open board</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (result?.kind === "join") {
    const payload = result.payload as JoinRequest;
    return (
      <div className="mx-auto max-w-xl py-10">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-lg font-semibold">Join request submitted</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your request is pending admin approval. You will not have access until approved.
          </p>
          <div className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            Request ID: <span className="font-mono">{payload.id}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">
          {invite.inviteType === "bootstrap_ceo" ? "Bootstrap your Paperclip instance" : "Join this Paperclip company"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Invite expires {dateTime(invite.expiresAt)}.</p>

        {invite.inviteType !== "bootstrap_ceo" && (
          <div className="mt-5 flex gap-2">
            {availableJoinTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setJoinType(type)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  joinType === type
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-foreground"
                }`}
              >
                Join as {type}
              </button>
            ))}
          </div>
        )}

        {joinType === "agent" && invite.inviteType !== "bootstrap_ceo" && (
          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Agent name</span>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={agentName}
                onChange={(event) => setAgentName(event.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Adapter type (optional)</span>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={adapterType}
                onChange={(event) => setAdapterType(event.target.value)}
                placeholder="process"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Capabilities (optional)</span>
              <textarea
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                rows={4}
                value={capabilities}
                onChange={(event) => setCapabilities(event.target.value)}
              />
            </label>
          </div>
        )}

        {requiresAuthForHuman && (
          <div className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-sm">
            Sign in or create an account before submitting a human join request.
            <div className="mt-2">
              <Button asChild size="sm" variant="outline">
                <Link to={`/auth?next=${encodeURIComponent(`/invite/${token}`)}`}>Sign in / Create account</Link>
              </Button>
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <Button
          className="mt-5"
          disabled={
            acceptMutation.isPending ||
            (joinType === "agent" && invite.inviteType !== "bootstrap_ceo" && agentName.trim().length === 0) ||
            requiresAuthForHuman
          }
          onClick={() => acceptMutation.mutate()}
        >
          {acceptMutation.isPending
            ? "Submitting..."
            : invite.inviteType === "bootstrap_ceo"
              ? "Accept bootstrap invite"
              : "Submit join request"}
        </Button>
      </div>
    </div>
  );
}
