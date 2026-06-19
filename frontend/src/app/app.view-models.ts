import type {
  AdminActivatedOrderStat,
  CartData,
  CartGroupBy,
  VendorCategorySalesStat,
  VendorClientSalesStat
} from './app.types';

export function buildActivatedOrdersChart(rows: AdminActivatedOrderStat[]) {
  if (rows.length === 0) {
    return null;
  }

  const width = 860;
  const height = 320;
  const marginLeft = 48;
  const marginRight = 56;
  const marginTop = 20;
  const marginBottom = 34;
  const plotWidth = width - marginLeft - marginRight;
  const plotHeight = height - marginTop - marginBottom;
  const maxOrderCount = Math.max(1, ...rows.map((row) => Number(row.orderCount ?? 0)));
  const maxTotalAmount = Math.max(1, ...rows.map((row) => Number(row.totalAmount ?? 0)));
  const xDenominator = Math.max(1, rows.length - 1);

  const countPoints = rows.map((row, index) => {
    const x = marginLeft + (index / xDenominator) * plotWidth;
    const y = marginTop + (1 - Number(row.orderCount ?? 0) / maxOrderCount) * plotHeight;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const amountPoints = rows.map((row, index) => {
    const x = marginLeft + (index / xDenominator) * plotWidth;
    const y = marginTop + (1 - Number(row.totalAmount ?? 0) / maxTotalAmount) * plotHeight;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const tickCount = 4;
  const leftTicks = Array.from({ length: tickCount + 1 }, (_unused, index) => {
    const ratio = index / tickCount;
    const y = marginTop + (1 - ratio) * plotHeight;
    const value = Math.round(ratio * maxOrderCount);
    return { y, label: String(value) };
  });

  const rightTicks = Array.from({ length: tickCount + 1 }, (_unused, index) => {
    const ratio = index / tickCount;
    const y = marginTop + (1 - ratio) * plotHeight;
    const value = ratio * maxTotalAmount;
    return { y, label: value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) };
  });

  return {
    width,
    height,
    marginLeft,
    marginRight,
    marginTop,
    marginBottom,
    countPolyline: countPoints.join(' '),
    amountPolyline: amountPoints.join(' '),
    firstDay: rows[0].day,
    lastDay: rows[rows.length - 1].day,
    maxOrderCount,
    maxTotalAmount,
    leftTicks,
    rightTicks
  };
}

export function buildVendorCategorySalesPie(rows: VendorCategorySalesStat[]) {
  const positiveRows = rows.filter((row) => Number(row.totalAmount ?? 0) > 0);
  if (positiveRows.length === 0) {
    return null;
  }

  const totalAmount = positiveRows.reduce((sum, row) => sum + Number(row.totalAmount ?? 0), 0);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return null;
  }

  const colors = ['#0d6efd', '#198754', '#dc3545', '#fd7e14', '#6f42c1', '#20c997', '#d63384', '#ffc107'];
  const width = 420;
  const height = 300;
  const cx = 150;
  const cy = 150;
  const radius = 110;

  let startAngle = -Math.PI / 2;
  const slices = positiveRows.map((row, index) => {
    const amount = Number(row.totalAmount ?? 0);
    const ratio = amount / totalAmount;
    const angle = ratio * Math.PI * 2;
    const endAngle = startAngle + angle;
    const color = colors[index % colors.length];

    const slice = {
      category: row.category,
      amount,
      percent: ratio * 100,
      currency: row.currency,
      color,
      path: '',
      fullCircle: false
    };

    if (positiveRows.length === 1) {
      slice.fullCircle = true;
    } else {
      const x1 = cx + radius * Math.cos(startAngle);
      const y1 = cy + radius * Math.sin(startAngle);
      const x2 = cx + radius * Math.cos(endAngle);
      const y2 = cy + radius * Math.sin(endAngle);
      const largeArcFlag = angle > Math.PI ? 1 : 0;
      slice.path = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
    }

    startAngle = endAngle;
    return slice;
  });

  return {
    width,
    height,
    cx,
    cy,
    radius,
    totalAmount: Number(totalAmount.toFixed(2)),
    slices
  };
}

export function buildVendorClientSalesBarChart(rows: VendorClientSalesStat[]) {
  const positiveRows = rows.filter((row) => Number(row.totalAmount ?? 0) > 0);
  if (positiveRows.length === 0) {
    return null;
  }

  const width = 860;
  const height = 360;
  const marginLeft = 56;
  const marginRight = 20;
  const marginTop = 20;
  const marginBottom = 90;
  const plotWidth = width - marginLeft - marginRight;
  const plotHeight = height - marginTop - marginBottom;
  const maxAmount = Math.max(1, ...positiveRows.map((row) => Number(row.totalAmount ?? 0)));
  const barGap = 8;
  const barWidth = Math.max(10, (plotWidth - barGap * (positiveRows.length - 1)) / positiveRows.length);

  const bars = positiveRows.map((row, index) => {
    const x = marginLeft + index * (barWidth + barGap);
    const value = Number(row.totalAmount ?? 0);
    const barHeight = (value / maxAmount) * plotHeight;
    const y = marginTop + (plotHeight - barHeight);
    const label = row.clientName.length > 18 ? `${row.clientName.slice(0, 15)}...` : row.clientName;
    return {
      clientId: row.clientId,
      clientName: row.clientName,
      label,
      amount: value,
      x,
      y,
      width: barWidth,
      height: barHeight
    };
  });

  const yTicks = Array.from({ length: 5 }, (_unused, index) => {
    const ratio = index / 4;
    const y = marginTop + (1 - ratio) * plotHeight;
    const value = ratio * maxAmount;
    return {
      y,
      label: value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    };
  });

  return {
    width,
    height,
    marginLeft,
    marginRight,
    marginTop,
    marginBottom,
    plotHeight,
    bars,
    yTicks
  };
}

export function buildLocalCartAggregates(cart: CartData, groupBy: CartGroupBy) {
  const groups = new Map<string, { key: string; label: string; total: number; totalIncludingVat: number }>();

  for (const item of cart.items) {
    const key = groupBy === 'vendor' ? item.vendorId : item.category;
    const label = groupBy === 'vendor' ? item.vendorName : item.category;
    const current = groups.get(key);

    const lineTotalIncludingVat = item.lineTotalIncludingVat ?? item.lineTotal;

    if (current) {
      current.total = Number((current.total + item.lineTotal).toFixed(2));
      current.totalIncludingVat = Number((current.totalIncludingVat + lineTotalIncludingVat).toFixed(2));
    } else {
      groups.set(key, {
        key,
        label,
        total: Number(item.lineTotal.toFixed(2)),
        totalIncludingVat: Number(lineTotalIncludingVat.toFixed(2))
      });
    }
  }

  return Array.from(groups.values()).sort((left, right) => left.label.localeCompare(right.label));
}
