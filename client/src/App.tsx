import type { ReactNode } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/layout/AppShell";
import { DisclaimerGate } from "@/components/layout/Disclaimer";
import Overview from "@/pages/Overview";
import Scanner from "@/pages/Scanner";
import Watchlists from "@/pages/Watchlists";
import Alerts from "@/pages/Alerts";
import TradePlanner from "@/pages/TradePlanner";
import Positions from "@/pages/Positions";
import Journal from "@/pages/Journal";
import Profile from "@/pages/Profile";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import NotFound from "@/pages/not-found";

// Signed-in pages render inside the sidebar shell; signed-out visitors see Login.
function AuthGate({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Checking login…</div>;
  }

  if (!user) return <Login />;

  return (
    <>
      {children}
      <DisclaimerGate accepted={!!user.disclaimerAcceptedAt} />
    </>
  );
}

function AppRoutes() {
  return (
    <AuthGate>
      <AppShell>
        <Switch>
          <Route path="/" component={Overview} />
          <Route path="/scanner" component={Scanner} />
          <Route path="/watchlists" component={Watchlists} />
          <Route path="/alerts" component={Alerts} />
          <Route path="/plan" component={TradePlanner} />
          <Route path="/positions" component={Positions} />
          <Route path="/journal" component={Journal} />
          <Route path="/profile" component={Profile} />
          <Route component={NotFound} />
        </Switch>
      </AppShell>
    </AuthGate>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route>
        <AppRoutes />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
