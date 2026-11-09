import { Link } from "wouter";
import { EmptyState } from "@/components/layout/primitives";

export default function NotFound() {
  return (
    <EmptyState
      className="py-24"
      title="Page not found"
      description="This page does not exist."
      action={
        <Link href="/" className="text-sm text-foreground underline-offset-4 hover:underline">
          Go to Overview
        </Link>
      }
    />
  );
}
