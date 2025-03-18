import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocketServer, WebSocket } from "ws";
import { minecraftBot } from "./bot";
import { botSettingsSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up API routes
  
  // Get bot settings
  app.get("/api/bot/settings", async (req, res) => {
    try {
      const settings = await storage.getBotSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: `Error fetching bot settings: ${error}` });
    }
  });

  // Update bot settings
  app.post("/api/bot/settings", async (req, res) => {
    try {
      const settings = botSettingsSchema.parse(req.body);
      const updatedSettings = await storage.updateBotSettings(settings);
      await minecraftBot.updateSettings(settings);
      res.json(updatedSettings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid settings data", errors: error.errors });
      } else {
        res.status(500).json({ message: `Error updating bot settings: ${error}` });
      }
    }
  });

  // Start the bot
  app.post("/api/bot/start", async (req, res) => {
    try {
      await minecraftBot.start();
      res.json({ message: "Bot started successfully" });
    } catch (error) {
      res.status(500).json({ message: `Error starting bot: ${error}` });
    }
  });

  // Stop the bot
  app.post("/api/bot/stop", async (req, res) => {
    try {
      // Wrap the stop method in a try-catch to handle any errors
      try {
        await minecraftBot.stop();
      } catch (err) {
        console.error("Error during bot stopping:", err);
        // Continue and return success even if there was an error
        // This prevents the UI from getting stuck
      }
      
      // Always return success to prevent UI getting stuck
      res.json({ message: "Bot stopped successfully" });
    } catch (error) {
      console.error("Critical error in stop endpoint:", error);
      // Still return 200 to prevent UI issues
      res.json({ message: "Bot stop initiated" });
    }
  });

  // Get console messages
  app.get("/api/bot/console", async (req, res) => {
    try {
      const messages = await storage.getConsoleMessages();
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: `Error fetching console messages: ${error}` });
    }
  });

  // Clear console messages
  app.post("/api/bot/console/clear", async (req, res) => {
    try {
      await minecraftBot.clearConsole();
      res.json({ message: "Console cleared successfully" });
    } catch (error) {
      res.status(500).json({ message: `Error clearing console: ${error}` });
    }
  });

  // Password login
  app.post("/api/login", async (req, res) => {
    try {
      const { password } = req.body;
      
      // Check password (hardcoded for this specific app)
      if (password === "Ab1365098958") {
        res.json({ success: true });
      } else {
        res.status(401).json({ message: "Invalid password" });
      }
    } catch (error) {
      res.status(500).json({ message: `Error during login: ${error}` });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  // Set up WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');
    
    // Add the client to the bot's clients list
    minecraftBot.addClient(ws);
    
    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message);
        
        // Handle different message types
        switch (data.type) {
          case 'getStatus':
            // Client is requesting current status
            break;
          default:
            console.log(`Unknown message type: ${data.type}`);
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      minecraftBot.removeClient(ws);
    });
  });

  return httpServer;
}
