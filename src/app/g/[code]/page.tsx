import { GroupApp } from "@/components/GroupApp";
import { Header } from "@/components/Header";
import { SHOP_NAME } from "@/lib/constants";
import { normalizeGroupCode } from "@/lib/groups";
import { getMenu } from "@/lib/menu";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { code: string } }) {
  return { title: `Đơn nhóm ${normalizeGroupCode(params.code)} · ${SHOP_NAME}` };
}

export default async function GroupPage({ params }: { params: { code: string } }) {
  const menu = await getMenu();
  return (
    <>
      <Header />
      <GroupApp code={normalizeGroupCode(decodeURIComponent(params.code))} menu={menu} />
    </>
  );
}
