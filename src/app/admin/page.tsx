export const dynamic = "force-dynamic";

import Link from "next/link";

import { requireKoreAdminPage } from "@/lib/admin-auth";

import { AdminPanel } from "./AdminPanel";
import { getAdminFamilies, getAdminStats } from "./actions";

export default async function AdminPage() {
  await requireKoreAdminPage();

  const [stats, families] = await Promise.all([getAdminStats(), getAdminFamilies()]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#090b10",
        color: "#e4e6ed",
        padding: "24px 16px 48px",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(228,230,237,0.45)",
              }}
            >
              Kore Admin
            </p>
            <h1 style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 700 }}>Panel de administración</h1>
          </div>
          <Link href="/" style={{ color: "#4CC9A0", fontSize: 14, textDecoration: "none" }}>
            ← Volver a Kore
          </Link>
        </header>

        <AdminPanel stats={stats} families={families} />
      </div>
    </main>
  );
}
