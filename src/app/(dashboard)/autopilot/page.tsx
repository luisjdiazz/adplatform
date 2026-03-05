import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActionLog } from "@/components/autopilot/ActionLog";

export default async function AutopilotPage() {
  const session = await getServerSession(authOptions);
  const agencyId = (session?.user as any)?.agencyId;

  const [rules, logs] = await Promise.all([
    prisma.autopilotRule.findMany({
      where: { client: { agencyId } },
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.autopilotLog.findMany({
      where: { client: { agencyId } },
      include: {
        rule: { select: { name: true, mode: true } },
        approvedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">AI Trafficker (Autopilot)</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Reglas activas</CardTitle>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay reglas configuradas</p>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => {
                const condition = rule.condition as any;
                const action = rule.action as any;
                return (
                  <div key={rule.id} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{rule.name}</p>
                        <Badge variant={rule.isActive ? "success" : "secondary"}>
                          {rule.isActive ? "Activa" : "Inactiva"}
                        </Badge>
                        <Badge variant={rule.mode === "AUTOPILOT" ? "default" : "outline"}>
                          {rule.mode}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {rule.client.name} | Si {condition.metric} {condition.operator} {condition.value} → {action.type}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ActionLog
        logs={logs.map((l) => ({
          ...l,
          createdAt: l.createdAt.toISOString(),
          rule: l.rule ? { name: l.rule.name, mode: l.rule.mode } : null,
          approvedBy: l.approvedBy ? { name: l.approvedBy.name || "" } : null,
        }))}
      />
    </div>
  );
}
