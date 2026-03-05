"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Rocket, Sparkles } from "lucide-react";

interface CampaignBuilderProps {
  clientId: string;
  creativeUploadId: string;
  analysisResult: any;
  onCampaignGenerated: (suggestion: any) => void;
}

export function CampaignBuilder({
  clientId,
  creativeUploadId,
  analysisResult,
  onCampaignGenerated,
}: CampaignBuilderProps) {
  const [loading, setLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [suggestion, setSuggestion] = useState<any>(null);
  const [error, setError] = useState("");

  async function handleGenerateCampaign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const questionnaire = {
      producto: form.get("producto"),
      objetivo: form.get("objetivo"),
      presupuesto: form.get("presupuesto"),
      pais: form.get("pais"),
      edad_min: form.get("edad_min"),
      edad_max: form.get("edad_max"),
      genero: form.get("genero"),
      intereses: form.get("intereses"),
      pixel_instalado: form.get("pixel") === "si",
    };

    try {
      const res = await fetch("/api/ai/analyze-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creativeUploadId, questionnaire }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuggestion(data.suggestion);
      onCampaignGenerated(data.suggestion);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLaunch() {
    if (!suggestion) return;
    setLaunching(true);
    setError("");

    try {
      const res = await fetch("/api/meta/launch-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, creativeUploadId, campaignData: suggestion }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(`Campana creada en Meta! ID: ${data.metaCampaignId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cuestionario de campana</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerateCampaign} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="producto">Producto/servicio</Label>
                <Input
                  id="producto"
                  name="producto"
                  defaultValue={analysisResult?.producto || ""}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="objetivo">Objetivo</Label>
                <Select name="objetivo" defaultValue="ventas">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ventas">Ventas</SelectItem>
                    <SelectItem value="leads">Leads</SelectItem>
                    <SelectItem value="trafico">Trafico</SelectItem>
                    <SelectItem value="awareness">Awareness</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="presupuesto">Presupuesto diario (MXN)</Label>
                <Input id="presupuesto" name="presupuesto" type="number" defaultValue="200" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pais">Pais objetivo</Label>
                <Input id="pais" name="pais" defaultValue="Mexico" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edad_min">Edad minima</Label>
                <Input id="edad_min" name="edad_min" type="number" defaultValue="18" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edad_max">Edad maxima</Label>
                <Input id="edad_max" name="edad_max" type="number" defaultValue="55" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="genero">Genero</Label>
                <Select name="genero" defaultValue="todos">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="hombres">Hombres</SelectItem>
                    <SelectItem value="mujeres">Mujeres</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pixel">Pixel instalado?</Label>
                <Select name="pixel" defaultValue="si">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="si">Si</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="intereses">Intereses del cliente ideal</Label>
              <Textarea id="intereses" name="intereses" placeholder="Ej: moda, compras online, Instagram, tendencias..." />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generando campana...</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" /> Generar campana con IA</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {suggestion && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Propuesta de campana</CardTitle>
              <Button onClick={handleLaunch} disabled={launching}>
                {launching ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Lanzando...</>
                ) : (
                  <><Rocket className="mr-2 h-4 w-4" /> Lanzar en Meta</>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nombre de campana</p>
              <p className="font-medium">{suggestion.campaign_name}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Objetivo Meta</p>
              <Badge>{suggestion.objective}</Badge>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Audiencias</p>
              <div className="space-y-2">
                {suggestion.audiences?.map((aud: any, i: number) => (
                  <div key={i} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{aud.type}</Badge>
                      <span className="font-medium">{aud.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Copy del anuncio</p>
              <div className="rounded-lg border p-4 space-y-2">
                <p className="font-bold">{suggestion.copy?.headline}</p>
                <p className="text-sm">{suggestion.copy?.primary_text}</p>
                <p className="text-xs text-muted-foreground">{suggestion.copy?.description}</p>
                <Badge variant="secondary">CTA: {suggestion.copy?.cta}</Badge>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Presupuesto</p>
              <div className="rounded-lg border p-4 space-y-1 text-sm">
                <p>Diario: ${suggestion.budget?.daily_budget} MXN</p>
                <p>Duracion: {suggestion.budget?.recommended_duration_days} dias</p>
                <p>Estrategia: {suggestion.budget?.bid_strategy}</p>
                <p className="text-muted-foreground">{suggestion.budget?.explanation}</p>
              </div>
            </div>

            {suggestion.optimization_tips?.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Tips de optimizacion</p>
                <ul className="space-y-1">
                  {suggestion.optimization_tips.map((tip: string, i: number) => (
                    <li key={i} className="text-sm">- {tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
