import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { apiClient } from "~/lib/api-client";
import { sessionExistsSchema, sessionSchema } from "~/lib/schemas";

export function useSessionExists(sessionId: string) {
  return useQuery({
    queryKey: ["session-exists", sessionId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/sessions/${sessionId}/exists`);
      return sessionExistsSchema.parse(data);
    },
    enabled: sessionId.length > 0,
  });
}

interface CreateSessionParams {
  title?: string;
  displayName: string;
}

export function useCreateSession() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async ({ title }: CreateSessionParams) => {
      const { data } = await apiClient.post("/api/sessions", { title });
      return sessionSchema.parse(data);
    },
    onSuccess: (session, { displayName }) => {
      navigate(`/session/${session.id}`, { state: { displayName } });
    },
  });
}
