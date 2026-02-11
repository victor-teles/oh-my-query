import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { ConnectionForm } from "@/components/connection-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const OnboardingComponent = () => {
  const navigate = useNavigate();

  const handleSuccess = useCallback(() => {
    navigate({ to: "/" });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Add a connection</CardTitle>
          <CardDescription>
            Connect to a database to start querying.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectionForm onSuccess={handleSuccess} />
        </CardContent>
      </Card>
    </div>
  );
};

export const Route = createFileRoute("/onboarding")({
  component: OnboardingComponent,
});
