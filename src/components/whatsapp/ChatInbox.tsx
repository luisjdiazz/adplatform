"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send } from "lucide-react";

interface Contact {
  id: string;
  phone: string;
  name: string | null;
  tags: string[];
  lastMessageAt: string | null;
  messages: Message[];
}

interface Message {
  id: string;
  direction: "IN" | "OUT";
  content: string;
  sentAt: string;
}

interface ChatInboxProps {
  contacts: Contact[];
  onSendMessage: (contactId: string, message: string) => Promise<void>;
}

export function ChatInbox({ contacts, onSendMessage }: ChatInboxProps) {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!selectedContact || !message.trim()) return;
    setSending(true);
    await onSendMessage(selectedContact.id, message);
    setMessage("");
    setSending(false);
  }

  return (
    <div className="grid h-[600px] grid-cols-3 gap-4">
      <Card className="col-span-1 overflow-hidden">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Contactos</CardTitle>
        </CardHeader>
        <CardContent className="overflow-y-auto p-0">
          {contacts.map((contact) => (
            <button
              key={contact.id}
              onClick={() => setSelectedContact(contact)}
              className={`w-full border-b px-4 py-3 text-left transition-colors hover:bg-accent ${
                selectedContact?.id === contact.id ? "bg-accent" : ""
              }`}
            >
              <p className="font-medium text-sm">{contact.name || contact.phone}</p>
              <p className="text-xs text-muted-foreground">{contact.phone}</p>
              <div className="mt-1 flex gap-1">
                {contact.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] px-1 py-0">
                    {tag}
                  </Badge>
                ))}
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="col-span-2 flex flex-col overflow-hidden">
        {selectedContact ? (
          <>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-sm">
                {selectedContact.name || selectedContact.phone}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-2">
              {selectedContact.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === "OUT" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                      msg.direction === "OUT"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p>{msg.content}</p>
                    <p className="mt-1 text-[10px] opacity-70">
                      {new Date(msg.sentAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
            <div className="border-t p-3 flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escribe un mensaje..."
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              />
              <Button size="icon" onClick={handleSend} disabled={sending || !message.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <CardContent className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">Selecciona un contacto</p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
