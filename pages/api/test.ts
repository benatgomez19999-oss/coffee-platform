import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log("✅ TEST ENDPOINT HIT");

  res.status(200).send("TEST OK");
}