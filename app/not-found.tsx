import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />
      <div>
        <p className="tabular text-5xl font-semibold tracking-tight">404</p>
        <h1 className="mt-2 text-lg font-medium">We couldn&apos;t find that page</h1>
        <p className="mt-1 text-sm text-muted-foreground">It may have been moved, deleted, or the link is wrong.</p>
      </div>
      <Link href="/dashboard" className={buttonVariants()}>
        Go to dashboard
      </Link>
    </div>
  );
}
