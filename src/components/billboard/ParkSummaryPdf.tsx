import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 8, fontFamily: 'Helvetica' },
  title: { fontSize: 16, marginBottom: 8, color: '#1e3a8a' },
  subtitle: { fontSize: 10, marginBottom: 12, color: '#64748b' },
  table: { width: '100%' },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottom: '1 solid #cbd5e1',
    paddingVertical: 4,
  },
  row: { flexDirection: 'row', borderBottom: '0.5 solid #e2e8f0', paddingVertical: 3 },
  cell: { paddingHorizontal: 4 },
  colRef: { width: '12%' },
  colLocation: { width: '14%' },
  colDim: { width: '10%' },
  colSides: { width: '7%' },
  colStatus: { width: '12%' },
  colClient: { width: '18%' },
  colPermit: { width: '12%' },
  colTax: { width: '15%' },
  headerText: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#334155' },
})

export type ParkSummaryRow = {
  reference: string
  regionName: string
  districtName: string
  dimension: string
  sides: number
  status: string
  activeClients: string
  permitNumber: string | null
  taxPaymentRef: string | null
}

export function ParkSummaryPdf({
  rows,
  generatedAt,
}: {
  rows: ParkSummaryRow[]
  generatedAt: string
}) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Parc de panneaux — Récapitulatif</Text>
        <Text style={styles.subtitle}>
          {rows.length} panneaux — généré le {generatedAt}
        </Text>

        <View style={styles.table}>
          <View style={styles.headerRow}>
            <View style={[styles.cell, styles.colRef]}>
              <Text style={styles.headerText}>Identifiant</Text>
            </View>
            <View style={[styles.cell, styles.colLocation]}>
              <Text style={styles.headerText}>Région / District</Text>
            </View>
            <View style={[styles.cell, styles.colDim]}>
              <Text style={styles.headerText}>Dimension</Text>
            </View>
            <View style={[styles.cell, styles.colSides]}>
              <Text style={styles.headerText}>Faces</Text>
            </View>
            <View style={[styles.cell, styles.colStatus]}>
              <Text style={styles.headerText}>Statut</Text>
            </View>
            <View style={[styles.cell, styles.colClient]}>
              <Text style={styles.headerText}>Client(s)</Text>
            </View>
            <View style={[styles.cell, styles.colPermit]}>
              <Text style={styles.headerText}>Autorisation</Text>
            </View>
            <View style={[styles.cell, styles.colTax]}>
              <Text style={styles.headerText}>Taxe</Text>
            </View>
          </View>
          {rows.map((r, i) => (
            <View key={i} style={styles.row} wrap={false}>
              <View style={[styles.cell, styles.colRef]}>
                <Text>{r.reference}</Text>
              </View>
              <View style={[styles.cell, styles.colLocation]}>
                <Text>{r.regionName} — {r.districtName}</Text>
              </View>
              <View style={[styles.cell, styles.colDim]}>
                <Text>{r.dimension}</Text>
              </View>
              <View style={[styles.cell, styles.colSides]}>
                <Text>{r.sides}</Text>
              </View>
              <View style={[styles.cell, styles.colStatus]}>
                <Text>{r.status}</Text>
              </View>
              <View style={[styles.cell, styles.colClient]}>
                <Text>{r.activeClients || '—'}</Text>
              </View>
              <View style={[styles.cell, styles.colPermit]}>
                <Text>{r.permitNumber ?? '—'}</Text>
              </View>
              <View style={[styles.cell, styles.colTax]}>
                <Text>{r.taxPaymentRef ?? 'Non payée'}</Text>
              </View>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  )
}
