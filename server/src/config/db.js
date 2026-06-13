import mongoose from "mongoose";
import dns from "node:dns";

/**
 * Connect to MongoDB Atlas. Fails loudly if MONGODB_URI is missing — we'd rather
 * crash at boot than silently run with no database.
 */
export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Copy .env.example to .env and fill it in.");
  }

  // mongodb+srv requires a DNS SRV lookup. On some networks (VPNs, local resolvers)
  // Node's resolver gets ECONNREFUSED on SRV even though the OS resolver works. Point
  // Node at a public DNS so the SRV/TXT lookup succeeds. Override via DNS_SERVERS env.
  if (uri.startsWith("mongodb+srv://")) {
    const servers = (process.env.DNS_SERVERS || "8.8.8.8,1.1.1.1")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      dns.setServers(servers);
    } catch (e) {
      console.warn("[db] could not set DNS servers:", e.message);
    }
  }

  mongoose.set("strictQuery", true);

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log("[db] connected to MongoDB Atlas");
  return mongoose.connection;
}
