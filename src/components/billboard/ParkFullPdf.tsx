import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import type { PdfPhoto } from '@/lib/pdf-photo'

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: 'Helvetica' },
  title: { fontSize: 18, marginBottom: 12, color: '#1e3a8a' },
  section: { marginBottom: 16 },
  label: { color: '#64748b', fontSize: 9 },
  photo: { width: '100%', height: 200, objectFit: 'cover', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  sectionTitle: { fontSize: 14, marginBottom: 8, color: '#1e3a8a' },
  footer: { position: 'absolute', bottom: 16, right: 32, fontSize: 8, color: '#94a3b8' },
})

export type ParkFullBillboard = {
  reference: string
  regionName: string
  districtName: string
  dimension: string
  sides: number
  status: string
  photo: PdfPhoto | null
  permitNumber: string | null
  taxPaymentRef: string | null
  occupancies: {
    clientName: string
    face: string
    numero: string | null
    endDate: string | null
  }[]
  maintenanceRecords: { date: string; type: string; comment: string | null }[]
}

export function ParkFullPdf({
  billboards,
  generatedAt,
}: {
  billboards: ParkFullBillboard[]
  generatedAt: string
}) {
  return (
    <Document>
      {billboards.map((data, i) => (
        <Page key={i} size="A4" style={styles.page}>
          <Text style={styles.title}>{data.reference}</Text>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
          {data.photo && <Image src={data.photo} style={styles.photo} />}

          <View style={styles.section}>
            <View style={styles.row}>
              <Text style={styles.label}>Région / District</Text>
              <Text>{data.regionName} — {data.districtName}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Dimensions</Text>
              <Text>{data.dimension}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Faces</Text>
              <Text>{data.sides}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Statut</Text>
              <Text>{data.status}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Autorisation</Text>
              <Text>{data.permitNumber ?? '—'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Taxe communale</Text>
              <Text>{data.taxPaymentRef ?? 'Non payée'}</Text>
            </View>
          </View>

          {data.occupancies.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contrats</Text>
              {data.occupancies.map((o, j) => (
                <View key={j} style={styles.row}>
                  <Text>
                    {o.face} — {o.clientName}
                  </Text>
                  <Text>
                    {o.numero ?? 'Sans référence'}
                    {o.endDate ? ` (jusqu'au ${o.endDate})` : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {data.maintenanceRecords.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Entretien</Text>
              {data.maintenanceRecords.map((m, j) => (
                <View key={j} style={styles.row}>
                  <Text>
                    {m.date} — {m.type}
                  </Text>
                  <Text>{m.comment ?? ''}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.footer}>
            Généré le {generatedAt} — {i + 1}/{billboards.length}
          </Text>
        </Page>
      ))}
    </Document>
  )
}
