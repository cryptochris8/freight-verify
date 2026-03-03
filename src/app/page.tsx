import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import LandingPage from "./(marketing)/landing";

export default async function RootPage() {
  try {
    const { userId } = await auth();
    if (userId) {
      redirect("/loads");
    }
  } catch {
    // Auth not available, show marketing page
  }

  return <LandingPage />;
}
