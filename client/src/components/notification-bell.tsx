import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, AlertTriangle, Info, Package, TrendingUp, Trash2, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Link } from "wouter";

interface Notification {
  type: string;
  severity: "info" | "warning" | "error";
  title: string;
  message: string;
  items?: Array<{ id: string; name: string; current: number | null; par: number | null }>;
  link: string;
}

function getIcon(type: string) {
  switch (type) {
    case "low_stock":
      return <Package className="h-4 w-4 text-amber-500" />;
    case "price_increase":
      return <TrendingUp className="h-4 w-4 text-blue-500" />;
    case "waste_spike":
      return <Trash2 className="h-4 w-4 text-red-500" />;
    case "cost_change":
      return <DollarSign className="h-4 w-4 text-purple-500" />;
    default:
      return <Info className="h-4 w-4 text-muted-foreground" />;
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 60000, // Refresh every minute
  });

  const warningCount = notifications.filter(n => n.severity === "warning").length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
          <Bell className="h-5 w-5" />
          {notifications.length > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]"
            >
              {notifications.length > 9 ? "9+" : notifications.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {notifications.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">All clear! No alerts.</p>
          )}
        </div>
        {notifications.length > 0 && (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((notification, index) => (
              <Link
                key={index}
                href={notification.link}
                onClick={() => setOpen(false)}
              >
                <div className="flex items-start gap-3 p-3 hover:bg-muted/50 cursor-pointer border-b last:border-0">
                  <div className="mt-0.5">{getIcon(notification.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{notification.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {notification.message}
                    </p>
                  </div>
                  {notification.severity === "warning" && (
                    <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-1" />
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
