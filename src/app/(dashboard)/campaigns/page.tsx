import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricsCard } from "@/components/campaigns/MetricsCard";

export default async function CampaignsPage() {
  const session = await getServerSession(authOptions);
  const agencyId = (session?.user as any)?.agencyId;

  const campaigns = await prisma.campaign.findMany({
    where: { client: { agencyId } },
    include: {
      client: { select: { name: true } },
      adSets: { include: { ads: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const statusColors: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
    ACTIVE: "success",
    PAUSED: "warning",
    DRAFT: "secondary",
    ARCHIVED: "destructive",
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Campanas</h2>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">
              No hay campanas. Conecta una cuenta de Meta o crea una desde Creative Analyzer.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => {
            const metrics = campaign.metrics as any;
            return (
              <div key={campaign.id} className="space-y-2">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{campaign.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{campaign.client.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusColors[campaign.status] || "secondary"}>
                          {campaign.status}
                        </Badge>
                        {campaign.objective && (
                          <Badge variant="outline">{campaign.objective}</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </Card>
                <MetricsCard title="Metricas" metrics={metrics || {}} />
                {campaign.adSets.length > 0 && (
                  <div className="ml-6 space-y-2">
                    {campaign.adSets.map((adSet) => (
                      <Card key={adSet.id} className="border-l-4 border-l-primary/30">
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm">{adSet.name}</CardTitle>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
