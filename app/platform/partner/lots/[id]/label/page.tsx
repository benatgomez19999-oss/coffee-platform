import { prisma } from "@/database/prisma";

export default async function LabelPage({ params }: any) {

  //////////////////////////////////////////////////////
  // 1. GET DRAFT + GREEN LOT
  //////////////////////////////////////////////////////

  const draft = await prisma.producerLotDraft.findUnique({
  where: { id: params.id },
  include: {
    greenLot: {
      include: {
        farm: true,
      },
    },
  },
});

  const lot = draft?.greenLot;

  //////////////////////////////////////////////////////
  // 2. SAFETY
  //////////////////////////////////////////////////////

  if (!draft) {
  return <div className="p-10">Draft not found</div>;
}

if (!lot) {
  return <div className="p-10">Lot not verified yet</div>;
}

  //////////////////////////////////////////////////////
  // 3. RENDER LABEL
  //////////////////////////////////////////////////////

  return (
    <div className="p-10 bg-white text-black">
      <div className="border p-6 w-[400px] space-y-2">

        <h1 className="text-2xl font-bold">
          {lot.lotNumber}
        </h1>

        <p><b>Variety:</b> {lot.variety}</p>
        <p><b>Process:</b> {lot.process}</p>
        <p><b>Harvest:</b> {lot.harvestYear}</p>
        <p><b>Altitude:</b> {lot.farm?.altitude} m</p>
        <p><b>SCA:</b> {lot.scaScore}</p>
        <p><b>Volume:</b> {lot.totalKg} kg</p>

      </div>
    </div>
  );
}