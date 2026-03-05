import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Users, Image, Bot } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const agencyId = (session?.user as any)?.agencyId;

  const [clientCount, campaignCount, creativeCount, activeCampaigns] = await Promise.all([
    prisma.client.count({ where: { agencyId, isActive: true } }),
    prisma.campaign.count({ where: { client: { agencyId } } }),
    prisma.creativeUpload.count({ where: { client: { agencyId } } }),
    prisma.campaign.findMany({
      where: { client: { agencyId }, status: "ACTIVE" },
      include: { client: { select: { name: true } } },
      take: 5,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const totalSpend = activeCampaigns.reduce(
    (sum, c) => sum + ((c.metrics as any)?.spend || 0),
    0
  );
  const totalConversions = activeCampaigns.reduce(
    (sum, c) => sum + ((c.metrics as any)?.conversions || 0),
    0
  );

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Dashboard</h2>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Campanas</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaignCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gasto total</CardTitle>
            <Image className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalSpend)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversiones</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalConversions)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campanas activas</CardTitle>
        </CardHeader>
        <CardContent>
          {activeCampaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay campanas activas</p>
          ) : (
            <div className="space-y-4">
              {activeCampaigns.map((campaign) => {
                const metrics = campaign.metrics as any;
                return (
                  <div key={campaign.id} className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">{campaign.name}</p>
                      <p className="text-sm text-muted-foreground">{campaign.client.name}</p>
                    </div>
                    <div className="flex gap-6 text-sm">
                      <div className="text-right">
                        <p className="text-muted-foreground">Gasto</p>
                        <p className="font-medium">{formatCurrency(metrics?.spend || 0)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">ROAS</p>
                        <p className="font-medium">{metrics?.roas?.toFixed(1) || "0"}x</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">CPA</p>
                        <p className="font-medium">{formatCurrency(metrics?.cpa || 0)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
