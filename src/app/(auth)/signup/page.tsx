import { SignUp } from "@clerk/nextjs";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <SignUp forceRedirectUrl="/onboarding" />
    </div>
  );
}
