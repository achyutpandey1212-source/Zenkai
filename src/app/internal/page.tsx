import { cookies } from "next/headers";
import AdminConsole from "./admin-console";

export const dynamic = "force-dynamic";

export default async function Page() {
  const cookieStore = await cookies();
  const internalSession = cookieStore.get("internal_session")?.value;
  const adminKey = process.env.INTERNAL_ADMIN_KEY;
  const isAuthenticated = !!(adminKey && internalSession === adminKey);

  return <AdminConsole initialAuthenticated={isAuthenticated} />;
}
