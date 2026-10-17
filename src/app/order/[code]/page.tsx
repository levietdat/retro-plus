import { Header } from "@/components/Header";
import { OrderStatusView } from "@/components/OrderStatusView";
import { ORDER_KEY_PARAM, SHOP_NAME } from "@/lib/constants";
import { getPaymentInfo } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: `Đơn của bạn · ${SHOP_NAME}`, robots: { index: false, follow: false } };

interface Props {
  params: { code: string };
  searchParams: Record<string, string | string[] | undefined>;
}

export default function OrderPage({ params, searchParams }: Props) {
  const raw = searchParams[ORDER_KEY_PARAM];
  const viewKey = (Array.isArray(raw) ? raw[0] : raw) || "";
  return (
    <>
      <Header />
      <OrderStatusView code={decodeURIComponent(params.code)} viewKey={viewKey} payment={getPaymentInfo()} />
    </>
  );
}
