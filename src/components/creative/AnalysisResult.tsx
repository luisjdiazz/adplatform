"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface AnalysisResultProps {
  analysis: {
    producto: string;
    tono_emocional: string;
    colores_dominantes: string[];
    cta_implicito: string;
    calidad_visual: {
      puntuacion: number;
      aspectos_positivos: string[];
      aspectos_a_mejorar: string[];
    };
    texto_detectado: string;
    formato_recomendado: string;
    cumple_20_texto: boolean;
    sugerencias: string[];
  };
}

export function AnalysisResult({ analysis }: AnalysisResultProps) {
  const score = analysis.calidad_visual?.puntuacion || 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Analisis del creativo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Producto detectado</p>
            <p>{analysis.producto}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground">Tono emocional</p>
            <p>{analysis.tono_emocional}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground">Colores dominantes</p>
            <div className="flex gap-2 mt-1">
              {analysis.colores_dominantes?.map((color, i) => (
                <Badge key={i} variant="outline">{color}</Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground">CTA implicito</p>
            <p>{analysis.cta_implicito}</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-muted-foreground">Calidad visual</p>
              <span className="text-sm font-bold">{score}/10</span>
            </div>
            <Progress value={score * 10} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-green-600">Aspectos positivos</p>
              <ul className="mt-1 space-y-1">
                {analysis.calidad_visual?.aspectos_positivos?.map((a, i) => (
                  <li key={i} className="text-sm">+ {a}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-orange-600">A mejorar</p>
              <ul className="mt-1 space-y-1">
                {analysis.calidad_visual?.aspectos_a_mejorar?.map((a, i) => (
                  <li key={i} className="text-sm">- {a}</li>
                ))}
              </ul>
            </div>
          </div>

          {analysis.texto_detectado && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Texto detectado</p>
              <p className="text-sm">{analysis.texto_detectado}</p>
            </div>
          )}

          <div className="flex gap-4">
            <Badge variant={analysis.cumple_20_texto ? "success" : "warning"}>
              {analysis.cumple_20_texto ? "Cumple regla 20% texto" : "Excede 20% texto"}
            </Badge>
            <Badge variant="outline">Formato: {analysis.formato_recomendado}</Badge>
          </div>
        </CardContent>
      </Card>

      {analysis.sugerencias?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sugerencias</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analysis.sugerencias.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="font-medium text-primary">{i + 1}.</span> {s}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
