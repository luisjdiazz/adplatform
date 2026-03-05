"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MetricsCard } from "@/components/campaigns/MetricsCard";
import { RefreshCw, Loader2 } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  budget: number | null;
  metrics: any;
  client: { name: string };
  adSets: any[];
}

const statusColors: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  ACTIVE: "success",
  PAUSED: "warning",
  DRAFT: "secondary",
  ARCHIVED: "destructive",
};

export default function CampaignsPage() {
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data) => {
        const list = data.clients || [];
        setClients(list);
        if (list.length > 0) setSelectedClient(list[0].id);
      });
  }, []);

  useEffect(() => {
    if (!selectedClient) return;
    setLoading(true);
    fetch(`/api/campaigns?clientId=${selectedClient}`)
      .then((r) => r.json())
      .then((data) => {
        setCampaigns(data.campaigns || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedClient]);

  async function handleSync() {
    if (!selectedClient) return;
    setSyncing(true);
    setSyncMessage("");

    try {
      const res = await fetch("/api/meta/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: selectedClient }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSyncMessage(`Sincronizadas ${data.synced} campanas`);

      // Reload campaigns
      const campRes = await fetch(`/api/campaigns?clientId=${selectedClient}`);
      const campData = await campRes.json();
      setCampaigns(campData.campaigns || []);
    } catch (err: any) {
      setSyncMessage(`Error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Campanas</h2>
        <div className="flex items-center gap-4">
          <div className="w-64">
            <Label className="text-xs text-muted-foreground">Cliente</Label>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger><SelectValue placeholder="Selecciona cliente" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSync} disabled={syncing || !selectedClient} variant="outline">
            {syncing ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sincronizando...</>
            ) : (
              <><RefreshCw className="mr-2 h-4 w-4" /> Sincronizar con Meta</>
            )}
          </Button>
        </div>
      </div>

      {syncMessage && (
        <div className={`rounded-md p-3 text-sm ${syncMessage.startsWith("Error") ? "bg-destructive/10 text-destructive" : "bg-green-50 text-green-800"}`}>
          {syncMessage}
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">Cargando campanas...</p>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">
              No hay campanas. Dale click a "Sincronizar con Meta" para traer tus campanas.
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
                {metrics && Object.keys(metrics).length > 0 && (
                  <MetricsCard title="Metricas" metrics={metrics} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
