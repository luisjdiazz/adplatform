"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";

interface Step {
  message: string;
  delay_seconds?: number;
}

interface FlowBuilderProps {
  onSave: (data: { name: string; triggerKeyword: string; steps: Step[] }) => Promise<void>;
}

export function FlowBuilder({ onSave }: FlowBuilderProps) {
  const [name, setName] = useState("");
  const [triggerKeyword, setTriggerKeyword] = useState("");
  const [steps, setSteps] = useState<Step[]>([{ message: "" }]);
  const [saving, setSaving] = useState(false);

  function addStep() {
    setSteps([...steps, { message: "", delay_seconds: 5 }]);
  }

  function removeStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index));
  }

  function updateStep(index: number, field: keyof Step, value: any) {
    const updated = [...steps];
    (updated[index] as any)[field] = value;
    setSteps(updated);
  }

  async function handleSave() {
    if (!name || !triggerKeyword || steps.some((s) => !s.message)) return;
    setSaving(true);
    await onSave({ name, triggerKeyword, steps });
    setSaving(false);
    setName("");
    setTriggerKeyword("");
    setSteps([{ message: "" }]);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Nuevo flujo automatizado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nombre del flujo</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Bienvenida" />
          </div>
          <div className="space-y-2">
            <Label>Palabra clave trigger</Label>
            <Input value={triggerKeyword} onChange={(e) => setTriggerKeyword(e.target.value)} placeholder="Ej: hola, info, precios" />
          </div>
        </div>

        <div className="space-y-3">
          <Label>Pasos del flujo</Label>
          {steps.map((step, i) => (
            <div key={i} className="flex gap-2 items-start">
              <Badge variant="outline" className="mt-2 shrink-0">
                {i + 1}
              </Badge>
              <div className="flex-1 space-y-2">
                <Textarea
                  value={step.message}
                  onChange={(e) => updateStep(i, "message", e.target.value)}
                  placeholder="Mensaje a enviar..."
                  rows={2}
                />
                {i > 0 && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Delay (seg):</Label>
                    <Input
                      type="number"
                      value={step.delay_seconds || 0}
                      onChange={(e) => updateStep(i, "delay_seconds", parseInt(e.target.value))}
                      className="w-20 h-8"
                    />
                  </div>
                )}
              </div>
              {steps.length > 1 && (
                <Button variant="ghost" size="icon" onClick={() => removeStep(i)} className="shrink-0">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={addStep}>
            <Plus className="mr-2 h-4 w-4" /> Agregar paso
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar flujo"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
