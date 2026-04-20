import { Link, useLocation } from "wouter";
import {
  BarChart3,
  Package,
  ChefHat,
  Calculator,
  ClipboardList,
  ShoppingCart,
  Trash2,
  Zap,
  Beaker,
  Sparkles,
  Settings,
  Shield,
  Coffee,
  TrendingDown,
  LogOut,
  Users,
  Target,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";

const coreNav = [
  { path: "/", label: "Dashboard", icon: BarChart3, testId: "link-dashboard", exact: true },
  { path: "/ingredients", label: "Ingredients", icon: Package, testId: "link-ingredients" },
  { path: "/recipes", label: "Recipes", icon: ChefHat, testId: "link-recipes" },
];

const opsNav: Array<{ path: string; label: string; icon: React.ComponentType<{ className?: string }>; testId: string; businessOnly?: boolean }> = [
  { path: "/inventory", label: "Inventory Count", icon: ClipboardList, testId: "link-inventory" },
  { path: "/orders", label: "Purchase Orders", icon: ShoppingCart, testId: "link-orders" },
  { path: "/waste-log", label: "Waste Log", icon: Trash2, testId: "link-waste" },
  { path: "/employees", label: "Employees", icon: Users, testId: "link-employees", businessOnly: true },
];

const toolsNav = [
  { path: "/pricing", label: "Pricing", icon: Calculator, testId: "link-pricing" },
  { path: "/add-ins", label: "Add-Ins", icon: Zap, testId: "link-add-ins" },
  { path: "/densities", label: "Densities", icon: Beaker, testId: "link-densities" },
  { path: "/break-even", label: "Break-Even", icon: Target, testId: "link-break-even" },
  { path: "/ai-agent", label: "Mise AI", icon: Sparkles, testId: "link-ai-agent" },
];

function NavItem({ item, isActive }: { item: { path: string; label: string; icon: React.ComponentType<{ className?: string }>; testId: string }; isActive: boolean }) {
  const { state } = useSidebar();
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
        <Link href={item.path} data-testid={item.testId}>
          <Icon className="h-4 w-4" />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar({ userRole }: { userRole?: string }) {
  const [location] = useLocation();
  const { user } = useAuth();

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location === path;
    return location === path || (path !== "/" && location.startsWith(path));
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const initials = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .map((n) => n![0])
    .join("")
    .toUpperCase() || "U";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="MenuMetrics">
              <Link href="/" data-testid="link-home-sidebar">
                <div className="flex aspect-square h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Coffee className="h-4 w-4" />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="font-bold text-base tracking-tight">MenuMetrics</span>
                  <span className="text-xs text-sidebar-foreground/60">Kitchen Intelligence</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Core</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {coreNav.map((item) => (
                <NavItem key={item.path} item={item} isActive={isActive(item.path, item.exact)} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {opsNav
                .filter((item) => !('businessOnly' in item && item.businessOnly) || (user as any)?.subscriptionTier === "business")
                .map((item) => (
                  <NavItem key={item.path} item={item} isActive={isActive(item.path)} />
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {toolsNav.map((item) => (
                <NavItem key={item.path} item={item} isActive={isActive(item.path)} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {userRole === "admin" && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Admin</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <NavItem
                    item={{ path: "/admin/managed-pricing", label: "Managed Pricing", icon: Shield, testId: "link-admin" }}
                    isActive={isActive("/admin/managed-pricing")}
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings">
              <Link href="/settings" data-testid="link-settings-sidebar">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip="Log Out" data-testid="button-logout-sidebar">
              <Avatar className="h-5 w-5">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col leading-none min-w-0">
                <span className="text-sm font-medium truncate">
                  {user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "Account"}
                </span>
                <span className="text-xs text-sidebar-foreground/60 truncate">{user?.email || "Log Out"}</span>
              </div>
              <LogOut className="ml-auto h-4 w-4 shrink-0 text-sidebar-foreground/60" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
