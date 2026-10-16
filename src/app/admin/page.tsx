import { redirect } from "next/navigation";
import { AdminBoard } from "@/components/AdminBoard";
import { isAdminRequest } from "@/lib/auth";
import { ROUTES, SHOP_NAME } from "@/lib/constants";
import { getMenu } from "@/lib/menu";

export const dynamic = "force-dynamic";
export const metadata = { title: `Quầy · ${SHOP_NAME}`, robots: { index: false } };

export default async function AdminPage() {
  if (!isAdminRequest()) redirect(ROUTES.adminLogin);
  return <AdminBoard menu={await getMenu()} />;
}
