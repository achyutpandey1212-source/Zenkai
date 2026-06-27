import { notFound } from "next/navigation";
import DeveloperDashboard from "./developer-dashboard";

export const dynamic = "force-dynamic";

export default async function DeveloperPage() {
  // Hard security rule: Never expose developer tools in production environment
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <DeveloperDashboard />;
}
