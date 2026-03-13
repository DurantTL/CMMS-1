import { getAdminComplianceDashboardData } from "../../../lib/data/compliance-dashboard";
import { ComplianceSyncDashboard } from "./_components/compliance-sync-dashboard";

export const dynamic = "force-dynamic";

export default async function ComplianceDashboardPage() {
  const dashboardData = await getAdminComplianceDashboardData();

  return <ComplianceSyncDashboard dashboardData={dashboardData} />;
}
