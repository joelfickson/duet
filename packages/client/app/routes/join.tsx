import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export default function Join() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "not-found" | "error">(
    "loading",
  );

  useEffect(() => {
    if (!sessionId) {
      setStatus("not-found");
      return;
    }

    fetch(`${API_URL}/api/sessions/${sessionId}/exists`)
      .then((res) => res.json())
      .then((data: { exists: boolean }) => {
        if (data.exists) {
          navigate(`/session/${sessionId}`, { replace: true });
        } else {
          setStatus("not-found");
        }
      })
      .catch(() => {
        setStatus("error");
      });
  }, [sessionId, navigate]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <Spinner className="size-8 text-steel" />
        <p className="mt-4 text-silver/70">Joining session...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-white">
        {status === "not-found" ? "Session not found" : "Something went wrong"}
      </h1>
      <p className="mt-3 text-lg text-silver/70">
        {status === "not-found"
          ? "This session may have ended or the link is invalid."
          : "Could not reach the server. Please try again."}
      </p>
      <Button asChild variant="outline" className="mt-8 gap-2">
        <Link to="/">
          <ArrowLeft className="size-4" />
          Back to home
        </Link>
      </Button>
    </div>
  );
}
