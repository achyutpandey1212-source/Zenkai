import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth-service";
import SignupForm from "./signup-form";

export default async function SignupPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (sessionCookie) {
    const user = await verifySession(sessionCookie);
    if (user) {
      redirect("/app");
    }
  }

  return <SignupForm />;
}
