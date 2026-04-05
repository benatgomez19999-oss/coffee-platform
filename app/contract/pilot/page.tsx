"use client"

import dynamic from "next/dynamic"

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet
} from "@react-pdf/renderer"

import { getContracts } from "@/src/clientLayer/layer/contractStore"

// ======================================================
// 🔥 FIX: PDFViewer SOLO EN CLIENT (NO SSR)
// ======================================================

const PDFViewer = dynamic(
  () =>
    import("@react-pdf/renderer").then(
      (mod) => mod.PDFViewer
    ),
  { ssr: false }
)


// ======================================================
// STYLES
// ======================================================

const styles = StyleSheet.create({

  page: {
    padding: 40
  },

  title: {
    fontSize: 24,
    marginBottom: 20
  },

  section: {
    marginBottom: 10
  }

})


// ======================================================
// PAGE
// ======================================================

export default function ContractPage() {

  const contracts = getContracts()

  // ======================================================
  // USE ACTIVE CONTRACT OR DEFAULT PILOT
  // ======================================================

  const monthly = contracts.length
    ? contracts[0].monthlyVolumeKg
    : 400

  const duration = 9

  const total = monthly * duration


  return (

    <PDFViewer
      style={{
        width: "100%",
        height: "100vh"
      }}
    >

      <Document>

        <Page size="A4" style={styles.page}>

          <Text style={styles.title}>
            Pilot Coffee Supply Agreement
          </Text>

          <View style={styles.section}>
            <Text>Product: Specialty Coffee Beans</Text>
          </View>

          <View style={styles.section}>
            <Text>Monthly Volume: {monthly} kg</Text>
          </View>

          <View style={styles.section}>
            <Text>Duration: {duration} months</Text>
          </View>

          <View style={styles.section}>
            <Text>Total Supply: {total} kg</Text>
          </View>

        </Page>

      </Document>

    </PDFViewer>

  )

}