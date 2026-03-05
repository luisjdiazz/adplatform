"use client";

import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CreativeUploader } from "@/components/creative/CreativeUploader";
import { AnalysisResult } from "@/components/creative/AnalysisResult";
import { CampaignBuilder } from "@/components/creative/CampaignBuilder";

export default function CreativeAnalyzerPage() {
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [campaignSuggestion, setCampaignSuggestion] = useState<any>(null);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data) => {
        const list = data.clients || [];
        setClients(list);
        if (list.length > 0) setSelectedClient(list[0].id);
      });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Creative Analyzer</h2>
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
      </div>

      {selectedClient && (
        <CreativeUploader
          clientId={selectedClient}
          onAnalysisComplete={(data) => setAnalysisData(data)}
        />
      )}

      {analysisData?.analysisResult && (
        <>
          <AnalysisResult analysis={analysisData.analysisResult} />
          <CampaignBuilder
            clientId={selectedClient}
            creativeUploadId={analysisData.upload.id}
            analysisResult={analysisData.analysisResult}
            onCampaignGenerated={setCampaignSuggestion}
          />
        </>
      )}
    </div>
  );
}
