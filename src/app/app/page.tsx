import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth-service";
import Shell from "@/components/shell";

export default async function AppPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    redirect("/login");
  }

  const user = await verifySession(sessionCookie);
  if (!user) {
    redirect("/login");
  }

  const initialUser = {
    name: user.name,
    email: user.email,
    firebaseUid: user.firebaseUid,
    onboardingCompleted: user.onboardingCompleted,
  };

  return <Shell initialUser={initialUser} />;
}
