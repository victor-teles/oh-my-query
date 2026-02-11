import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import type { DatabaseConnection } from "@/lib/connections";

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

  const handleSuccess = useCallback(
    (connection: DatabaseConnection) => {
      navigate({
        params: { connectionId: connection.id },
        to: "/workspace/$connectionId",
      });
    },
    [navigate]
  );

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

export const Route = createFileRoute("/_default/onboarding")({
  component: OnboardingComponent,
});
