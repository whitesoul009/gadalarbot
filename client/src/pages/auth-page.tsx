import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const formSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export default function AuthPage() {
  const [_, setLocation] = useLocation();
  const { isAuthenticated, login, isPending } = useAuth();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: "",
    },
  });

  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, setLocation]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setError(null);
    try {
      const success = await login(values.password);
      if (!success) {
        setError("Incorrect password. Please try again.");
      }
    } catch (error) {
      toast({
        title: "Login Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-cover bg-center"
      style={{ 
        backgroundImage: "url('https://images.unsplash.com/photo-1607513746994-51f730a44832?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.0.3')" 
      }}
    >
      <div className="bg-white rounded-lg w-full max-w-md p-8 shadow-lg border-4 border-secondary mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-minecraft text-primary tracking-wider">
            Minecraft Bot Login
          </h2>
          <div className="w-10 h-10 flex-shrink-0">
            <div className="w-full h-full bg-secondary border-pixel"></div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Enter password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="pt-2">
              <Button
                type="submit"
                disabled={isPending}
                className="w-full bg-primary mc-button text-white font-minecraft py-2 px-4 rounded shadow-pixel hover:bg-green-800 transition-colors"
              >
                {isPending ? "Logging in..." : "Enter Server"}
              </Button>
            </div>

            {error && (
              <div className="text-error text-center text-sm">
                {error}
              </div>
            )}
          </form>
        </Form>
      </div>
    </div>
  );
}
