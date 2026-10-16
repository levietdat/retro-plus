import { GroupEntry } from "@/components/GroupEntry";
import { Header } from "@/components/Header";
import { OrderApp } from "@/components/OrderApp";
import { getMenu } from "@/lib/menu";
import { getPopularItemIds } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const menu = await getMenu();
  const popularIds = await getPopularItemIds(menu).catch(() => []);
  return (
    <>
      <Header />
      <GroupEntry />
      <OrderApp menu={menu} popularIds={popularIds} />
    </>
  );
}
