import { Link } from "wouter";
import { motion } from "framer-motion";
import { 
  Package, 
  ChefHat, 
  Calculator, 
  Sparkles, 
  ArrowRight, 
  ClipboardList, 
  TrendingUp,
  DollarSign,
  BarChart3,
  Trash2,
  ShoppingCart,
  Check,
  Coffee,
  Zap,
  Beaker
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

interface Feature {
  icon: typeof Package;
  title: string;
  description: string;
  badge?: string;
}

const coreFeatures: Feature[] = [
  {
    icon: Package,
    title: "Ingredient Database",
    description: "Track every ingredient with automatic unit conversions and cost calculations across all measurement types."
  },
  {
    icon: ChefHat,
    title: "Recipe Builder",
    description: "Create recipes with precise ingredient quantities. See real-time cost calculations as you build."
  },
  {
    icon: Calculator,
    title: "Pricing Playground",
    description: "Optimize menu prices with margin analysis, waste adjustments, and category-based pricing strategies."
  },
  {
    icon: Sparkles,
    title: "Mise AI Assistant",
    description: "Get AI-powered recipe suggestions, pricing recommendations, and business insights.",
    badge: "AI"
  }
];

const advancedFeatures: Feature[] = [
  {
    icon: ClipboardList,
    title: "Inventory Counts",
    description: "Quick counting interface organized by storage location."
  },
  {
    icon: ShoppingCart,
    title: "Order Generator",
    description: "Auto-generate orders based on par values and current stock."
  },
  {
    icon: Trash2,
    title: "Waste Tracking",
    description: "Log waste incidents and analyze trends to reduce losses."
  },
  {
    icon: Zap,
    title: "Add-Ins Pricing",
    description: "Configure add-in pricing with upgrade cost calculations."
  },
  {
    icon: Beaker,
    title: "Density Reference",
    description: "Accurate volume-to-weight conversions for any ingredient."
  },
  {
    icon: BarChart3,
    title: "Dashboard Charts",
    description: "Customizable charts to visualize your menu performance."
  }
];

interface Step {
  number: number;
  title: string;
  description: string;
  action: string;
  href: string;
  icon: typeof Package;
  tips: string[];
}

const gettingStartedSteps: Step[] = [
  {
    number: 1,
    title: "Add Your Ingredients",
    description: "Start by entering the ingredients you purchase. Include the purchase quantity, unit, and cost from your invoices.",
    action: "Add First Ingredient",
    href: "/ingredients",
    icon: Package,
    tips: [
      "Enter ingredients exactly as they appear on your invoices",
      "Set accurate densities for volume-to-weight conversions",
      "Use Excel import for bulk entry from spreadsheets"
    ]
  },
  {
    number: 2,
    title: "Build Your Recipes",
    description: "Create your menu items by selecting ingredients and specifying quantities. The system calculates costs automatically.",
    action: "Create First Recipe",
    href: "/recipes",
    icon: ChefHat,
    tips: [
      "Use sub-recipes for bases like syrups or sauces",
      "Add packaging costs to get true total costs",
      "Set yields for items with prep waste"
    ]
  },
  {
    number: 3,
    title: "Optimize Your Pricing",
    description: "Use the Pricing Playground to analyze margins, adjust for waste, and set competitive menu prices.",
    action: "Open Pricing",
    href: "/pricing",
    icon: Calculator,
    tips: [
      "Target 65-75% margins for beverages",
      "Factor in operational waste percentage",
      "Use category-based pricing for consistency"
    ]
  },
  {
    number: 4,
    title: "Explore Advanced Features",
    description: "Once your core data is set, unlock inventory management, order generation, waste tracking, and AI insights.",
    action: "Explore AI Features",
    href: "/ai-agent",
    icon: Sparkles,
    tips: [
      "Try Mise AI for recipe ideas and business advice",
      "Set par values to automate ordering",
      "Track waste to identify improvement areas"
    ]
  }
];

export function OnboardingWelcome() {
  return (
    <div className="min-h-[80vh]">
      <motion.div 
        className="space-y-12"
        initial="initial"
        animate="animate"
        variants={stagger}
      >
        <motion.div 
          className="text-center max-w-3xl mx-auto"
          variants={fadeInUp}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Coffee className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Welcome to MenuMetrics
          </h1>
          <p className="text-xl text-muted-foreground">
            Your complete solution for recipe costing, menu pricing, and inventory management.
            Let's get your cafe set up for success.
          </p>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="text-center pb-2">
              <div className="flex items-center justify-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <CardTitle className="text-xl">Get Started in 4 Easy Steps</CardTitle>
              </div>
              <CardDescription>
                Follow this path to unlock the full power of MenuMetrics
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {gettingStartedSteps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <motion.div
                      key={step.number}
                      variants={fadeInUp}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className={`h-full hover-elevate transition-all duration-200 ${
                        index === 0 ? "ring-2 ring-primary ring-offset-2" : ""
                      }`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                              index === 0 
                                ? "bg-primary text-primary-foreground" 
                                : "bg-muted text-muted-foreground"
                            }`}>
                              {step.number}
                            </div>
                            <Icon className={`h-5 w-5 ${index === 0 ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                          <CardTitle className="text-base">{step.title}</CardTitle>
                          <CardDescription className="text-sm">
                            {step.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              {step.tips.map((tip, tipIndex) => (
                                <div key={tipIndex} className="flex items-start gap-2 text-xs text-muted-foreground">
                                  <Check className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />
                                  <span>{tip}</span>
                                </div>
                              ))}
                            </div>
                            <Link href={step.href}>
                              <Button 
                                className="w-full" 
                                variant={index === 0 ? "default" : "outline"}
                                size="sm"
                                data-testid={`button-step-${step.number}`}
                              >
                                {step.action}
                                <ArrowRight className="h-4 w-4 ml-2" />
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <div className="text-center mb-6">
            <h2 className="text-2xl font-semibold mb-2">Core Features</h2>
            <p className="text-muted-foreground">
              Everything you need to manage costs and maximize profits
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {coreFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  variants={fadeInUp}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="h-full hover-elevate">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-primary/10">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">{feature.title}</CardTitle>
                          {feature.badge && (
                            <Badge variant="secondary" className="text-xs">
                              {feature.badge}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <div className="text-center mb-6">
            <h2 className="text-2xl font-semibold mb-2">Advanced Tools</h2>
            <p className="text-muted-foreground">
              Powerful features unlocked as you build your menu database
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {advancedFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  variants={fadeInUp}
                  transition={{ delay: index * 0.03 }}
                >
                  <Card className="h-full hover-elevate">
                    <CardContent className="pt-4 pb-4 text-center">
                      <div className="mx-auto p-2 rounded-md bg-muted w-fit mb-3">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <h3 className="font-medium text-sm mb-1">{feature.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-primary/20">
            <CardContent className="flex flex-col md:flex-row items-center justify-between gap-6 py-8">
              <div className="text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                  <DollarSign className="h-6 w-6 text-primary" />
                  <h3 className="text-xl font-semibold">Ready to take control of your costs?</h3>
                </div>
                <p className="text-muted-foreground">
                  Start by adding your first ingredient. Your journey to better margins begins now.
                </p>
              </div>
              <Link href="/ingredients">
                <Button size="lg" className="min-w-[200px]" data-testid="button-cta-add-ingredients">
                  <Package className="h-5 w-5 mr-2" />
                  Add First Ingredient
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div 
          variants={fadeInUp}
          className="text-center text-sm text-muted-foreground pb-8"
        >
          <p>
            Need help? Use the Mise AI assistant (available in the menu) for guidance anytime.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
