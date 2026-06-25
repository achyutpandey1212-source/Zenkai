import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth-service";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (sessionCookie) {
    const user = await verifySession(sessionCookie);
    if (user) {
      redirect("/app");
    }
  }

  return <LoginForm />;
}
