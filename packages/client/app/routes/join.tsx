import { ArrowLeft } from "lucide-react";
import { Link, Navigate, useParams } from "react-router";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { useSessionExists } from "~/hooks/use-sessions";

export default function Join() {
  const { sessionId = "" } = useParams<{ sessionId: string }>();
  const { data, isLoading, isError } = useSessionExists(sessionId);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <Spinner className="size-8 text-steel" />
        <p className="mt-4 text-silver/70">Joining session...</p>
      </div>
    );
  }

  if (data?.exists) {
    return <Navigate to={`/session/${sessionId}`} replace />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-white">
        {isError ? "Something went wrong" : "Session not found"}
      </h1>
      <p className="mt-3 text-lg text-silver/70">
        {isError
          ? "Could not reach the server. Please try again."
          : "This session may have ended or the link is invalid."}
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
