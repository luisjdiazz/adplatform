"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  RefreshCw, Loader2, Pause, Play, Archive, Trash2, Brain,
  ChevronDown, ChevronUp, DollarSign, TrendingUp, TrendingDown, Eye,
} from "lucide-react";

interface Ad {
  id: string;
  name: string;
  status: string;
  creativeUrl: string | null;
  metrics: any;
}

interface AdSet {
  id: string;
  name: string;
  targeting: any;
  budget: number | null;
  metrics: any;
  ads: Ad[];
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  budget: number | null;
  metrics: any;
  client: { name: string };
  adSets: AdSet[];
}

function getSpend(m: any): number { return parseFloat(m?.spend) || 0; }
function getImpressions(m: any): number { return parseInt(m?.impressions) || 0; }
function getClicks(m: any): number { return parseInt(m?.clicks) || 0; }
function getCtr(m: any): number { return parseFloat(m?.ctr) || 0; }
function getCpc(m: any): number { return parseFloat(m?.cpc) || 0; }
function getFreq(m: any): number { return parseFloat(m?.frequency) || 0; }

function getPerformanceVerdict(metrics: any): { label: string; color: string; icon: any } {
  const ctr = getCtr(metrics);
  const cpc = getCpc(metrics);
  const freq = getFreq(metrics);

  if (ctr >= 2 && cpc < 1 && freq < 3) return { label: "Excelente", color: "text-green-600", icon: TrendingUp };
  if (ctr >= 1 && cpc < 2) return { label: "Bien", color: "text-blue-600", icon: TrendingUp };
  if (freq > 4) return { label: "Fatigada", color: "text-red-600", icon: TrendingDown };
  if (ctr < 0.5) return { label: "Bajo CTR", color: "text-orange-600", icon: TrendingDown };
  if (cpc > 3) return { label: "CPC Alto", color: "text-orange-600", icon: DollarSign };
  return { label: "Normal", color: "text-gray-600", icon: Eye };
}

export default function CampaignsPage() {
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, any>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
    loadCampaigns();
  }, [selectedClient]);

  function loadCampaigns() {
    setLoading(true);
    fetch(`/api/campaigns?clientId=${selectedClient}&onlySpending=true`)
      .then((r) => r.json())
      .then((data) => {
        setCampaigns(data.campaigns || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

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
      loadCampaigns();
    } catch (err: any) {
      setSyncMessage(`Error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }

  async function handleAction(campaignId: string, action: string) {
    if (action === "delete" && !confirm("Seguro que quieres eliminar esta campana?")) return;
    setActionLoading(campaignId);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      loadCampaigns();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAnalyze(campaignId: string) {
    setAnalyzingId(campaignId);
    setExpandedCampaign(campaignId);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/analyze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAnalysis((prev) => ({ ...prev, [campaignId]: data.analysis }));
    } catch (err: any) {
      alert(`Error al analizar: ${err.message}`);
    } finally {
      setAnalyzingId(null);
    }
  }

  // Totals
  const totalSpend = campaigns.reduce((sum, c) => sum + getSpend(c.metrics), 0);
  const totalImpressions = campaigns.reduce((sum, c) => sum + getImpressions(c.metrics), 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + getClicks(c.metrics), 0);
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold">Campanas Activas</h2>
          <p className="text-sm text-muted-foreground">Solo campanas gastando dinero (ultimos 7 dias)</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-48">
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
          <div className="pt-4">
            <Button onClick={handleSync} disabled={syncing || !selectedClient} variant="outline">
              {syncing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sincronizando...</>
              ) : (
                <><RefreshCw className="mr-2 h-4 w-4" /> Sincronizar</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Review Summary */}
      {!loading && campaigns.length > 0 && (
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Resumen Rapido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5">
              <div>
                <p className="text-xs text-muted-foreground">Campanas Gastando</p>
                <p className="text-2xl font-bold">{campaigns.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gasto Total (7d)</p>
                <p className="text-2xl font-bold text-red-600">${totalSpend.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Impresiones</p>
                <p className="text-2xl font-bold">{totalImpressions.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">CTR Promedio</p>
                <p className={`text-2xl font-bold ${avgCtr >= 1 ? "text-green-600" : "text-orange-600"}`}>
                  {avgCtr.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">CPC Promedio</p>
                <p className={`text-2xl font-bold ${avgCpc < 1.5 ? "text-green-600" : "text-orange-600"}`}>
                  ${avgCpc.toFixed(2)}
                </p>
              </div>
            </div>
            {/* Quick verdict */}
            <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
              {avgCtr >= 1.5 && avgCpc < 1.5
                ? "Las campanas van bien — buen CTR y CPC controlado."
                : avgCtr < 0.8
                ? "CTR bajo — revisa los creativos y audiencias, puede que necesiten refrescarse."
                : avgCpc > 2
                ? "CPC alto — considera ajustar audiencias o probar nuevos creativos para bajar costos."
                : "Rendimiento aceptable — monitorea de cerca y optimiza donde sea posible."}
            </div>
          </CardContent>
        </Card>
      )}

      {syncMessage && (
        <div className={`rounded-md p-3 text-sm ${syncMessage.startsWith("Error") ? "bg-destructive/10 text-destructive" : "bg-green-50 text-green-800"}`}>
          {syncMessage}
        </div>
      )}

      {/* Campaign list */}
      {loading ? (
        <p className="text-muted-foreground">Cargando campanas...</p>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              No hay campanas gastando dinero actualmente.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Dale click a &quot;Sincronizar&quot; para actualizar desde Meta.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => {
            const metrics = campaign.metrics as any;
            const isExpanded = expandedCampaign === campaign.id;
            const campaignAnalysis = analysis[campaign.id];
            const isAnalyzing = analyzingId === campaign.id;
            const isActioning = actionLoading === campaign.id;
            const verdict = getPerformanceVerdict(metrics);
            const VerdictIcon = verdict.icon;

            return (
              <div key={campaign.id} className="space-y-2">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 cursor-pointer" onClick={() => setExpandedCampaign(isExpanded ? null : campaign.id)}>
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          <CardTitle className="text-lg">{campaign.name}</CardTitle>
                          <Badge variant="outline" className={`text-xs ${verdict.color}`}>
                            <VerdictIcon className="h-3 w-3 mr-1" />
                            {verdict.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 ml-6">
                          <span className="text-xs text-muted-foreground">{campaign.client.name}</span>
                          {campaign.objective && (
                            <Badge variant="secondary" className="text-xs">{campaign.objective}</Badge>
                          )}
                          {campaign.adSets.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {campaign.adSets.length} adsets activos - {campaign.adSets.reduce((s, a) => s + a.ads.length, 0)} ads
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right mr-2">
                          <p className="text-lg font-bold text-red-600">${getSpend(metrics).toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">gastado (7d)</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm" variant="outline"
                            onClick={() => handleAnalyze(campaign.id)}
                            disabled={isAnalyzing}
                            title="Analizar con IA"
                          >
                            {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                          </Button>
                          {campaign.status === "ACTIVE" && (
                            <Button
                              size="sm" variant="outline"
                              onClick={() => handleAction(campaign.id, "pause")}
                              disabled={isActioning}
                              title="Pausar"
                            >
                              <Pause className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  {/* Metrics row */}
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                      <MetricItem label="Impresiones" value={getImpressions(metrics).toLocaleString()} />
                      <MetricItem label="Clicks" value={getClicks(metrics).toLocaleString()} />
                      <MetricItem label="CTR" value={`${getCtr(metrics).toFixed(2)}%`} good={getCtr(metrics) >= 1} />
                      <MetricItem label="CPC" value={`$${getCpc(metrics).toFixed(2)}`} good={getCpc(metrics) < 1.5} />
                      <MetricItem label="Frecuencia" value={getFreq(metrics).toFixed(1)} good={getFreq(metrics) < 3} />
                    </div>
                  </CardContent>
                </Card>

                {/* Expanded: AdSets, Ads, AI Analysis */}
                {isExpanded && (
                  <div className="ml-4 space-y-2">
                    {isAnalyzing && (
                      <Card className="border-blue-200 bg-blue-50/50">
                        <CardContent className="py-6 text-center">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Analizando campana con IA...</p>
                        </CardContent>
                      </Card>
                    )}

                    {campaignAnalysis && <AnalysisPanel analysis={campaignAnalysis} />}

                    {campaign.adSets.map((adSet) => {
                      const asMetrics = adSet.metrics as any;
                      const asVerdict = getPerformanceVerdict(asMetrics);
                      return (
                        <Card key={adSet.id} className="border-l-4 border-l-blue-300">
                          <CardHeader className="py-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-sm font-medium">{adSet.name}</CardTitle>
                                {adSet.budget && (
                                  <span className="text-xs text-muted-foreground">${adSet.budget.toFixed(2)}/dia</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-medium ${asVerdict.color}`}>{asVerdict.label}</span>
                                <span className="text-sm font-bold text-red-600">${getSpend(asMetrics).toFixed(2)}</span>
                              </div>
                            </div>
                          </CardHeader>
                          {asMetrics && Object.keys(asMetrics).length > 0 && (
                            <CardContent className="pt-0 pb-3">
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                                <MetricItem label="Impresiones" value={getImpressions(asMetrics).toLocaleString()} small />
                                <MetricItem label="Clicks" value={getClicks(asMetrics).toLocaleString()} small />
                                <MetricItem label="CTR" value={`${getCtr(asMetrics).toFixed(2)}%`} small good={getCtr(asMetrics) >= 1} />
                                <MetricItem label="CPC" value={`$${getCpc(asMetrics).toFixed(2)}`} small good={getCpc(asMetrics) < 1.5} />
                                <MetricItem label="Frecuencia" value={getFreq(asMetrics).toFixed(1)} small good={getFreq(asMetrics) < 3} />
                              </div>
                            </CardContent>
                          )}

                          {adSet.ads.length > 0 && (
                            <CardContent className="pt-0 pb-3">
                              <div className="space-y-2">
                                {adSet.ads.map((ad) => {
                                  const adM = ad.metrics as any;
                                  return (
                                    <div key={ad.id} className="flex items-center gap-3 p-2 rounded bg-muted/50">
                                      {ad.creativeUrl && (
                                        <img src={ad.creativeUrl} alt="" className="w-10 h-10 rounded object-cover" />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate">{ad.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                          Gasto: ${getSpend(adM).toFixed(2)} |
                                          CTR: {getCtr(adM).toFixed(2)}% |
                                          CPC: ${getCpc(adM).toFixed(2)}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      );
                    })}
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

function MetricItem({ label, value, small, good }: { label: string; value: string; small?: boolean; good?: boolean }) {
  return (
    <div>
      <p className={`text-muted-foreground ${small ? "text-[10px]" : "text-xs"}`}>{label}</p>
      <p className={`font-semibold ${small ? "text-xs" : "text-sm"} ${good !== undefined ? (good ? "text-green-600" : "text-orange-600") : ""}`}>
        {value}
      </p>
    </div>
  );
}

function AnalysisPanel({ analysis }: { analysis: any }) {
  const scoreColor = analysis.health_score >= 70 ? "text-green-600" : analysis.health_score >= 40 ? "text-yellow-600" : "text-red-600";
  const statusBadge = analysis.health_status === "healthy" ? "success" : analysis.health_status === "warning" ? "warning" : "destructive";

  return (
    <Card className="border-purple-200 bg-purple-50/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            Analisis IA
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${scoreColor}`}>{analysis.health_score}/100</span>
            <Badge variant={statusBadge}>{analysis.health_status}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">{analysis.summary}</p>

        {analysis.spend_analysis && (
          <div>
            <h4 className="text-sm font-semibold mb-1">Gasto</h4>
            <p className="text-xs text-muted-foreground">{analysis.spend_analysis.explanation}</p>
          </div>
        )}

        {analysis.audience_analysis && (
          <div>
            <h4 className="text-sm font-semibold mb-1">Audiencia</h4>
            <p className="text-xs text-muted-foreground">{analysis.audience_analysis.assessment}</p>
            {analysis.audience_analysis.suggestions?.length > 0 && (
              <ul className="mt-1 space-y-1">
                {analysis.audience_analysis.suggestions.map((s: string, i: number) => (
                  <li key={i} className="text-xs text-muted-foreground">- {s}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {analysis.creative_analysis && (
          <div>
            <h4 className="text-sm font-semibold mb-1">Creativos</h4>
            <p className="text-xs text-muted-foreground">{analysis.creative_analysis.assessment}</p>
            {analysis.creative_analysis.best_performing && (
              <p className="text-xs mt-1"><span className="text-green-600 font-medium">Mejor:</span> {analysis.creative_analysis.best_performing}</p>
            )}
            {analysis.creative_analysis.worst_performing && (
              <p className="text-xs"><span className="text-red-600 font-medium">Peor:</span> {analysis.creative_analysis.worst_performing}</p>
            )}
          </div>
        )}

        {analysis.optimization_actions?.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Acciones Recomendadas</h4>
            <div className="space-y-2">
              {analysis.optimization_actions.map((action: any, i: number) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded bg-white border">
                  <Badge variant={action.priority === "alta" ? "destructive" : action.priority === "media" ? "warning" : "secondary"} className="text-xs mt-0.5">
                    {action.priority}
                  </Badge>
                  <div>
                    <p className="text-xs font-medium">{action.action}</p>
                    <p className="text-xs text-muted-foreground">{action.expected_impact}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {analysis.budget_recommendation && (
          <div className="p-3 rounded bg-white border">
            <h4 className="text-sm font-semibold mb-1">Presupuesto Recomendado</h4>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Actual</p>
                <p className="text-sm font-bold">${analysis.budget_recommendation.current_daily}/dia</p>
              </div>
              <span className="text-muted-foreground">&rarr;</span>
              <div>
                <p className="text-xs text-muted-foreground">Recomendado</p>
                <p className="text-sm font-bold text-purple-600">${analysis.budget_recommendation.recommended_daily}/dia</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{analysis.budget_recommendation.reasoning}</p>
          </div>
        )}

        {analysis.predicted_improvements && (
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2 rounded bg-white border">
              <p className="text-xs text-muted-foreground">CTR</p>
              <p className="text-sm font-bold text-green-600">{analysis.predicted_improvements.ctr_improvement}</p>
            </div>
            <div className="text-center p-2 rounded bg-white border">
              <p className="text-xs text-muted-foreground">CPC</p>
              <p className="text-sm font-bold text-green-600">{analysis.predicted_improvements.cpc_reduction}</p>
            </div>
            <div className="text-center p-2 rounded bg-white border">
              <p className="text-xs text-muted-foreground">Conversiones</p>
              <p className="text-sm font-bold text-green-600">{analysis.predicted_improvements.conversions_increase}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
