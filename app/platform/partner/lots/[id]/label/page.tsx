import { prisma } from "@/database/prisma";

export default async function LabelPage({ params }: any) {
  const lot = await prisma.greenLot.findUnique({
  where: { id: params.id },
  include: {
    farm: true,
  },
});

  if (!lot) return <div>Lot not found</div>;

  

  return (
    <div className="p-10 text-black bg-white">
      
     <div className="border p-6 w-[400px]">

  <h1 className="text-2xl font-bold mb-4">
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