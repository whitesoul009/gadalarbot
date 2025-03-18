import mineflayer from "mineflayer";
import { Vec3 } from "vec3";
import { storage } from "./storage";
import { BotStatus, BotSettings, ConsoleMessage } from "@shared/schema";
import { WebSocket } from "ws";
import { pathfinder, Movements } from "mineflayer-pathfinder";
import pathfinderPkg from "mineflayer-pathfinder";
const { goals } = pathfinderPkg;

class MinecraftBot {
  private bot: mineflayer.Bot | null = null;
  private settings: BotSettings | null = null;
  private running: boolean = false;
  private homePosition: Vec3 | null = null;
  private clients: Set<WebSocket> = new Set();
  private timeoutId: NodeJS.Timeout | null = null;

  constructor() {
    this.initialize();
  }

  async initialize() {
    this.settings = await storage.getBotSettings();
    this.addConsoleMessage("Bot controller initialized", "info");
  }

  addClient(client: WebSocket) {
    this.clients.add(client);
    this.broadcastStatus();
  }

  removeClient(client: WebSocket) {
    this.clients.delete(client);
  }

  async start() {
    if (this.running) {
      this.addConsoleMessage("Bot is already running", "warning");
      return;
    }

    this.settings = await storage.getBotSettings();
    
    // Validate server address before attempting to connect
    if (!this.settings.serverAddress || this.settings.serverAddress === "mc.example.com") {
      this.addConsoleMessage("ERROR: Invalid server address. Please update settings with a real Minecraft server address.", "error");
      this.addConsoleMessage("The current address 'mc.example.com' is just a placeholder and doesn't exist.", "error");
      // Don't set running to true since we're not actually connecting
      this.broadcastStatus();
      return;
    }
    
    this.running = true;
    this.broadcastStatus();

    try {
      this.addConsoleMessage(`Starting bot with username ${this.settings.botUsername}`, "info");
      this.addConsoleMessage(`Connecting to server ${this.settings.serverAddress}...`, "info");

      // Add a timeout to detect connection failures
      const connectionTimeout = setTimeout(() => {
        if (this.running && (!this.bot || !this.bot.entity)) {
          this.addConsoleMessage(`CONNECTION FAILED: Could not connect to ${this.settings?.serverAddress || 'unknown server'}`, "error");
          this.addConsoleMessage("Please check the server address and make sure the Minecraft server is online.", "error");
          this.running = false;
          this.bot = null;
          this.broadcastStatus();
        }
      }, 10000); // 10 second timeout

      this.bot = mineflayer.createBot({
        host: this.settings.serverAddress,
        username: this.settings.botUsername,
        port: 25565, // Default Minecraft server port
        closeTimeout: 10000, // Close connection if timeout
      });

      // Set up error handler before anything else
      this.bot.on('error', (err) => {
        clearTimeout(connectionTimeout);
        this.addConsoleMessage(`CONNECTION ERROR: ${err.message}`, "error");
        
        if (err.message.includes('ENOTFOUND')) {
          this.addConsoleMessage(`Server '${this.settings?.serverAddress}' does not exist or cannot be reached.`, "error");
          this.addConsoleMessage("Please update settings with a valid Minecraft server address.", "error");
        } else if (err.message.includes('ETIMEDOUT')) {
          this.addConsoleMessage("Connection timed out. Server may be offline or unreachable.", "error");
        }
        
        this.running = false;
        this.bot = null;
        this.broadcastStatus();
      });

      // Load pathfinder plugin
      this.bot.loadPlugin(pathfinder);
      
      this.setupEventHandlers();
      
      // Once spawn happens, clear the connection timeout
      this.bot.once('spawn', () => {
        clearTimeout(connectionTimeout);
      });
      
      // Create a separate interval to constantly check if the bot is in bed with no players online
      // This is a failsafe in case the playerLeft event doesn't trigger the wake-up
      const wakeupInterval = setInterval(() => {
        if (!this.running) {
          // If the bot is no longer running, clear this interval
          clearInterval(wakeupInterval);
          return;
        }
        
        if (this.bot) {
          // If the bot is sleeping, check if it should be forced to wake up
          if (this.bot.isSleeping) {
            this.forceWakeUpNow(); // Use our dedicated wake-up method
          }
          
          // Also run a regular sleep condition check to detect day/night changes
          this.checkSleepConditions();
        }
      }, 2000); // Check every 2 seconds
      
    } catch (error) {
      this.addConsoleMessage(`CRITICAL ERROR STARTING BOT: ${error}`, "error");
      this.running = false;
      this.broadcastStatus();
    }
  }

  async stop() {
    try {
      // Check if bot is already stopped
      if (!this.running) {
        this.addConsoleMessage("Bot is already stopped", "info");
        return;
      }

      // Clear any pending timeouts
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }

      this.addConsoleMessage("Stopping bot and disconnecting from server...", "info");
      
      // Set state to not running first to prevent race conditions
      this.running = false;
      
      // Only try to quit if the bot exists
      if (this.bot) {
        try {
          this.bot.quit();
        } catch (err) {
          this.addConsoleMessage(`Error during bot.quit(): ${err}`, "error");
          // Continue anyway to cleanup
        }
      }
      
      // Reset all state
      this.bot = null;
      this.homePosition = null;
      
      // Update clients
      this.broadcastStatus();
      this.addConsoleMessage("Bot stopped successfully", "info");
    } catch (error) {
      // Log the error but still mark the bot as stopped
      this.addConsoleMessage(`Error during bot stop: ${error}`, "error");
      this.running = false;
      this.bot = null;
      this.broadcastStatus();
    }
  }

  private setupEventHandlers() {
    if (!this.bot) return;

    this.bot.once("spawn", () => {
      this.addConsoleMessage("Bot has spawned in the world", "info");
      
      // Set home position
      this.homePosition = new Vec3(
        this.settings!.posX,
        this.settings!.posY,
        this.settings!.posZ
      );
      
      this.addConsoleMessage(`Setting home position to X:${this.homePosition.x} Y:${this.homePosition.y} Z:${this.homePosition.z}`, "info");
      this.broadcastStatus();
      
      // Immediately check sleep conditions in case we're in a bed when connecting
      this.checkSleepConditions();
      
      // Start wandering behavior
      this.startWandering();
      
      // Add a check shortly after spawn to make sure we're not in bed when no players are online
      setTimeout(() => {
        if (this.bot && this.running) {
          this.checkSleepConditions();
        }
      }, 5000); // Check again after 5 seconds
    });

    this.bot.on("kicked", (reason) => {
      this.addConsoleMessage(`Bot was kicked: ${reason}`, "error");
      this.running = false;
      this.bot = null;
      this.broadcastStatus();
    });

    this.bot.on("error", (err) => {
      this.addConsoleMessage(`Bot error: ${err.message}`, "error");
    });

    this.bot.on("playerJoined", (player) => {
      this.addConsoleMessage(`Player ${player.username} joined the game`, "info");
      this.broadcastStatus();
      this.checkSleepConditions();
    });

    this.bot.on("playerLeft", (player) => {
      this.addConsoleMessage(`Player ${player.username} left the game`, "info");
      this.broadcastStatus();
      
      // Only proceed if the bot exists
      if (this.bot) {
        // Special check to see if this was the last player leaving
        const players = this.bot.players || {};
        const otherPlayers = Object.keys(players).filter(name => name !== this.bot!.username);
          
        // If this was the last player leaving, immediately try to wake up without conditions
        if (otherPlayers.length === 0) {
          this.addConsoleMessage("CRITICAL EVENT: Last player left the game - checking sleep status", "warning");
          
          // Directly call the dedicated force wake method
          this.forceWakeUpNow();
          
          // Call it multiple times to ensure it works (some Minecraft servers have race conditions)
          setTimeout(() => this.forceWakeUpNow(), 500);
          setTimeout(() => this.forceWakeUpNow(), 1500);
          setTimeout(() => this.forceWakeUpNow(), 3000);
        }
        
        // Also run the standard check as a backup
        this.checkSleepConditions();
      }
    });

    this.bot.on("time", () => {
      this.broadcastStatus();
      this.checkSleepConditions();
    });

    this.bot.on("move", () => {
      this.broadcastStatus();
    });
  }

  private startWandering() {
    if (!this.bot || !this.homePosition || !this.running) return;

    this.addConsoleMessage("Starting wandering behavior in 3x3 area", "info");
    
    // Initialize pathfinder movements with default values
    const defaultMovements = new Movements(this.bot);
    
    // Strictly limit the movement range
    defaultMovements.canDig = false;
    defaultMovements.allowSprinting = false;
    defaultMovements.allow1by1towers = false;
    
    this.bot.pathfinder.setMovements(defaultMovements);
    
    // Add a check for position enforcement
    const enforceAreaBoundaries = () => {
      if (!this.bot || !this.homePosition || !this.running) return;
      
      const currentPos = this.bot.entity.position;
      const distanceFromHome = Math.max(
        Math.abs(Math.floor(currentPos.x) - this.homePosition.x),
        Math.abs(Math.floor(currentPos.z) - this.homePosition.z)
      );
      
      // If bot is outside the 3x3 area (more than 1 block from center in any direction), teleport back
      if (distanceFromHome > 1) {
        this.addConsoleMessage(`Bot escaped 3x3 area! Returning to home position`, "warning");
        // Force the bot to move back to the center of the 3x3 area
        this.bot.pathfinder.setGoal(null);
        
        const goal = new goals.GoalBlock(
          this.homePosition.x,
          this.homePosition.y,
          this.homePosition.z
        );
        
        this.bot.pathfinder.setGoal(goal);
      }
    };
    
    // Check boundaries every second
    const boundaryCheckInterval = setInterval(() => {
      if (!this.running) {
        clearInterval(boundaryCheckInterval);
        return;
      }
      enforceAreaBoundaries();
    }, 1000);
    
    // Direct movement function using bot's control mechanisms
    const moveDirectly = (x: number, y: number, z: number) => {
      if (!this.bot || !this.running) return;
      
      try {
        // First clear any existing pathfinder goals to avoid conflicts
        this.bot.pathfinder.setGoal(null);
        
        // Get current position
        const currentPos = this.bot.entity.position;
        
        // Determine direction
        const dx = x - Math.floor(currentPos.x);
        const dz = z - Math.floor(currentPos.z);
        
        // Simple direct movement using control states
        if (dx > 0) {
          this.bot.setControlState('forward', true);
          this.bot.lookAt(new Vec3(currentPos.x + 1, currentPos.y, currentPos.z));
        } else if (dx < 0) {
          this.bot.setControlState('forward', true);
          this.bot.lookAt(new Vec3(currentPos.x - 1, currentPos.y, currentPos.z));
        } else if (dz > 0) {
          this.bot.setControlState('forward', true);
          this.bot.lookAt(new Vec3(currentPos.x, currentPos.y, currentPos.z + 1));
        } else if (dz < 0) {
          this.bot.setControlState('forward', true);
          this.bot.lookAt(new Vec3(currentPos.x, currentPos.y, currentPos.z - 1));
        }
        
        // After 1 second, clear the control state
        setTimeout(() => {
          if (this.bot) {
            this.bot.setControlState('forward', false);
          }
        }, 1000);
        
        this.addConsoleMessage(`Moving directly to X:${x} Y:${y} Z:${z}`, "info");
      } catch (error) {
        this.addConsoleMessage(`Error during direct movement: ${error}`, "error");
        
        // Make sure to clear control states if there's an error
        if (this.bot) {
          this.bot.clearControlStates();
        }
      }
    };
    
    const wanderStep = () => {
      if (!this.bot || !this.homePosition || !this.running) {
        clearInterval(boundaryCheckInterval);
        return;
      }
      
      // Check if bot should sleep
      if (this.shouldSleep()) {
        this.findAndSleepInBed();
        return;
      }
      
      // Get a random position in the 3x3 area
      const offsetX = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
      const offsetZ = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
      
      const targetX = this.homePosition.x + offsetX;
      const targetY = this.homePosition.y;
      const targetZ = this.homePosition.z + offsetZ;
      
      try {
        this.addConsoleMessage(`Wandering to position X:${targetX} Y:${targetY} Z:${targetZ}`, "info");
        
        // Use direct movement for more reliable results
        moveDirectly(targetX, targetY, targetZ);
        
        // Schedule next wander step after a timeout (don't rely on goal_reached event)
        const waitTime = 5000 + Math.random() * 3000; // 5-8 seconds
        
        // Clear previous timeout if it exists
        if (this.timeoutId) {
          clearTimeout(this.timeoutId);
        }
        
        // Set new timeout for next movement
        this.timeoutId = setTimeout(wanderStep, waitTime);
        
      } catch (error) {
        this.addConsoleMessage(`Error during wandering: ${error}`, "error");
        
        // Retry after a short delay if there's an error
        if (this.timeoutId) {
          clearTimeout(this.timeoutId);
        }
        this.timeoutId = setTimeout(wanderStep, 3000);
      }
    };
    
    // Start the wandering cycle immediately
    wanderStep();
    
    // Also set an interval to ensure wandering continues even if other mechanisms fail
    setInterval(() => {
      if (this.running && this.bot && !this.bot.isSleeping && !this.shouldSleep()) {
        // Only trigger a new wander step if we're not already busy with a recent movement
        const timeSinceLastAction = this.timeoutId ? Date.now() - (this.timeoutId as any)._idleStart : 10000;
        if (timeSinceLastAction > 8000) { // If it's been more than 8 seconds since last movement
          this.addConsoleMessage("No movement detected for a while, forcing new wander step", "info");
          wanderStep();
        }
      }
    }, 10000); // Check every 10 seconds
  }

  private shouldSleep(): boolean {
    if (!this.bot) return false;
    
    const isNightTime = this.bot.time && this.bot.time.timeOfDay >= 13000 && this.bot.time.timeOfDay <= 23000;
    const playersOnline = this.bot.players ? Object.keys(this.bot.players).length > 1 : false; // More than just the bot
    
    if (isNightTime && playersOnline) {
      this.addConsoleMessage("Night time detected with players online - should sleep", "info");
      return true;
    }
    
    return false;
  }

  private findAndSleepInBed() {
    if (!this.bot) return;
    
    this.addConsoleMessage("Looking for a bed to sleep in...", "info");
    
    // Find the nearest bed
    const bed = this.bot.findBlock({
      matching: (block) => {
        return block.name.includes("bed");
      },
      maxDistance: 10,
    });
    
    if (!bed) {
      this.addConsoleMessage("No bed found nearby", "warning");
      return;
    }
    
    this.addConsoleMessage(`Found a bed at X:${bed.position.x} Y:${bed.position.y} Z:${bed.position.z}`, "info");
    
    try {
      // Clear any existing goals
      this.bot.pathfinder.setGoal(null);
      
      // Create a goal to move near the bed
      const goal = new goals.GoalNear(
        bed.position.x, 
        bed.position.y, 
        bed.position.z, 
        1 // Distance from target block
      );
      
      // Set the pathfinding goal
      this.bot.pathfinder.setGoal(goal);
      
      // When pathfinder reaches the goal, sleep in the bed
      this.bot.once('goal_reached', () => {
        this.addConsoleMessage("Reached the bed, attempting to sleep", "info");
        
        if (this.bot) {
          this.bot.sleep(bed).then(() => {
            this.addConsoleMessage("Bot is now sleeping in bed", "info");
            this.broadcastStatus();
          }).catch((err) => {
            this.addConsoleMessage(`Failed to sleep in bed: ${err.message}`, "error");
          });
        }
      });
    } catch (error) {
      this.addConsoleMessage(`Error trying to sleep: ${error}`, "error");
    }
  }

  private checkSleepConditions() {
    if (!this.bot || !this.running) return;
    
    const isInBed = this.bot.isSleeping;
    const players = this.bot.players || {};
    const playerNames = Object.keys(players).filter(name => name !== this.bot?.username);
    const playersOnline = playerNames.length > 0;
    const isNightTime = this.bot.time && this.bot.time.timeOfDay >= 13000 && this.bot.time.timeOfDay <= 23000;
    
    // CRITICAL: Wake up immediately if in bed and no players are online
    if (isInBed && !playersOnline) {
      this.addConsoleMessage("WAKE UP TRIGGER: No players online while sleeping!", "warning");
      
      // Force wake up with multiple attempts if needed
      const attemptWakeUp = () => {
        if (!this.bot || !this.bot.isSleeping) return;
        
        this.addConsoleMessage("Attempting to wake up bot...", "info");
        this.bot.wake().catch(err => {
          this.addConsoleMessage(`Error during wake attempt: ${err.message}`, "error");
          
          // Try again after a short delay if still sleeping
          setTimeout(() => {
            if (this.bot && this.bot.isSleeping) {
              this.addConsoleMessage("Bot still sleeping, retrying wake up...", "warning");
              attemptWakeUp();
            }
          }, 1000);
        });
      };
      
      attemptWakeUp();
      return;
    }
    
    // Regular sleep condition checks
    if (isInBed && !isNightTime) {
      // Wake up if it's daytime
      this.addConsoleMessage("Daytime detected - waking up from bed", "info");
      this.bot.wake().catch(err => {
        this.addConsoleMessage(`Error waking up: ${err.message}`, "error");
      });
    } else if (!isInBed && isNightTime && playersOnline) {
      // Should try to sleep
      this.findAndSleepInBed();
    }
  }

  getBotStatus(): BotStatus {
    let status: BotStatus = {
      connected: this.running && this.bot !== null,
      activity: "Idle",
      position: { x: 0, y: 0, z: 0 },
      time: "day",
      players: [],
      area: Array(9).fill(false),
    };
    
    if (this.bot && this.running) {
      // Get current activity
      if (this.bot.isSleeping) {
        status.activity = "Sleeping";
      } else if (this.running) {
        status.activity = "Wandering in 3x3 area";
      }
      
      // Get current position
      if (this.bot.entity && this.bot.entity.position) {
        status.position = {
          x: Math.floor(this.bot.entity.position.x),
          y: Math.floor(this.bot.entity.position.y),
          z: Math.floor(this.bot.entity.position.z),
        };
      }
      
      // Get time of day
      if (this.bot.time) {
        const timeOfDay = this.bot.time.timeOfDay;
        if (timeOfDay >= 0 && timeOfDay < 13000) {
          status.time = "day";
        } else {
          status.time = "night";
        }
      }
      
      // Get online players
      if (this.bot.players) {
        status.players = Object.keys(this.bot.players)
          .filter(name => name !== this.bot!.username);
      }
      
      // Calculate 3x3 area
      if (this.homePosition) {
        const botX = Math.floor(this.bot.entity.position.x);
        const botZ = Math.floor(this.bot.entity.position.z);
        
        for (let z = -1; z <= 1; z++) {
          for (let x = -1; x <= 1; x++) {
            const index = (z + 1) * 3 + (x + 1);
            const areaX = this.homePosition.x + x;
            const areaZ = this.homePosition.z + z;
            
            // Mark the current position of the bot
            status.area[index] = botX === areaX && botZ === areaZ;
          }
        }
      }
    }
    
    return status;
  }

  private broadcastStatus() {
    const status = this.getBotStatus();
    
    // Convert Set to Array before iteration to avoid TypeScript errors
    Array.from(this.clients).forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: "status",
          data: status
        }));
      }
    });
  }

  private async addConsoleMessage(message: string, type: "info" | "warning" | "error") {
    const timestamp = new Date();
    const formattedTime = timestamp.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    
    const consoleMessage: ConsoleMessage = {
      timestamp: formattedTime,
      message,
      type
    };
    
    await storage.addConsoleMessage(consoleMessage);
    
    // Convert Set to Array before iteration to avoid TypeScript errors
    Array.from(this.clients).forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: "console",
          data: consoleMessage
        }));
      }
    });
  }

  async updateSettings(settings: BotSettings) {
    this.settings = settings;
    await storage.updateBotSettings(settings);
    this.addConsoleMessage("Bot settings updated", "info");
    
    if (this.running && this.homePosition) {
      // Update home position if the bot is already running
      this.homePosition = new Vec3(settings.posX, settings.posY, settings.posZ);
      this.addConsoleMessage(`Home position updated to X:${settings.posX} Y:${settings.posY} Z:${settings.posZ}`, "info");
    }
  }

  async clearConsole() {
    await storage.clearConsoleMessages();
    
    // Convert Set to Array before iteration
    Array.from(this.clients).forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: "consoleClear"
        }));
      }
    });
    
    this.addConsoleMessage("Console cleared", "info");
  }
  
  // Direct method to force wake up without conditions
  private forceWakeUpNow() {
    if (!this.bot || !this.running) return;
    
    // If the bot is sleeping, force it to wake up immediately
    if (this.bot.isSleeping) {
      // Check if there are any players online (excluding the bot)
      const players = this.bot.players || {};
      const otherPlayers = Object.keys(players).filter(name => name !== this.bot!.username);
      
      this.addConsoleMessage(`FORCE WAKE CHECK: Bot is sleeping. Players online: ${otherPlayers.length}`, "warning");
      
      // If no other players, wake up
      if (otherPlayers.length === 0) {
        this.addConsoleMessage("EMERGENCY WAKE UP NOW - No players online!", "warning");
        
        const attemptWake = (retryCount = 0) => {
          if (!this.bot || !this.bot.isSleeping) return;
          
          this.bot.wake()
            .then(() => {
              this.addConsoleMessage("Successfully woke up bot from emergency wake", "info");
              this.broadcastStatus();
            })
            .catch(err => {
              this.addConsoleMessage(`Failed to wake bot (attempt ${retryCount + 1}): ${err.message}`, "error");
              
              // Retry up to 5 times with increasing delays
              if (retryCount < 5) {
                const delay = 500 + (retryCount * 300);
                this.addConsoleMessage(`Retrying wake in ${delay}ms...`, "warning");
                
                setTimeout(() => attemptWake(retryCount + 1), delay);
              }
            });
        };
        
        // Start the wake-up attempt
        attemptWake();
      }
    }
  }
}

export const minecraftBot = new MinecraftBot();
