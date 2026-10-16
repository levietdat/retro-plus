import { Header } from "@/components/Header";
import { OrderStatusView } from "@/components/OrderStatusView";
import { getPaymentInfo } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default function OrderPage({ params }: { params: { code: string } }) {
  return (
    <>
      <Header />
      <OrderStatusView code={decodeURIComponent(params.code)} payment={getPaymentInfo()} />
    </>
  );
}
