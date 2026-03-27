"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ExternalLink, Trash2, Facebook, Instagram } from "lucide-react";

interface MetaAccountInfo {
  id: string;
  accountName: string | null;
  igAccountId: string | null;
  igUsername: string | null;
}

interface Client {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  brandProfile: any;
  metaAccounts?: MetaAccountInfo[];
  _count: { campaigns: number; metaAccounts: number };
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data) => { setClients(data.clients || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        brandProfile: {
          industry: form.get("industry"),
          tone: form.get("tone"),
          targetAudience: form.get("targetAudience"),
          usp: form.get("usp"),
        },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setClients((prev) => [data.client, ...prev]);
      setOpen(false);
    }
  }

  async function connectMeta(clientId: string) {
    const res = await fetch(`/api/meta/oauth?clientId=${clientId}`);
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  }

  async function disconnectMeta(clientId: string, accountId: string) {
    if (!confirm("Desconectar esta cuenta?")) return;
    const res = await fetch(`/api/meta/disconnect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, accountId }),
    });
    if (res.ok) {
      setClients((prev) =>
        prev.map((c) =>
          c.id === clientId
            ? {
                ...c,
                metaAccounts: c.metaAccounts?.filter((a) => a.id !== accountId),
                _count: { ...c._count, metaAccounts: c._count.metaAccounts - 1 },
              }
            : c
        )
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Clientes</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Nuevo cliente</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Crear cliente</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del negocio</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Industria</Label>
                <Input id="industry" name="industry" placeholder="Ej: Moda, Fitness, Restaurante..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tone">Tono de comunicacion</Label>
                <Input id="tone" name="tone" placeholder="Ej: Juvenil, profesional, divertido..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetAudience">Publico objetivo</Label>
                <Textarea id="targetAudience" name="targetAudience" placeholder="Describe el publico ideal..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="usp">Propuesta de valor</Label>
                <Textarea id="usp" name="usp" placeholder="Que hace unico al negocio..." />
              </div>
              <Button type="submit" className="w-full">Crear cliente</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Cargando clientes...</p>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">No hay clientes aun. Crea el primero.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Card key={client.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{client.name}</CardTitle>
                  <Badge variant={client.isActive ? "success" : "secondary"}>
                    {client.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {client.brandProfile && (
                  <p className="text-sm text-muted-foreground">
                    {(client.brandProfile as any).industry}
                  </p>
                )}
                <div className="text-sm text-muted-foreground">
                  {client._count?.campaigns || 0} campanas
                </div>
                {(client.metaAccounts?.length || 0) > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Cuentas conectadas:</p>
                    {client.metaAccounts!.map((acc) => (
                      <div key={acc.id} className="flex items-center justify-between rounded-md border p-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Facebook className="h-4 w-4 text-blue-600" />
                          <span className="font-medium">{acc.accountName || "Cuenta sin nombre"}</span>
                          {acc.igUsername && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Instagram className="h-3 w-3" />@{acc.igUsername}
                            </span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => disconnectMeta(client.id, acc.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" className="w-full" onClick={() => connectMeta(client.id)}>
                      <Plus className="mr-1 h-3 w-3" /> Agregar cuenta
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => connectMeta(client.id)}>
                    <ExternalLink className="mr-1 h-3 w-3" /> Conectar Meta
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
