import { storage } from "./storage";

export async function enrichResult(result: any) {
  const stock = await storage.getStock(result.symbol);

  if (!stock) {
    throw new Error(`METADATA_MISSING: No entry found for ${result.symbol}`);
  }

  if (!stock.sector) {
    throw new Error(`SECTOR_MISSING: No sector for ${result.symbol}`);
  }

  return {
    ...result,
    sector: stock.sector,
    adr: stock.adr || null,
  };
}
