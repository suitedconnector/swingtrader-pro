import { Request, Response } from "express";
import { spawn } from "child_process";
import { db } from "./db";
import { scanResults } from "@shared/schema";
import { enrichResult } from "./enrichment";
import path from "path";

export async function runScansV2(req: Request, res: Response) {
  try {
    const projectRoot = process.cwd();
    const scannerPath = path.join(projectRoot, "api", "simple_scan_new.py");

    const scanner = spawn(path.join(projectRoot, ".venv", "bin", "python"), [scannerPath], {
      cwd: projectRoot,
      env: { ...process.env, PYTHONPATH: projectRoot },
    });

    let stdout = "";
    let stderr = "";
    scanner.stdout.on("data", (data) => { stdout += data; });
    scanner.stderr.on("data", (data) => { stderr += data; });

    const exitCode = await new Promise((resolve, reject) => {
      scanner.on("close", resolve);
      scanner.on("error", reject);
    });

    if (exitCode !== 0) throw new Error(`Scanner exit ${exitCode}: ${stderr}`);

    const data = JSON.parse(stdout);
    
    // Validate results structure
    if (!data || !Array.isArray(data.results)) {
      throw new Error("Invalid scanner output: results must be an array.");
    }

    const enrichedResults = [];
    
    // Enrich all first
    for (const raw of data.results) {
      enrichedResults.push(await enrichResult({
        symbol: String(raw.symbol),
        scanType: String(raw.scanType),
        price: String(raw.price),
        change: String(raw.change),
        changePercent: String(raw.changePercent),
        volume: Number(raw.volume),
        dollarVolume: String(raw.dollarVolume),
      }));
    }

    // Validate records before transaction
    if (enrichedResults.length === 0) {
      throw new Error("Scanner produced no valid results; preserving existing scan data.");
    }

    // Atomic transaction
    await db.transaction(async (tx) => {
        await tx.delete(scanResults);
        for (const record of enrichedResults) {
            await tx.insert(scanResults).values(record);
        }
    });

    res.json({ count: enrichedResults.length, duration: data.duration });
  } catch (error: any) {
    console.error("Pipeline error:", error);
    res.status(500).json({ message: error.message });
  }
}
