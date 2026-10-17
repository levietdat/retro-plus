import { GroupEntry } from "@/components/GroupEntry";
import { Header } from "@/components/Header";
import { OrderApp } from "@/components/OrderApp";
import { getMenu } from "@/lib/menu";
import { getPopularItemIds } from "@/lib/orders";

// Same HTML for every visitor (personal bits load in the browser), so serve it from the CDN
// and rebuild every few minutes. Faster first paint after scanning the table QR.
// Next.js needs a literal here (seconds).
export const revalidate = 300;

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
