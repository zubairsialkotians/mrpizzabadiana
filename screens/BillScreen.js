import React, { useMemo } from 'react';
import DocPreview from '../components/DocPreview';
import { useLoad } from '../components/useData';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';
import { buildBill } from '../services/documents';

/*
  Bill for one order: preview, then share as PDF or image.
  Staff: any order of their branch. Customer: their own order. Guest: params.key (order access key).
*/
export default function BillScreen({ route }) {
  const { shop, isStaff } = useAuth();
  const { id, key } = route.params;
  const { data: order, loading, error, reload } = useLoad(
    () => (isStaff ? api.adminOrder(id) : key ? api.trackOrder(id, key) : api.myOrder(id)).then((r) => r.order),
    [id, key, isStaff],
  );
  const model = useMemo(() => (order ? buildBill(order, shop) : null), [order, shop]);

  return (
    <DocPreview
      title="Bill"
      subtitle={order ? `${order.order_no} · ${order.name}` : ''}
      model={model}
      fileName={order ? `Bill-${order.order_no}-${order.name}` : 'Bill'}
      loading={loading}
      error={error}
      onRetry={reload}
    />
  );
}
