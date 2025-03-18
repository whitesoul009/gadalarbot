import { useEffect, useRef } from "react";
import { BotStatus, ConsoleMessage } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BotStateConsoleProps {
  botStatus: BotStatus;
  consoleMessages: ConsoleMessage[];
}

export function BotStateConsole({ botStatus, consoleMessages }: BotStateConsoleProps) {
  const { toast } = useToast();
  const consoleRef = useRef<HTMLDivElement>(null);

  // Clear console mutation
  const clearConsoleMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/bot/console/clear");
    },
    onSuccess: () => {
      toast({
        title: "Console Cleared",
        description: "The console has been cleared.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Clear Console",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Auto scroll console to bottom
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [consoleMessages]);

  // Handle clear console
  const handleClearConsole = () => {
    clearConsoleMutation.mutate();
  };

  return (
    <div className="lg:col-span-2">
      {/* Bot State */}
      <div className="bg-white rounded-lg shadow-lg border-2 border-secondary p-6 mb-6">
        <h2 className="text-xl font-minecraft text-primary mb-4 border-b-2 border-secondary pb-2">
          Bot State
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Current Activity */}
          <div>
            <h3 className="text-lg font-medium mb-2">Current Activity</h3>
            <div className="bg-gray-100 p-4 rounded-lg">
              <div className="flex items-center mb-2">
                <span className="material-icons text-primary mr-2">
                  {botStatus.activity === "Sleeping" ? "hotel" : "directions_walk"}
                </span>
                <span className="font-medium">{botStatus.activity}</span>
              </div>
              <div className="w-full day-night-indicator mb-2"></div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Day</span>
                <span>Night</span>
              </div>
            </div>
          </div>
          
          {/* Players Online */}
          <div>
            <h3 className="text-lg font-medium mb-2">Players Online</h3>
            <div className="bg-gray-100 p-4 rounded-lg">
              <div className="text-xl font-medium mb-2">
                {botStatus.players.length} players
              </div>
              <div className="max-h-32 overflow-y-auto">
                <ul className="list-disc pl-5 space-y-1">
                  {botStatus.players.length === 0 ? (
                    <li className="text-gray-500 italic">No players online</li>
                  ) : (
                    botStatus.players.map((player, index) => (
                      <li key={index}>{player}</li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </div>
          
          {/* Position */}
          <div>
            <h3 className="text-lg font-medium mb-2">Current Position</h3>
            <div className="bg-gray-100 p-4 rounded-lg grid grid-cols-3 gap-2">
              <div>
                <div className="text-sm text-gray-600">X</div>
                <div className="font-mono">{botStatus.position.x}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Y</div>
                <div className="font-mono">{botStatus.position.y}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Z</div>
                <div className="font-mono">{botStatus.position.z}</div>
              </div>
            </div>
          </div>
          
          {/* 3x3 Area Visualization */}
          <div>
            <h3 className="text-lg font-medium mb-2">3x3 Area</h3>
            <div className="bg-gray-100 p-4 rounded-lg">
              <div className="grid grid-cols-3 gap-1 w-full max-w-[150px] mx-auto">
                {botStatus.area.map((isActive, index) => (
                  <div
                    key={index}
                    className={`aspect-square border border-gray-400 ${
                      isActive ? "bg-emerald-500" : "bg-white"
                    }`}
                    style={isActive ? { backgroundColor: '#10b981' } : {}}
                  ></div>
                ))}
              </div>
              <div className="text-xs text-center mt-2 text-gray-600">
                Green square marks bot position
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Console Output */}
      <div className="bg-white rounded-lg shadow-lg border-2 border-secondary p-6">
        <div className="flex justify-between items-center mb-4 border-b-2 border-secondary pb-2">
          <h2 className="text-xl font-minecraft text-primary">Console Output</h2>
          <Button
            id="clear-console-btn"
            variant="ghost"
            size="sm"
            className="text-accent hover:text-error"
            onClick={handleClearConsole}
            disabled={clearConsoleMutation.isPending}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
        
        <div
          ref={consoleRef}
          className="console-output p-4 rounded-lg"
          id="console-container"
        >
          {consoleMessages.length === 0 ? (
            <p>
              <span className="console-timestamp">[00:00:00]</span>{" "}
              <span className="console-info">
                System ready. Waiting for connection...
              </span>
            </p>
          ) : (
            consoleMessages.map((msg, index) => (
              <p key={index}>
                <span className="console-timestamp">[{msg.timestamp}]</span>{" "}
                <span className={`console-${msg.type}`}>{msg.message}</span>
              </p>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
