"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface LogEntry {
  id: string;
  action: string;
  reason: string;
  createdAt: string;
  rule?: { name: string; mode: string } | null;
  approvedBy?: { name: string } | null;
}

export function ActionLog({ logs }: { logs: LogEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Historial de acciones</CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay acciones registradas</p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start justify-between rounded-lg border p-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{log.action}</p>
                  <p className="text-xs text-muted-foreground">{log.reason}</p>
                  {log.rule && (
                    <Badge variant="outline" className="text-xs">
                      {log.rule.name} ({log.rule.mode})
                    </Badge>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString("es-MX")}
                  </p>
                  {log.approvedBy && (
                    <p className="text-xs text-muted-foreground">
                      Aprobado por: {log.approvedBy.name}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
