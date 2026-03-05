import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const agencyId = (session?.user as any)?.agencyId;

  const agency = agencyId
    ? await prisma.agency.findUnique({
        where: { id: agencyId },
        include: { users: { select: { id: true, name: true, email: true, role: true } } },
      })
    : null;

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Configuracion</h2>

      <Card>
        <CardHeader>
          <CardTitle>Agencia</CardTitle>
          <CardDescription>Informacion de tu agencia</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p><strong>Nombre:</strong> {agency?.name}</p>
          <p><strong>Plan:</strong> <Badge variant="secondary">{agency?.plan}</Badge></p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios</CardTitle>
          <CardDescription>Miembros del equipo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {agency?.users.map((user) => (
              <div key={user.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">{user.name || user.email}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <Badge variant="outline">{user.role}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integraciones</CardTitle>
          <CardDescription>Estado de las conexiones externas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Meta Ads API</span>
              <Badge variant={process.env.META_APP_ID ? "success" : "secondary"}>
                {process.env.META_APP_ID ? "Configurado" : "No configurado"}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>WhatsApp Business</span>
              <Badge variant={process.env.WHATSAPP_TOKEN ? "success" : "secondary"}>
                {process.env.WHATSAPP_TOKEN ? "Configurado" : "No configurado"}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Anthropic (Claude)</span>
              <Badge variant={process.env.ANTHROPIC_API_KEY ? "success" : "secondary"}>
                {process.env.ANTHROPIC_API_KEY ? "Configurado" : "No configurado"}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>Cloudflare R2</span>
              <Badge variant={process.env.R2_ACCESS_KEY_ID ? "success" : "secondary"}>
                {process.env.R2_ACCESS_KEY_ID ? "Configurado" : "No configurado"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
