"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ChatInbox } from "@/components/whatsapp/ChatInbox";
import { FlowBuilder } from "@/components/whatsapp/FlowBuilder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function WhatsAppPage() {
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [flows, setFlows] = useState<any[]>([]);

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
    Promise.all([
      fetch(`/api/whatsapp/contacts?clientId=${selectedClient}`).then((r) => r.json()),
      fetch(`/api/whatsapp/flows?clientId=${selectedClient}`).then((r) => r.json()),
    ]).then(([contactsData, flowsData]) => {
      setContacts(contactsData.contacts || []);
      setFlows(flowsData.flows || []);
    }).catch(() => {});
  }, [selectedClient]);

  async function handleSendMessage(contactId: string, message: string) {
    await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, message }),
    });
  }

  async function handleSaveFlow(data: any) {
    await fetch("/api/whatsapp/flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, clientId: selectedClient }),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">WhatsApp CRM</h2>
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

      <Tabs defaultValue="inbox">
        <TabsList>
          <TabsTrigger value="inbox">Bandeja de entrada</TabsTrigger>
          <TabsTrigger value="flows">Flujos automaticos</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox">
          <ChatInbox contacts={contacts} onSendMessage={handleSendMessage} />
        </TabsContent>

        <TabsContent value="flows" className="space-y-4">
          <FlowBuilder onSave={handleSaveFlow} />
          {flows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Flujos configurados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {flows.map((flow: any) => (
                    <div key={flow.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-medium">{flow.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Trigger: &quot;{flow.triggerKeyword}&quot; | {(flow.steps as any[])?.length || 0} pasos
                        </p>
                      </div>
                      <Badge variant={flow.isActive ? "success" : "secondary"}>
                        {flow.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
