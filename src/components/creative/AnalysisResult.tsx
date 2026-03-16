"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface AnalysisResultProps {
  analysis: {
    tipo_creativo?: string;
    duracion_segundos?: number;
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
    // Video-specific fields
    transcripcion?: string;
    analisis_audio?: {
      tiene_voz: boolean;
      tono_voz: string;
      musica: string;
      efectividad_audio: string;
    };
    estructura_narrativa?: {
      hook: string;
      desarrollo: string;
      cierre: string;
    };
    duracion_optima?: string;
    score_viral?: {
      puntuacion: number;
      factores: string[];
    };
  };
}

export function AnalysisResult({ analysis }: AnalysisResultProps) {
  const score = analysis.calidad_visual?.puntuacion || 0;
  const isVideo = analysis.tipo_creativo === "video";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            Analisis del creativo
            {isVideo && (
              <Badge variant="outline" className="text-blue-600 border-blue-300">
                Video - {analysis.duracion_segundos}s
              </Badge>
            )}
          </CardTitle>
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

          <div className="flex gap-4 flex-wrap">
            <Badge variant={analysis.cumple_20_texto ? "success" : "warning"}>
              {analysis.cumple_20_texto ? "Cumple regla 20% texto" : "Excede 20% texto"}
            </Badge>
            <Badge variant="outline">Formato: {analysis.formato_recomendado}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Video: Transcription */}
      {isVideo && analysis.transcripcion && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Transcripcion del audio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm bg-muted p-4 rounded-lg italic">
              &ldquo;{analysis.transcripcion}&rdquo;
            </p>
          </CardContent>
        </Card>
      )}

      {/* Video: Audio Analysis */}
      {isVideo && analysis.analisis_audio && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Analisis de audio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Badge variant={analysis.analisis_audio.tiene_voz ? "success" : "outline"}>
                {analysis.analisis_audio.tiene_voz ? "Tiene voz" : "Sin voz"}
              </Badge>
            </div>
            {analysis.analisis_audio.tono_voz && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tono de voz</p>
                <p className="text-sm">{analysis.analisis_audio.tono_voz}</p>
              </div>
            )}
            {analysis.analisis_audio.musica && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Musica</p>
                <p className="text-sm">{analysis.analisis_audio.musica}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">Efectividad del audio</p>
              <p className="text-sm">{analysis.analisis_audio.efectividad_audio}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Video: Narrative Structure */}
      {isVideo && analysis.estructura_narrativa && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Estructura narrativa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium text-blue-600">Hook (primeros segundos)</p>
              <p className="text-sm">{analysis.estructura_narrativa.hook}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-purple-600">Desarrollo</p>
              <p className="text-sm">{analysis.estructura_narrativa.desarrollo}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-green-600">Cierre</p>
              <p className="text-sm">{analysis.estructura_narrativa.cierre}</p>
            </div>
            {analysis.duracion_optima && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Duracion optima</p>
                <p className="text-sm">{analysis.duracion_optima}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Video: Viral Score */}
      {isVideo && analysis.score_viral && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Score viral</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-muted-foreground">Potencial viral</p>
                <span className="text-sm font-bold">{analysis.score_viral.puntuacion}/10</span>
              </div>
              <Progress value={analysis.score_viral.puntuacion * 10} />
            </div>
            <ul className="space-y-1">
              {analysis.score_viral.factores?.map((f, i) => (
                <li key={i} className="text-sm text-muted-foreground">- {f}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

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
