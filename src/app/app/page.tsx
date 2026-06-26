import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-service";
import Shell from "@/components/shell";

export default async function AppPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  let initialUser = null;

  if (sessionCookie) {
    const user = await verifySession(sessionCookie);
    if (user) {
      initialUser = {
        name: user.name,
        email: user.email,
        firebaseUid: user.firebaseUid,
      };
    }
  }

  return <Shell initialUser={initialUser} />;
}
