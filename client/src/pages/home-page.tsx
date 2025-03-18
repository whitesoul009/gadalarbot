import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { BotControlPanel } from "@/components/bot-control-panel";
import { BotStateConsole } from "@/components/bot-state-console";
import { useWebSocket } from "@/hooks/use-websocket";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default function HomePage() {
  const [_, setLocation] = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const { isConnected, botStatus, consoleMessages } = useWebSocket();

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/auth");
    }
  }, [isAuthenticated, setLocation]);

  const handleLogout = () => {
    logout();
    setLocation("/auth");
  };

  return (
    <div
      className="min-h-screen py-8 px-4"
      style={{
        backgroundImage: "url('https://images.unsplash.com/photo-1607513746994-51f730a44832?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.0.3')",
        backgroundSize: "cover",
        backgroundAttachment: "fixed",
        backgroundPosition: "center",
      }}
    >
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-lg shadow-lg border-2 border-secondary">
            <div className="flex items-center mb-4 md:mb-0">
              <h1 className="text-3xl font-minecraft text-primary">
                MineCraft Bot Controller
              </h1>
            </div>
            <div className="flex space-x-4">
              <Button
                id="logout-btn" 
                variant="default"
                className="bg-blue-500 text-white px-4 py-2 rounded shadow-pixel font-minecraft hover:bg-blue-600 transition-colors"
                style={{ backgroundColor: '#3b82f6' }}
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-1" /> Logout
              </Button>
            </div>
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bot Control Panel */}
          <BotControlPanel botConnected={botStatus.connected} />

          {/* Bot State and Console */}
          <BotStateConsole
            botStatus={botStatus}
            consoleMessages={consoleMessages}
          />
        </div>
      </div>
    </div>
  );
}
