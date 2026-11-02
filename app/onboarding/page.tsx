import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/app/logo";
import { getAuth } from "@/lib/auth";
import { OnboardingWizard } from "./wizard";

export const metadata: Metadata = { title: "Set up your workspace" };

export default async function OnboardingPage() {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  if (auth.org) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-6 py-5">
        <Logo href="/onboarding" />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6">
        <div className="w-full max-w-lg">
          <OnboardingWizard userName={auth.user.name} />
        </div>
      </main>
    </div>
  );
}
