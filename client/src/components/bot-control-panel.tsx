import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BotSettings } from "@shared/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlayCircle, StopCircle, AlertTriangle } from "lucide-react";

export function BotControlPanel({ botConnected }: { botConnected: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch bot settings
  const { data: settings, isLoading: isLoadingSettings } = useQuery<BotSettings>({
    queryKey: ["/api/bot/settings"],
  });

  // Local state for form fields
  const [formSettings, setFormSettings] = useState<BotSettings>({
    serverAddress: "",
    botUsername: "",
    posX: 0,
    posY: 64,
    posZ: 0,
  });

  // Update local state when settings are loaded
  useEffect(() => {
    if (settings) {
      setFormSettings(settings);
    }
  }, [settings]);

  // Start bot mutation
  const startBotMutation = useMutation({
    mutationFn: async () => {
      // Check for placeholder server address before starting
      if (formSettings.serverAddress === "mc.example.com") {
        toast({
          title: "Cannot Connect",
          description: "Please update the server address. 'mc.example.com' is just a placeholder.",
          variant: "destructive",
        });
        throw new Error("Invalid server address");
      }
      
      // Make the request to start the bot
      await apiRequest("POST", "/api/bot/start");
    },
    onSuccess: () => {
      if (formSettings.serverAddress === "mc.example.com") {
        // Double check to prevent this message from showing with the example domain
        toast({
          title: "Warning: Using Example Address",
          description: "The bot is trying to connect to a non-existent server. Please update settings.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Bot Started",
          description: "Attempting to connect to " + formSettings.serverAddress + "...",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Failed to Start Bot",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Stop bot mutation
  const stopBotMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/bot/stop");
    },
    onSuccess: () => {
      toast({
        title: "Bot Stopped",
        description: "The Minecraft bot has been stopped.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Stop Bot",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: BotSettings) => {
      const res = await apiRequest("POST", "/api/bot/settings", newSettings);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bot/settings"] });
      toast({
        title: "Settings Updated",
        description: "Bot settings have been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Update Settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    
    // For numeric fields, convert to integer
    if (id === "pos-x" || id === "pos-y" || id === "pos-z") {
      const numValue = parseInt(value, 10) || 0;
      
      setFormSettings(prev => ({
        ...prev,
        [id === "pos-x" ? "posX" : id === "pos-y" ? "posY" : "posZ"]: numValue
      }));
    } else {
      setFormSettings(prev => ({
        ...prev,
        [id === "server-address" ? "serverAddress" : "botUsername"]: value
      }));
    }
    
    // Auto-save settings when changed
    if (settings) {
      const newSettings = {
        ...formSettings,
        [id === "server-address" ? "serverAddress" : 
          id === "bot-username" ? "botUsername" : 
          id === "pos-x" ? "posX" : 
          id === "pos-y" ? "posY" : "posZ"]: 
          (id === "pos-x" || id === "pos-y" || id === "pos-z") ? 
            (parseInt(value, 10) || 0) : value
      };
      
      updateSettingsMutation.mutate(newSettings);
    }
  };

  // Handle start bot
  const handleStartBot = () => {
    startBotMutation.mutate();
  };

  // Handle stop bot
  const handleStopBot = () => {
    stopBotMutation.mutate();
  };

  if (isLoadingSettings) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="lg:col-span-1">
      <div className="bg-white rounded-lg shadow-lg border-2 border-secondary p-6">
        <h2 className="text-xl font-minecraft text-primary mb-4 border-b-2 border-secondary pb-2">
          Bot Control
        </h2>
        
        {/* Server Address Warning */}
        {formSettings.serverAddress === "mc.example.com" && botConnected && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Warning: Using Example Server Address</h3>
                <p className="text-sm text-red-700 mt-1">
                  The bot is trying to connect to a non-existent server. Please update the server address in the settings below.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Bot Status */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">Status</h3>
          <div className="flex items-center">
            <div 
              className={`w-4 h-4 rounded-full ${botConnected ? 'bg-success' : 'bg-error'} mr-2`}
            ></div>
            <span className="font-medium">{botConnected ? 'Online' : 'Offline'}</span>
          </div>
        </div>
        
        {/* Bot Controls */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">Controls</h3>
          <div className="grid grid-cols-2 gap-4">
            <Button
              id="start-btn"
              variant="default"
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-minecraft py-2 px-4 rounded shadow-pixel transition-colors"
              style={{ backgroundColor: '#10b981' }} 
              onClick={handleStartBot}
              disabled={botConnected || startBotMutation.isPending}
            >
              {startBotMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <PlayCircle className="h-4 w-4 mr-1" />
              )}
              Start Bot
            </Button>
            
            <Button
              id="stop-btn"
              variant="default"
              className="bg-rose-500 hover:bg-rose-600 text-white font-minecraft py-2 px-4 rounded shadow-pixel transition-colors"
              style={{ backgroundColor: '#ef4444' }}
              onClick={handleStopBot}
              disabled={!botConnected || stopBotMutation.isPending}
            >
              {stopBotMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <StopCircle className="h-4 w-4 mr-1" />
              )}
              Stop Bot
            </Button>
          </div>
        </div>
        
        {/* Connection Settings */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">Server Settings</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="server-address" className="block text-sm font-medium text-gray-700 mb-1">
                Server Address
              </label>
              <Input
                type="text"
                id="server-address"
                value={formSettings.serverAddress}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                  formSettings.serverAddress === "mc.example.com" ? "border-red-500 bg-red-50" : "border-gray-300"
                }`}
                placeholder="Enter a valid Minecraft server address"
              />
              {formSettings.serverAddress === "mc.example.com" && (
                <p className="mt-1 text-sm text-red-600">
                  <strong>Warning:</strong> This is a placeholder address. Please change it to a real Minecraft server.
                </p>
              )}
              {formSettings.serverAddress === "" && (
                <p className="mt-1 text-sm text-amber-600">
                  Please enter a valid Minecraft server address to connect.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="bot-username" className="block text-sm font-medium text-gray-700 mb-1">
                Bot Username
              </label>
              <Input
                type="text"
                id="bot-username"
                value={formSettings.botUsername}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter a username for the bot"
              />
              {formSettings.botUsername === "" && (
                <p className="mt-1 text-sm text-amber-600">
                  Please enter a username for the bot to use when connecting.
                </p>
              )}
            </div>
          </div>
        </div>
        
        {/* Spawn Point Settings */}
        <div>
          <h3 className="text-lg font-medium mb-2">Spawn Point</h3>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label htmlFor="pos-x" className="block text-sm font-medium text-gray-700 mb-1">
                X
              </label>
              <Input
                type="number"
                id="pos-x"
                value={formSettings.posX}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="pos-y" className="block text-sm font-medium text-gray-700 mb-1">
                Y
              </label>
              <Input
                type="number"
                id="pos-y"
                value={formSettings.posY}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="pos-z" className="block text-sm font-medium text-gray-700 mb-1">
                Z
              </label>
              <Input
                type="number"
                id="pos-z"
                value={formSettings.posZ}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
