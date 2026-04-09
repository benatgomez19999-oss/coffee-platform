import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf
} from "@react-pdf/renderer"


// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({

  page: {
    padding: 50,
    fontSize: 11,
    lineHeight: 1.5
  },

  header: {
    marginBottom: 30
  },

  title: {
    fontSize: 22,
    marginBottom: 6
  },

  subtitle: {
    fontSize: 12,
    color: "#555"
  },

  section: {
    marginBottom: 16
  },

  sectionTitle: {
    fontSize: 13,
    marginBottom: 6
  },

  paragraph: {
    marginBottom: 6
  },

  divider: {
    marginVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd"
  }

})


// =====================================================
// TYPES
// =====================================================

type ContractData = {

  version: number
  product: string
  monthlyVolumeKg: number
  durationMonths: number
  lotName?: string
  farmName?: string
  pricePerKg?: number

}


// =====================================================
// PDF GENERATOR
// =====================================================

export async function generateContractPDF(contract: ContractData) {

  const total = contract.monthlyVolumeKg * contract.durationMonths

  const doc = (

    <Document>

      <Page size="A4" style={styles.page}>

        {/* =================================================
           HEADER
        ================================================= */}

        <View style={styles.header}>

          <Text style={styles.title}>
            Pilot Coffee Supply Agreement
          </Text>

          <Text style={styles.subtitle}>
            Contract Version {contract.version}
          </Text>

        </View>


        {/* =================================================
           CONTRACT SUMMARY
        ================================================= */}

        <View style={styles.section}>

          <Text style={styles.sectionTitle}>
            1. Contract Summary
          </Text>

          <Text style={styles.paragraph}>
            Product: {contract.product}
          </Text>

          {contract.lotName && (
            <Text style={styles.paragraph}>
              Coffee Lot: {contract.lotName}
            </Text>
          )}

          {contract.farmName && (
            <Text style={styles.paragraph}>
              Farm: {contract.farmName}
            </Text>
          )}

          <Text style={styles.paragraph}>
            Monthly Volume: {contract.monthlyVolumeKg} kg (roasted)
          </Text>

          <Text style={styles.paragraph}>
            Contract Duration: {contract.durationMonths} months
          </Text>

          <Text style={styles.paragraph}>
            Total Supply Commitment: {total} kg
          </Text>

          {contract.pricePerKg != null && (
            <Text style={styles.paragraph}>
              Price: ${contract.pricePerKg}/kg (roasted)
            </Text>
          )}

        </View>


        <View style={styles.divider} />


        {/* =================================================
           SUPPLY TERMS
        ================================================= */}

        <View style={styles.section}>

          <Text style={styles.sectionTitle}>
            2. Supply Commitment
          </Text>

          <Text style={styles.paragraph}>
            The Supplier agrees to provide the Buyer with a
            monthly supply of roasted coffee products as
            specified in this agreement.
          </Text>

          <Text style={styles.paragraph}>
            Deliveries shall be scheduled on a monthly basis
            and executed subject to operational availability
            and network supply capacity.
          </Text>

        </View>


        {/* =================================================
           DELIVERY TERMS
        ================================================= */}

        <View style={styles.section}>

          <Text style={styles.sectionTitle}>
            3. Delivery Conditions
          </Text>

          <Text style={styles.paragraph}>
            The Supplier will allocate supply from available
            production regions according to operational
            capacity and logistics constraints.
          </Text>

          <Text style={styles.paragraph}>
            Delivery dates and shipment execution are subject
            to network supply conditions and system capacity
            signals determined by the platform.
          </Text>

        </View>


        {/* =================================================
           QUALITY ASSURANCE
        ================================================= */}

        <View style={styles.section}>

          <Text style={styles.sectionTitle}>
            4. Product Quality
          </Text>

          <Text style={styles.paragraph}>
            All coffee supplied under this agreement shall
            meet the quality standards defined by the Supplier
            and be suitable for commercial distribution.
          </Text>

        </View>


        {/* =================================================
           FORCE MAJEURE
        ================================================= */}

        <View style={styles.section}>

          <Text style={styles.sectionTitle}>
            5. Force Majeure
          </Text>

          <Text style={styles.paragraph}>
            Neither party shall be held liable for delays or
            failure to perform obligations resulting from
            events beyond reasonable control, including but
            not limited to natural disasters, logistics
            disruptions, regulatory actions, or systemic
            supply shocks.
          </Text>

        </View>


        {/* =================================================
           GOVERNING TERMS
        ================================================= */}

        <View style={styles.section}>

          <Text style={styles.sectionTitle}>
            6. General Provisions
          </Text>

          <Text style={styles.paragraph}>
            This document represents a pilot supply agreement
            generated through the Coffee Supply Platform and
            serves as a preliminary commercial commitment
            between the participating parties.
          </Text>

          <Text style={styles.paragraph}>
            Additional commercial terms, pricing structures,
            and logistics arrangements may be incorporated
            into subsequent contract versions.
          </Text>

        </View>


        {/* =================================================
           SIGNATURES
        ================================================= */}

        <View style={styles.section}>

          <Text style={styles.sectionTitle}>
            7. Signatures
          </Text>

          <Text style={styles.paragraph}>
            Supplier: _______________________________
          </Text>

          <Text style={styles.paragraph}>
            Buyer: _________________________________
          </Text>

          <Text style={styles.paragraph}>
            Date: _________________________________
          </Text>

        </View>

      </Page>

    </Document>

  )

  const blob = await pdf(doc).toBlob()

  const url = URL.createObjectURL(blob)

  return url

}