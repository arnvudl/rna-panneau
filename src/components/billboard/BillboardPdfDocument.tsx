import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: 'Helvetica' },
  title: { fontSize: 18, marginBottom: 12, color: '#1e3a8a' },
  section: { marginBottom: 16 },
  label: { color: '#64748b', fontSize: 9 },
  photo: { width: '100%', height: 200, objectFit: 'cover', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
})

export type BillboardPdfData = {
  reference: string
  city: string
  dimension: string
  sides: number
  status: string
  photoUrl: string | null
  permitNumber: string | null
  taxPaymentRef: string | null
  occupancies: { clientName: string; face: string; contractRef: string | null; endDate: string | null }[]
  maintenanceRecords: { date: string; type: string; comment: string | null }[]
}

export function BillboardPdfDocument({ data }: { data: BillboardPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{data.reference}</Text>
        {data.photoUrl && <Image src={data.photoUrl} style={styles.photo} />}

        <View style={styles.section}>
          <View style={styles.row}><Text style={styles.label}>Ville</Text><Text>{data.city}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Dimensions</Text><Text>{data.dimension}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Faces</Text><Text>{data.sides}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Statut</Text><Text>{data.status}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Autorisation</Text><Text>{data.permitNumber ?? '—'}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Taxe communale</Text><Text>{data.taxPaymentRef ?? 'Non payée'}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>Historique des contrats</Text>
          {data.occupancies.map((o, i) => (
            <View key={i} style={styles.row}>
              <Text>{o.face} — {o.clientName}</Text>
              <Text>{o.contractRef ?? 'Sans référence'}{o.endDate ? ` (jusqu'au ${o.endDate})` : ''}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>Entretien</Text>
          {data.maintenanceRecords.map((m, i) => (
            <View key={i} style={styles.row}>
              <Text>{m.date} — {m.type}</Text>
              <Text>{m.comment ?? ''}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  )
}
