"use client";

import { TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card>
      <EmptyState
        icon={<TriangleAlert />}
        title="Something went wrong"
        description="We couldn't load this page. Check your connection and try again."
        action={<Button onClick={reset}>Try again</Button>}
      />
    </Card>
  );
}
