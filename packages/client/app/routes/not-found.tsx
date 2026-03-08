import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <h1 className="font-display text-6xl font-semibold tracking-tight text-white">
        404
      </h1>
      <p className="mt-3 text-lg text-silver/70">
        This page doesn't exist yet.
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
