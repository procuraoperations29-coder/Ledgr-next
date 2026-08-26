import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import type { ManagementAccountData } from '@/lib/accounting/management';

// Helvetica (the @react-pdf default) has no ₦ glyph, so format with the ISO
// code for the PDF to avoid tofu.
function money(minor: number, currency: string): string {
  const major = minor / 100;
  const n = new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(major));
  return `${major < 0 ? '-' : ''}${currency} ${n}`;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: '#0f1a1f', fontFamily: 'Helvetica' },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  brand: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#0b6b4f' },
  business: { fontSize: 18, fontFamily: 'Helvetica-Bold' },
  meta: { fontSize: 9, color: '#5b6b70', marginTop: 2 },
  sectionTitle: {
    fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 18, marginBottom: 6,
    paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#d8e0e0',
  },
  cardsRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  card: { flex: 1, borderWidth: 1, borderColor: '#d8e0e0', borderRadius: 6, padding: 8 },
  cardLabel: { fontSize: 8, color: '#5b6b70' },
  cardValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  rowStrong: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4,
    borderTopWidth: 1, borderTopColor: '#d8e0e0', fontFamily: 'Helvetica-Bold',
  },
  label: { color: '#37474a' },
  value: { fontFamily: 'Helvetica' },
  bullet: { flexDirection: 'row', marginBottom: 3 },
  bulletDot: { width: 10, color: '#0b6b4f' },
  columns: { flexDirection: 'row', gap: 16 },
  col: { flex: 1 },
  footer: { position: 'absolute', bottom: 28, left: 40, right: 40, fontSize: 8, color: '#8a999e', textAlign: 'center' },
});

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={strong ? styles.rowStrong : styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function ManagementAccountDocument({ data }: { data: ManagementAccountData }) {
  const c = data.currency;
  return (
    <Document title={`Management Account — ${data.businessName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.brandRow}>
          <View>
            <Text style={styles.business}>{data.businessName}</Text>
            <Text style={styles.meta}>Management Account</Text>
            <Text style={styles.meta}>{data.periodLabel}</Text>
          </View>
          <Text style={styles.brand}>Ledgr</Text>
        </View>

        <Text style={styles.sectionTitle}>Executive Summary</Text>
        <View style={styles.cardsRow}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Revenue</Text>
            <Text style={styles.cardValue}>{money(data.pl.revenue, c)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Gross Profit</Text>
            <Text style={styles.cardValue}>{money(data.pl.grossProfit, c)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Net Profit</Text>
            <Text style={styles.cardValue}>{money(data.pl.netProfit, c)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Cash</Text>
            <Text style={styles.cardValue}>{money(data.cash, c)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Management Commentary</Text>
        <Text style={{ marginBottom: 6 }}>{data.summary.headline}</Text>
        {data.summary.insights.map((ins, i) => (
          <View key={i} style={styles.bullet}>
            <Text style={styles.bulletDot}>•</Text>
            <Text>{ins.text}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Profit &amp; Loss</Text>
        <Row label="Revenue" value={money(data.pl.revenue, c)} />
        <Row label="Cost of sales" value={money(data.pl.costOfSales, c)} />
        <Row label="Gross profit" value={money(data.pl.grossProfit, c)} strong />
        <Row label="Operating expenses" value={money(data.pl.operatingExpenses, c)} />
        <Row label="EBITDA" value={money(data.metrics.ebitda, c)} />
        <Row label="Operating profit" value={money(data.pl.operatingProfit, c)} strong />
        {data.pl.financeCosts > 0 && (
          <Row label="Finance costs" value={money(data.pl.financeCosts, c)} />
        )}
        {data.pl.tax > 0 && <Row label="Tax" value={money(data.pl.tax, c)} />}
        <Row label="Net profit" value={money(data.pl.netProfit, c)} strong />

        <View style={styles.columns}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Balance Sheet</Text>
            <Row label="Total assets" value={money(data.balanceSheet.assets, c)} />
            <Row label="Total liabilities" value={money(data.balanceSheet.liabilities, c)} />
            <Row label="Total equity" value={money(data.balanceSheet.equity, c)} strong />
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Cash Flow</Text>
            <Row label="Opening cash" value={money(data.cashFlow.openingCash, c)} />
            <Row label="Net movement" value={money(data.cashFlow.netCashFlow, c)} />
            <Row label="Closing cash" value={money(data.cashFlow.closingCash, c)} strong />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Working Capital</Text>
        <Row label="Customers owe you (receivables)" value={money(data.receivables, c)} />
        <Row label="You owe suppliers (payables)" value={money(data.payables, c)} />

        <Text style={styles.footer}>
          Prepared by Ledgr · {data.businessName} · This report is derived from your
          accounting records.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderManagementAccountPdf(
  data: ManagementAccountData
): Promise<Buffer> {
  return renderToBuffer(<ManagementAccountDocument data={data} />);
}
