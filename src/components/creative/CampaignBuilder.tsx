"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Rocket, Sparkles, MessageCircle, ArrowRight, CheckCircle2 } from "lucide-react";

interface CampaignBuilderProps {
  clientId: string;
  creativeUploadId: string;
  analysisResult: any;
  onCampaignGenerated: (suggestion: any) => void;
}

type Step = "ai-thinking" | "ai-recommendation" | "user-input" | "final-proposal";

export function CampaignBuilder({
  clientId,
  creativeUploadId,
  analysisResult,
  onCampaignGenerated,
}: CampaignBuilderProps) {
  const [step, setStep] = useState<Step>("ai-thinking");
  const [loading, setLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<any>(null);
  const [finalSuggestion, setFinalSuggestion] = useState<any>(null);
  const [error, setError] = useState("");

  // Step 1: Auto-generate AI recommendation as soon as component mounts
  useEffect(() => {
    generateAiRecommendation();
  }, []);

  async function generateAiRecommendation() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/analyze-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creativeUploadId,
          questionnaire: {
            producto: analysisResult?.producto || "",
            modo: "auto-recommendation",
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAiRecommendation(data.suggestion);
      setStep("ai-recommendation");
    } catch (err: any) {
      setError(err.message);
      setStep("ai-recommendation");
    } finally {
      setLoading(false);
    }
  }

  // Step 3: Refine with user input
  async function handleRefine(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const userObjective = form.get("objetivo") as string;
    const userBudget = form.get("presupuesto") as string;
    const userCountry = form.get("pais") as string;
    const userContext = form.get("contexto") as string;
    const userAgeMin = form.get("edad_min") as string;
    const userAgeMax = form.get("edad_max") as string;
    const userGender = form.get("genero") as string;
    const userDuration = form.get("duracion") as string;

    const questionnaire = {
      producto: analysisResult?.producto || "",
      modo: "user-refined",
      objetivo_usuario: userObjective || undefined,
      presupuesto: userBudget || undefined,
      pais: userCountry || undefined,
      edad_min: userAgeMin || undefined,
      edad_max: userAgeMax || undefined,
      genero: userGender || undefined,
      duracion_dias: userDuration || undefined,
      contexto_adicional: userContext || undefined,
      recomendacion_previa: aiRecommendation,
    };

    try {
      const res = await fetch("/api/ai/analyze-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creativeUploadId, questionnaire }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFinalSuggestion(data.suggestion);
      onCampaignGenerated(data.suggestion);
      setStep("final-proposal");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Accept AI recommendation as-is
  function acceptAiRecommendation() {
    setFinalSuggestion(aiRecommendation);
    onCampaignGenerated(aiRecommendation);
    setStep("final-proposal");
  }

  async function handleLaunch() {
    if (!finalSuggestion) return;
    setLaunching(true);
    setError("");

    try {
      const res = await fetch("/api/meta/launch-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, creativeUploadId, campaignData: finalSuggestion }),
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

  const activeSuggestion = finalSuggestion || aiRecommendation;

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        <span className={`flex items-center gap-1 rounded-full px-3 py-1 ${
          step === "ai-thinking" ? "bg-purple-500/20 text-purple-400" : "bg-green-500/20 text-green-400"
        }`}>
          {step === "ai-thinking" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3 w-3" />
          )}
          1. Claude analiza
        </span>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <span className={`flex items-center gap-1 rounded-full px-3 py-1 ${
          step === "user-input" ? "bg-blue-500/20 text-blue-400"
          : step === "final-proposal" ? "bg-green-500/20 text-green-400"
          : "bg-muted text-muted-foreground"
        }`}>
          {step === "final-proposal" ? <CheckCircle2 className="h-3 w-3" /> : <MessageCircle className="h-3 w-3" />}
          2. Tu input
        </span>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <span className={`flex items-center gap-1 rounded-full px-3 py-1 ${
          step === "final-proposal" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"
        }`}>
          <Rocket className="h-3 w-3" />
          3. Lanzar
        </span>
      </div>

      {/* Step 1: AI is thinking */}
      {step === "ai-thinking" && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-purple-400" />
              <p className="font-medium">Claude esta analizando tu creativo...</p>
              <p className="text-sm text-muted-foreground">
                Generando recomendacion de campana basada en el analisis del creativo y el perfil de marca
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Show AI recommendation + ask user */}
      {step === "ai-recommendation" && aiRecommendation && (
        <>
          <Card className="border-purple-500/30">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-400" />
                <CardTitle className="text-lg">Recomendacion de Claude</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                Basado en el analisis de tu creativo, esto es lo que Claude recomienda:
              </p>
            </CardHeader>
            <CardContent>
              <SuggestionDisplay suggestion={aiRecommendation} />
            </CardContent>
          </Card>

          <Card className="border-blue-500/30">
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-blue-400" />
                <CardTitle className="text-lg">Que tienes en mente?</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                Si quieres ajustar algo, llena los campos que quieras cambiar. Si la recomendacion de Claude te convence, dale a &quot;Usar recomendacion de Claude&quot;.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRefine} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="objetivo">Objetivo de la campana</Label>
                    <Select name="objetivo" defaultValue="">
                      <SelectTrigger><SelectValue placeholder="Dejar recomendacion de Claude" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ventas">Ventas / Conversiones</SelectItem>
                        <SelectItem value="leads">Generacion de Leads</SelectItem>
                        <SelectItem value="trafico">Trafico al sitio web</SelectItem>
                        <SelectItem value="engagement">Engagement / Interaccion</SelectItem>
                        <SelectItem value="awareness">Awareness / Reconocimiento</SelectItem>
                        <SelectItem value="mensajes">Mensajes (WhatsApp/DM)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="presupuesto">Presupuesto diario (USD)</Label>
                    <Input
                      id="presupuesto"
                      name="presupuesto"
                      type="number"
                      placeholder={`Claude sugiere: $${aiRecommendation.budget?.daily_budget || "---"}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pais">Pais objetivo</Label>
                    <Input id="pais" name="pais" placeholder="Ej: Republica Dominicana, Mexico..." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duracion">Duracion (dias)</Label>
                    <Input
                      id="duracion"
                      name="duracion"
                      type="number"
                      placeholder={`Claude sugiere: ${aiRecommendation.budget?.recommended_duration_days || "---"} dias`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edad_min">Edad minima</Label>
                    <Input id="edad_min" name="edad_min" type="number" placeholder="18" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edad_max">Edad maxima</Label>
                    <Input id="edad_max" name="edad_max" type="number" placeholder="65" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="genero">Genero</Label>
                    <Select name="genero" defaultValue="">
                      <SelectTrigger><SelectValue placeholder="Dejar recomendacion de Claude" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="hombres">Hombres</SelectItem>
                        <SelectItem value="mujeres">Mujeres</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contexto">Cuentame mas sobre lo que quieres lograr</Label>
                  <Textarea
                    id="contexto"
                    name="contexto"
                    placeholder="Ej: Quiero atraer mujeres jovenes que buscan tratamientos de cabello, tengo una promo de 20% de descuento este mes..."
                    rows={3}
                  />
                </div>
                <div className="flex gap-3">
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Ajustando propuesta...</>
                    ) : (
                      <><Sparkles className="mr-2 h-4 w-4" /> Generar con mis ajustes</>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={acceptAiRecommendation}
                    className="flex-1"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Usar recomendacion de Claude
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </>
      )}

      {/* Step 3: Final proposal with launch button */}
      {step === "final-proposal" && finalSuggestion && (
        <Card className="border-green-500/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                <CardTitle className="text-lg">Propuesta final</CardTitle>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep("ai-recommendation")}
                >
                  Ajustar
                </Button>
                <Button onClick={handleLaunch} disabled={launching}>
                  {launching ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Lanzando...</>
                  ) : (
                    <><Rocket className="mr-2 h-4 w-4" /> Lanzar en Meta</>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <SuggestionDisplay suggestion={finalSuggestion} />
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function SuggestionDisplay({ suggestion }: { suggestion: any }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Nombre de campana</p>
          <p className="font-medium">{suggestion.campaign_name}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Objetivo Meta</p>
          <Badge>{suggestion.objective}</Badge>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-muted-foreground mb-2">Audiencias</p>
        <div className="space-y-2">
          {suggestion.audiences?.map((aud: any, i: number) => (
            <div key={i} className="rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{aud.type}</Badge>
                <span className="font-medium text-sm">{aud.name}</span>
              </div>
              {aud.targeting && (
                <div className="mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground">
                  {aud.targeting.age_min && <span>Edad: {aud.targeting.age_min}-{aud.targeting.age_max}</span>}
                  {aud.targeting.geo_locations?.countries && (
                    <span> | Pais: {aud.targeting.geo_locations.countries.join(", ")}</span>
                  )}
                  {aud.targeting.interests?.length > 0 && (
                    <span> | Intereses: {aud.targeting.interests.map((i: any) => i.name).join(", ")}</span>
                  )}
                </div>
              )}
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
          <p>Diario: ${suggestion.budget?.daily_budget}</p>
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
    </div>
  );
}
