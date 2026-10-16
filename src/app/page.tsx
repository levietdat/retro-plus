import { GroupEntry } from "@/components/GroupEntry";
import { Header } from "@/components/Header";
import { OrderApp } from "@/components/OrderApp";
import { getMenu } from "@/lib/menu";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const menu = await getMenu();
  return (
    <>
      <Header />
      <GroupEntry />
      <OrderApp menu={menu} />
    </>
  );
}
