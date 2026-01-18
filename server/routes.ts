import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import ExcelJS from "exceljs";
import { storage } from "./storage";
import { insertIngredientSchema, insertRecipeSchema, insertRecipeIngredientSchema, insertRecipeSubIngredientSchema, insertAISettingsSchema, updateRecipePricingSchema, insertDensityHeuristicSchema, measurementUnits, insertCategoryPricingSettingsSchema, recipeCategories, insertWasteLogSchema, insertInventoryCountSchema, insertDashboardConfigSchema, dashboardChartTypes, dashboardChartLabels, type RecipeCategory, subscriptionTiers, type SubscriptionTier, insertManagedPricingSubscriptionSchema, updateManagedPricingSubscriptionSchema, managedPricingTiers, type ManagedPricingTier } from "@shared/schema";
import { parseQuantityUnit, normalizeUnit } from "@shared/unit-parser";
import { callAI, type AIProvider } from "./ai-providers";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { findBestMatch } from "@shared/fuzzy-matcher";
import type { Ingredient } from "@shared/schema";
import { registerBillingRoutes } from "./billingRoutes";
import { aiUsageMiddleware } from "./aiUsageMiddleware";
import { getUncachableStripeClient } from "./stripeClient";
import { pool } from "./db";

const upload = multer({ storage: multer.memoryStorage() });

/**
 * Helper to find ingredient with fuzzy matching
 * Returns exact matches immediately, otherwise tries fuzzy matching
 */
function findIngredientMatch(
  searchName: string,
  userIngredients: Ingredient[]
): { ingredient: Ingredient | null; confidence: number; wasExactMatch: boolean } {
  const result = findBestMatch(searchName, userIngredients, {
    autoMatchThreshold: 0.8,
    minThreshold: 0.6,
    useNormalization: true,
  });

  if (!result) {
    return { ingredient: null, confidence: 0, wasExactMatch: false };
  }

  return {
    ingredient: result.match,
    confidence: result.confidence,
    wasExactMatch: result.exactMatch,
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);
  
  registerBillingRoutes(app);

  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Excel template download
  app.get("/api/ingredients/template", isAuthenticated, async (req, res) => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Ingredients");
      
      // Set column widths
      worksheet.columns = [
        { width: 20 }, // Ingredient Name
        { width: 15 }, // Category
        { width: 18 }, // Purchase Quantity
        { width: 15 }, // Purchase Unit
        { width: 15 }, // Purchase Cost
        { width: 15 }, // Store
        { width: 22 }, // Price Per Unit
        { width: 22 }, // Density
        { width: 18 }, // Density Source
        { width: 18 }  // Packaging
      ];
      
      // Add instructions row
      worksheet.addRow([
        "INSTRUCTIONS:",
        "1. Fill in your ingredient data starting from row 4",
        "2. Required columns: Ingredient Name, Category, Purchase Quantity, Purchase Unit, Purchase Cost",
        "3. Units must be one of: " + measurementUnits.join(", "),
        "4. For unit-based items (unit='units'): Use 'Price Per Unit' column instead of Density",
        "5. For weight/volume items: Density is optional but helps with volume↔weight conversions (e.g., 1.03 for milk, 0.5 for flour)",
        "6. Mark 'Yes' for Packaging column if item is packaging (cups, lids, etc.)",
        "7. Delete this instructions row before uploading"
      ]);
      
      // Add empty row
      worksheet.addRow([]);
      
      // Add headers
      worksheet.addRow([
        "Ingredient Name",
        "Category",
        "Purchase Quantity",
        "Purchase Unit",
        "Purchase Cost",
        "Store (optional)",
        "Price Per Unit (optional, units only)",
        "Density g/mL (optional, weight/volume only)",
        "Density Source (optional)",
        "Packaging? (Yes/No)"
      ]);
      
      // Add sample row
      worksheet.addRow([
        "Espresso Beans",
        "Coffee",
        1,
        "pounds",
        9.90,
        "Numinous",
        "",
        "",
        "",
        "No"
      ]);
      
      const buffer = await workbook.xlsx.writeBuffer();
      
      res.setHeader("Content-Disposition", "attachment; filename=ingredient-template.xlsx");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error("Template generation error:", error);
      res.status(500).json({ error: "Failed to generate template" });
    }
  });

  app.get("/api/ingredients/export", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const ingredients = await storage.getAllIngredients(userId);
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Ingredients");
      
      // Set column widths
      worksheet.columns = [
        { width: 20 }, // Ingredient Name
        { width: 15 }, // Category
        { width: 18 }, // Purchase Quantity
        { width: 15 }, // Purchase Unit
        { width: 15 }, // Purchase Cost
        { width: 15 }, // Store
        { width: 22 }, // Price Per Unit
        { width: 22 }, // Density
        { width: 18 }, // Density Source
        { width: 18 }  // Packaging
      ];
      
      // Add headers
      worksheet.addRow([
        "Ingredient Name",
        "Category",
        "Purchase Quantity",
        "Purchase Unit",
        "Purchase Cost",
        "Store (optional)",
        "Price Per Unit (optional, units only)",
        "Density g/mL (optional, weight/volume only)",
        "Density Source (optional)",
        "Packaging? (Yes/No)"
      ]);
      
      // Add data rows
      for (const ing of ingredients) {
        worksheet.addRow([
          ing.name,
          ing.category,
          ing.purchaseQuantity,
          ing.purchaseUnit,
          ing.purchaseCost,
          ing.store || "",
          ing.purchaseUnit === "units" ? (ing.pricePerUnit || "") : "",
          ing.purchaseUnit !== "units" ? (ing.gramsPerMilliliter || "") : "",
          ing.densitySource || "",
          ing.isPackaging ? "Yes" : "No"
        ]);
      }
      
      const buffer = await workbook.xlsx.writeBuffer();
      
      const timestamp = new Date().toISOString().split('T')[0];
      res.setHeader("Content-Disposition", `attachment; filename=ingredients-export-${timestamp}.xlsx`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ error: "Failed to export ingredients" });
    }
  });

  app.get("/api/recipes/export", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recipes = await storage.getAllRecipes(userId);
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Recipes");
      
      // Set column widths
      worksheet.columns = [
        { width: 25 }, // Recipe Name
        { width: 15 }, // Category
        { width: 15 }, // Serving Size
        { width: 12 }, // Menu Price
        { width: 30 }, // Description
        { width: 25 }, // Ingredient Name
        { width: 10 }, // Quantity
        { width: 12 }  // Unit
      ];
      
      // Add headers
      worksheet.addRow([
        "Recipe Name",
        "Category",
        "Serving Size",
        "Menu Price",
        "Description",
        "Ingredient Name",
        "Quantity",
        "Unit"
      ]);
      
      // Add data rows
      for (const recipe of recipes) {
        const recipeIngredients = await storage.getRecipeIngredients(recipe.id, userId);
        
        if (recipeIngredients.length === 0) {
          worksheet.addRow([
            recipe.name,
            recipe.category,
            recipe.servings,
            recipe.menuPrice || "",
            recipe.description || "",
            "",
            "",
            ""
          ]);
        } else {
          for (const ri of recipeIngredients) {
            worksheet.addRow([
              recipe.name,
              recipe.category,
              recipe.servings,
              recipe.menuPrice || "",
              recipe.description || "",
              ri.ingredientDetails.name,
              ri.quantity,
              ri.unit
            ]);
          }
        }
      }
      
      const buffer = await workbook.xlsx.writeBuffer();
      
      const timestamp = new Date().toISOString().split('T')[0];
      res.setHeader("Content-Disposition", `attachment; filename=recipes-export-${timestamp}.xlsx`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error("Recipe export error:", error);
      res.status(500).json({ error: "Failed to export recipes" });
    }
  });

  app.get("/api/ingredients", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const ingredients = await storage.getAllIngredients(userId);
      res.json(ingredients);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ingredients" });
    }
  });

  app.get("/api/ingredients/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const ingredient = await storage.getIngredient(req.params.id, userId);
      if (!ingredient) {
        return res.status(404).json({ error: "Ingredient not found" });
      }
      res.json(ingredient);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ingredient" });
    }
  });

  app.post("/api/ingredients", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertIngredientSchema.parse(req.body);
      const ingredient = await storage.createIngredient(validatedData, userId);
      res.status(201).json(ingredient);
    } catch (error) {
      res.status(400).json({ error: "Invalid ingredient data" });
    }
  });

  app.patch("/api/ingredients/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertIngredientSchema.parse(req.body);
      const ingredient = await storage.updateIngredient(req.params.id, validatedData, userId);
      if (!ingredient) {
        return res.status(404).json({ error: "Ingredient not found" });
      }
      res.json(ingredient);
    } catch (error) {
      res.status(400).json({ error: "Invalid ingredient data" });
    }
  });

  app.delete("/api/ingredients/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const deleted = await storage.deleteIngredient(req.params.id, userId);
      if (!deleted) {
        return res.status(404).json({ error: "Ingredient not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete ingredient" });
    }
  });

  app.post("/api/ingredients/import", upload.single("file"), isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const mapping = req.body.mapping ? JSON.parse(req.body.mapping) : {};
      
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const worksheet = workbook.worksheets[0];
      
      // Convert worksheet to JSON array (similar to xlsx sheet_to_json)
      const data: any[] = [];
      const headers: string[] = [];
      let headerCount = 0;
      
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          // Read headers with includeEmpty to preserve column positions
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const value = String(cell.value || '').trim();
            if (value) {
              headers[colNumber - 1] = value;
              headerCount = Math.max(headerCount, colNumber);
            }
          });
        } else {
          const rowData: any = {};
          let hasData = false;
          // Read all cells up to header count to preserve column alignment
          for (let i = 1; i <= headerCount; i++) {
            const header = headers[i - 1];
            if (header) {
              const cell = row.getCell(i);
              const value = cell.value;
              if (value !== null && value !== undefined && value !== '') {
                rowData[header] = value;
                hasData = true;
              }
            }
          }
          if (hasData) {
            data.push(rowData);
          }
        }
      });

      const results: { success: any[]; errors: any[] } = { success: [], errors: [] };
      
      for (let i = 0; i < data.length; i++) {
        try {
          const rowData = data[i] as any;
          const rowNum = i + 2; // Account for header row
          
          // Extract values from mapped columns
          const name = rowData[mapping.name];
          const category = rowData[mapping.category];
          const store = mapping.store ? rowData[mapping.store] : undefined;
          
          // Validate required fields are present
          if (!name || !category) {
            throw new Error(`Missing required field: ${!name ? 'name' : 'category'}`);
          }
          
          // Parse quantity/unit - support mixed formats like "1lb", "64oz", "2 lbs."
          let purchaseQuantity: number;
          let purchaseUnit: string;
          
          const quantityValue = mapping.purchaseQuantity ? rowData[mapping.purchaseQuantity] : undefined;
          const unitValue = mapping.purchaseUnit ? rowData[mapping.purchaseUnit] : undefined;
          
          // First, try to parse quantity as combined format ("64oz", "1lb", "2 lbs.", "16 fl oz")
          if (quantityValue && typeof quantityValue === "string") {
            const parsed = parseQuantityUnit(quantityValue);
            if (parsed) {
              purchaseQuantity = parsed.quantity;
              purchaseUnit = parsed.unit;
            } else {
              // Not a combined format - parse as separate quantity and unit
              const numParsed = parseFloat(quantityValue);
              if (isNaN(numParsed) || numParsed <= 0) {
                throw new Error(`Invalid purchase quantity: "${quantityValue}"`);
              }
              purchaseQuantity = numParsed;
              
              // Normalize the unit value
              if (unitValue) {
                const normalized = normalizeUnit(String(unitValue));
                if (!normalized) {
                  throw new Error(`Invalid unit: "${unitValue}". Must be one of: ${measurementUnits.join(", ")}`);
                }
                purchaseUnit = normalized;
              } else {
                // No unit mapped and combined parsing failed - reject the row
                throw new Error(`Could not parse unit from "${quantityValue}". Either map a Purchase Unit column or use combined format like "64oz" or "16 fl oz"`);
              }
            }
          } else {
            const numParsed = parseFloat(quantityValue);
            if (isNaN(numParsed) || numParsed <= 0) {
              throw new Error(`Invalid purchase quantity: "${quantityValue}"`);
            }
            purchaseQuantity = numParsed;
            
            // Normalize the unit value
            if (unitValue) {
              const normalized = normalizeUnit(String(unitValue));
              if (!normalized) {
                throw new Error(`Invalid unit: "${unitValue}". Must be one of: ${measurementUnits.join(", ")}`);
              }
              purchaseUnit = normalized;
            } else {
              // No unit mapped and no string quantity - reject the row
              throw new Error("No unit specified. Map a Purchase Unit column or use combined format in Purchase Quantity");
            }
          }
          
          // Parse purchase cost
          const costValue = mapping.purchaseCost ? rowData[mapping.purchaseCost] : undefined;
          if (!costValue) {
            throw new Error("Missing required field: purchaseCost");
          }
          const purchaseCost = parseFloat(String(costValue).replace(/[$,]/g, ''));
          if (isNaN(purchaseCost) || purchaseCost < 0) {
            throw new Error(`Invalid purchase cost: "${costValue}"`);
          }
          
          // Parse price per unit if provided (independent of unit type)
          const pricePerUnitValue = mapping.pricePerUnit ? rowData[mapping.pricePerUnit] : undefined;
          const pricePerUnit = pricePerUnitValue ? parseFloat(pricePerUnitValue) : undefined;
          
          // Parse density if provided (independent of unit type)
          const densityValue = mapping.gramsPerMilliliter ? rowData[mapping.gramsPerMilliliter] : undefined;
          const gramsPerMilliliter = densityValue ? parseFloat(densityValue) : undefined;
          
          const densitySource = mapping.densitySource ? rowData[mapping.densitySource] : undefined;
          
          // Parse packaging flag
          const packagingValue = mapping.isPackaging ? rowData[mapping.isPackaging] : undefined;
          const isPackaging = packagingValue ? 
            (String(packagingValue).toLowerCase() === "yes" || String(packagingValue).toLowerCase() === "true") : 
            false;
          
          // Validate and create ingredient
          const ingredient = insertIngredientSchema.parse({
            name,
            category,
            purchaseQuantity,
            purchaseUnit,
            purchaseCost,
            store,
            pricePerUnit,
            gramsPerMilliliter,
            densitySource,
            isPackaging,
          });
          
          const created = await storage.createIngredient(ingredient, userId);
          results.success.push({ row: rowNum, name: created.name });
        } catch (error) {
          const rowData = data[i] as any;
          const errorMsg = error instanceof Error ? error.message : "Unknown error";
          results.errors.push({ 
            row: i + 2, 
            data: rowData,
            error: errorMsg 
          });
          console.error(`Failed to import row ${i + 2}:`, rowData, error);
        }
      }

      res.json({ 
        count: results.success.length,
        imported: results.success.length,
        skipped: results.errors.length,
        errors: results.errors.slice(0, 10), // Limit error details
        message: `Imported ${results.success.length} ingredients successfully${results.errors.length > 0 ? `, skipped ${results.errors.length} rows with errors` : ''}`
      });
    } catch (error) {
      console.error("Import error:", error);
      res.status(500).json({ error: "Failed to import file" });
    }
  });

  app.get("/api/recipes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recipes = await storage.getAllRecipes(userId);
      res.json(recipes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recipes" });
    }
  });

  app.get("/api/recipes/with-ingredients", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recipes = await storage.getAllRecipesWithIngredients(userId);
      res.json(recipes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recipes with ingredients" });
    }
  });

  app.get("/api/recipes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recipe = await storage.getRecipeWithIngredients(req.params.id, userId);
      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      res.json(recipe);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recipe" });
    }
  });

  app.post("/api/recipes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertRecipeSchema.parse(req.body);
      const recipe = await storage.createRecipe(validatedData, userId);
      res.status(201).json(recipe);
    } catch (error) {
      res.status(400).json({ error: "Invalid recipe data" });
    }
  });

  app.patch("/api/recipes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertRecipeSchema.parse(req.body);
      const recipe = await storage.updateRecipe(req.params.id, validatedData, userId);
      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      res.json(recipe);
    } catch (error) {
      res.status(400).json({ error: "Invalid recipe data" });
    }
  });

  app.patch("/api/recipes/:id/pricing", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = updateRecipePricingSchema.parse(req.body);
      const recipe = await storage.updateRecipePricing(req.params.id, validatedData, userId);
      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      res.json(recipe);
    } catch (error) {
      res.status(400).json({ error: "Invalid pricing data" });
    }
  });

  app.patch("/api/recipes/:id/category", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { category } = req.body;
      if (!category || typeof category !== "string") {
        return res.status(400).json({ error: "Category is required" });
      }
      const recipe = await storage.updateRecipeCategory(req.params.id, category, userId);
      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      res.json(recipe);
    } catch (error) {
      res.status(400).json({ error: "Invalid category data" });
    }
  });

  app.patch("/api/recipes/:id/name", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name } = req.body;
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "Recipe name is required" });
      }
      const recipe = await storage.updateRecipeName(req.params.id, name.trim(), userId);
      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      res.json(recipe);
    } catch (error) {
      res.status(400).json({ error: "Invalid recipe name data" });
    }
  });

  app.patch("/api/recipes/:id/packaging-preset", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { isPackagingPreset } = req.body;
      if (typeof isPackagingPreset !== "boolean") {
        return res.status(400).json({ error: "isPackagingPreset must be a boolean" });
      }
      const recipe = await storage.updateRecipePackagingPreset(req.params.id, isPackagingPreset, userId);
      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      res.json(recipe);
    } catch (error) {
      res.status(400).json({ error: "Failed to update packaging preset status" });
    }
  });

  app.patch("/api/recipes/:id/base-recipe", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { isBaseRecipe } = req.body;
      if (typeof isBaseRecipe !== "boolean") {
        return res.status(400).json({ error: "isBaseRecipe must be a boolean" });
      }
      const recipe = await storage.updateRecipeBaseRecipe(req.params.id, isBaseRecipe, userId);
      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      res.json(recipe);
    } catch (error) {
      res.status(400).json({ error: "Failed to update base recipe status" });
    }
  });

  app.patch("/api/recipes/:id/servings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { servings } = req.body;
      if (typeof servings !== "number" || servings <= 0) {
        return res.status(400).json({ error: "Servings must be a positive number" });
      }
      const recipe = await storage.getRecipeWithIngredients(req.params.id, userId);
      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      const updatedRecipe = await storage.updateRecipe(req.params.id, {
        ...recipe,
        servings,
      }, userId);
      if (!updatedRecipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      const recipeWithIngredients = await storage.getRecipeWithIngredients(req.params.id, userId);
      res.json(recipeWithIngredients);
    } catch (error) {
      res.status(400).json({ error: "Invalid servings data" });
    }
  });

  // Category pricing settings routes
  app.get("/api/pricing-settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const settings = await storage.getCategoryPricingSettings(userId);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pricing settings" });
    }
  });

  app.put("/api/pricing-settings/:category", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { category } = req.params;
      
      if (!recipeCategories.includes(category as RecipeCategory)) {
        return res.status(400).json({ error: "Invalid category" });
      }
      
      const validatedData = insertCategoryPricingSettingsSchema.parse({
        category,
        wastePercentage: req.body.wastePercentage,
        targetMargin: req.body.targetMargin,
      });
      
      const setting = await storage.upsertCategoryPricingSetting(validatedData, userId);
      res.json(setting);
    } catch (error) {
      res.status(400).json({ error: "Invalid pricing settings data" });
    }
  });

  app.post("/api/pricing-settings/apply", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { category, wastePercentage, targetMargin } = req.body;
      
      // Validate inputs
      if (typeof wastePercentage !== "number" || wastePercentage < 0 || wastePercentage > 99) {
        return res.status(400).json({ error: "Invalid waste percentage" });
      }
      if (typeof targetMargin !== "number" || targetMargin < 1 || targetMargin > 99) {
        return res.status(400).json({ error: "Invalid target margin" });
      }
      
      // Get all recipes
      const recipes = await storage.getAllRecipes(userId);
      
      // Filter by category if specified (not "global")
      const recipesToUpdate = category === "global" 
        ? recipes 
        : recipes.filter(r => r.category === category);
      
      // Update each recipe's pricing
      const updates = recipesToUpdate.map(recipe => 
        storage.updateRecipePricing(recipe.id, {
          wastePercentage,
          targetMargin,
          consumablesBuffer: recipe.consumablesBuffer ?? 0,
        }, userId)
      );
      
      await Promise.all(updates);
      
      // Save the category setting for persistence
      if (category !== "global" && recipeCategories.includes(category as RecipeCategory)) {
        await storage.upsertCategoryPricingSetting({
          category,
          wastePercentage,
          targetMargin,
        }, userId);
      }
      
      res.json({ 
        success: true, 
        updatedCount: recipesToUpdate.length,
        category: category === "global" ? "all recipes" : category
      });
    } catch (error) {
      console.error("Apply pricing settings error:", error);
      res.status(500).json({ error: "Failed to apply pricing settings" });
    }
  });

  // Bulk apply suggested menu prices
  app.post("/api/recipes/bulk-apply-prices", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { priceUpdates } = req.body;
      
      if (!Array.isArray(priceUpdates)) {
        return res.status(400).json({ error: "priceUpdates must be an array" });
      }
      
      // Store previous prices for undo functionality
      const recipes = await storage.getAllRecipes(userId);
      const previousPrices: { recipeId: string; previousPrice: number | null; newPrice: number }[] = [];
      
      for (const update of priceUpdates) {
        const recipe = recipes.find(r => r.id === update.recipeId);
        if (recipe) {
          previousPrices.push({
            recipeId: update.recipeId,
            previousPrice: recipe.menuPrice ?? null,
            newPrice: update.menuPrice,
          });
        }
      }
      
      // Apply the updates
      const updates = priceUpdates.map(update => 
        storage.updateRecipePricing(update.recipeId, {
          menuPrice: update.menuPrice,
        }, userId)
      );
      
      await Promise.all(updates);
      
      res.json({ 
        success: true, 
        updatedCount: priceUpdates.length,
        previousPrices
      });
    } catch (error) {
      console.error("Bulk apply prices error:", error);
      res.status(500).json({ error: "Failed to bulk apply prices" });
    }
  });

  // Undo bulk price changes
  app.post("/api/recipes/undo-bulk-prices", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { previousPrices } = req.body;
      
      if (!Array.isArray(previousPrices)) {
        return res.status(400).json({ error: "previousPrices must be an array" });
      }
      
      // Restore previous prices
      const updates = previousPrices.map(item => 
        storage.updateRecipePricing(item.recipeId, {
          menuPrice: item.previousPrice ?? undefined,
        }, userId)
      );
      
      await Promise.all(updates);
      
      res.json({ 
        success: true, 
        restoredCount: previousPrices.length
      });
    } catch (error) {
      console.error("Undo bulk prices error:", error);
      res.status(500).json({ error: "Failed to undo bulk prices" });
    }
  });

  // Pricing Snapshots - save and restore pricing configurations
  app.get("/api/pricing-snapshots", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const snapshots = await storage.getPricingSnapshots(userId);
      res.json(snapshots);
    } catch (error) {
      console.error("Get pricing snapshots error:", error);
      res.status(500).json({ error: "Failed to fetch pricing snapshots" });
    }
  });

  app.post("/api/pricing-snapshots", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name } = req.body;
      
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "Snapshot name is required" });
      }

      // Capture current pricing state
      const recipes = await storage.getAllRecipes(userId);
      const categorySettings = await storage.getCategoryPricingSettings(userId);

      const recipePricing = recipes.map(recipe => ({
        recipeId: recipe.id,
        menuPrice: recipe.menuPrice ?? null,
        wastePercentage: recipe.wastePercentage ?? 0,
        targetMargin: recipe.targetMargin ?? 80,
        consumablesBuffer: recipe.consumablesBuffer ?? 0,
      }));

      const categoryData = categorySettings.map(setting => ({
        category: setting.category,
        wastePercentage: setting.wastePercentage,
        targetMargin: setting.targetMargin,
      }));

      const snapshot = await storage.createPricingSnapshot({
        name: name.trim(),
        recipePricing,
        categorySettings: categoryData,
      }, userId);

      res.status(201).json(snapshot);
    } catch (error) {
      console.error("Create pricing snapshot error:", error);
      res.status(500).json({ error: "Failed to create pricing snapshot" });
    }
  });

  app.post("/api/pricing-snapshots/:id/apply", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = await storage.applyPricingSnapshot(req.params.id, userId);
      
      res.json({ 
        success: true, 
        message: `Restored pricing for ${result.updatedRecipes} recipes and ${result.updatedCategories} category settings`,
        ...result
      });
    } catch (error) {
      console.error("Apply pricing snapshot error:", error);
      res.status(500).json({ error: "Failed to apply pricing snapshot" });
    }
  });

  app.delete("/api/pricing-snapshots/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const deleted = await storage.deletePricingSnapshot(req.params.id, userId);
      if (!deleted) {
        return res.status(404).json({ error: "Pricing snapshot not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Delete pricing snapshot error:", error);
      res.status(500).json({ error: "Failed to delete pricing snapshot" });
    }
  });

  app.post("/api/recipes/:id/duplicate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name } = req.body;
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "New recipe name is required" });
      }
      const recipe = await storage.duplicateRecipe(req.params.id, name.trim(), userId);
      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      res.status(201).json(recipe);
    } catch (error) {
      console.error("Duplicate recipe error:", error);
      res.status(500).json({ error: "Failed to duplicate recipe" });
    }
  });

  app.delete("/api/recipes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const deleted = await storage.deleteRecipe(req.params.id, userId);
      if (!deleted) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete recipe" });
    }
  });

  app.post("/api/recipes/import", upload.single("file"), isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const worksheet = workbook.worksheets[0];
      
      // Convert worksheet to JSON array
      const data: any[] = [];
      const headers: string[] = [];
      let headerCount = 0;
      
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          // Read headers with includeEmpty to preserve column positions
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const value = String(cell.value || '').trim();
            if (value) {
              headers[colNumber - 1] = value;
              headerCount = Math.max(headerCount, colNumber);
            }
          });
        } else {
          const rowData: any = {};
          let hasData = false;
          // Read all cells up to header count to preserve column alignment
          for (let i = 1; i <= headerCount; i++) {
            const header = headers[i - 1];
            if (header) {
              const cell = row.getCell(i);
              const value = cell.value;
              if (value !== null && value !== undefined && value !== '') {
                rowData[header] = value;
                hasData = true;
              }
            }
          }
          if (hasData) {
            data.push(rowData);
          }
        }
      });

      // Group rows by recipe name
      const recipeGroups = new Map<string, any[]>();
      for (const row of data as any[]) {
        const recipeName = row["Recipe Name"] || row["recipe_name"] || row["name"];
        if (!recipeName) continue;
        
        if (!recipeGroups.has(recipeName)) {
          recipeGroups.set(recipeName, []);
        }
        recipeGroups.get(recipeName)!.push(row);
      }

      // Get all user's ingredients for matching
      const userIngredients = await storage.getAllIngredients(userId);

      const results: { 
        success: Array<{ name: string; ingredientsCount: number }>; 
        errors: Array<{ recipe: string; error: string }> 
      } = { success: [], errors: [] };

      // Process each recipe
      for (const [recipeName, rows] of Array.from(recipeGroups.entries())) {
        try {
          const firstRow = rows[0];
          
          // Extract recipe metadata from first row
          const category = firstRow["Category"] || firstRow["category"] || "";
          // Prioritize "Yield" (user's format) before falling back to "Serving Size"
          const servingSizeStr = String(firstRow["Yield"] || firstRow["Serving Size"] || firstRow["serving_size"] || "1");
          const servings = parseFloat(servingSizeStr.replace(/[^\d.]/g, '')) || 1;
          
          const menuPriceStr = firstRow["Menu Price"] || firstRow["menu_price"] || firstRow["price"] || firstRow["Selling Price"] || firstRow["selling_price"];
          const menuPrice = menuPriceStr ? parseFloat(String(menuPriceStr).replace(/[$,]/g, '')) : undefined;
          
          const description = firstRow["Description"] || firstRow["description"] || "";

          // Create recipe
          const recipe = await storage.createRecipe({
            name: recipeName,
            description: description || "",
            category: category || "other",
            servings,
            menuPrice: menuPrice || undefined,
          }, userId);

          // Add ingredients to recipe with fuzzy matching
          let ingredientCount = 0;
          const missingIngredients: string[] = [];
          
          for (const row of rows) {
            // Prioritize "Inventory Item Match" (user's format) before falling back to other column names
            const ingredientName = row["Inventory Item Match"] || row["Ingredient Name"] || row["ingredient_name"] || row["ingredient"];
            if (!ingredientName) continue;

            const match = findIngredientMatch(ingredientName, userIngredients);
            if (!match.ingredient) {
              missingIngredients.push(ingredientName);
              console.warn(`Ingredient "${ingredientName}" not found for recipe "${recipeName}"`);
              continue;
            }
            
            // Log fuzzy matches for transparency
            if (!match.wasExactMatch) {
              console.log(`Fuzzy matched "${ingredientName}" → "${match.ingredient.name}" (confidence: ${(match.confidence * 100).toFixed(0)}%)`);
            }
            
            const ingredient = match.ingredient;

            const quantityStr = row["Quantity"] || row["quantity"];
            const quantity = parseFloat(quantityStr) || 1;
            
            const unit = (row["Unit"] || row["unit"] || "units").toLowerCase().trim();
            const normalizedUnit = normalizeUnit(unit) || unit;

            await storage.createRecipeIngredient({
              recipeId: recipe.id,
              ingredientId: ingredient.id,
              quantity,
              unit: normalizedUnit,
            }, userId);

            ingredientCount++;
          }

          // Recalculate recipe cost
          await storage.recalculateRecipeCost(recipe.id, userId);

          results.success.push({ 
            name: recipeName, 
            ingredientsCount: ingredientCount 
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Unknown error";
          results.errors.push({ 
            recipe: recipeName, 
            error: errorMsg 
          });
          console.error(`Failed to import recipe "${recipeName}":`, error);
        }
      }

      res.json({
        imported: results.success.length,
        skipped: results.errors.length,
        recipes: results.success,
        errors: results.errors,
        message: `Imported ${results.success.length} recipes successfully${results.errors.length > 0 ? `, skipped ${results.errors.length} with errors` : ''}`
      });
    } catch (error) {
      console.error("Recipe import error:", error);
      res.status(500).json({ error: "Failed to import recipes" });
    }
  });

  app.post("/api/recipes/import-json", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { recipes } = req.body;
      
      if (!Array.isArray(recipes)) {
        return res.status(400).json({ error: "Request body must contain 'recipes' array" });
      }

      // Get all user's ingredients for matching
      const userIngredients = await storage.getAllIngredients(userId);

      const results: { 
        success: Array<{ name: string; ingredientsCount: number }>; 
        errors: Array<{ recipe: string; error: string }> 
      } = { success: [], errors: [] };

      // Process each recipe
      for (const recipeData of recipes) {
        try {
          const { name, category, servings, menuPrice, description, ingredients } = recipeData;
          
          if (!name || typeof name !== "string") {
            throw new Error("Recipe must have a 'name' field");
          }
          
          if (!Array.isArray(ingredients) || ingredients.length === 0) {
            throw new Error("Recipe must have 'ingredients' array with at least one ingredient");
          }

          // Create recipe
          const recipe = await storage.createRecipe({
            name: name.trim(),
            description: description || "",
            category: category || "other",
            servings: typeof servings === "number" ? servings : 1,
            menuPrice: typeof menuPrice === "number" ? menuPrice : undefined,
          }, userId);

          // Add ingredients to recipe with fuzzy matching
          let ingredientCount = 0;
          const missingIngredients: string[] = [];
          
          for (const ingData of ingredients) {
            const ingredientName = ingData.name;
            if (!ingredientName) continue;

            const match = findIngredientMatch(ingredientName, userIngredients);
            if (!match.ingredient) {
              missingIngredients.push(ingredientName);
              continue;
            }
            
            // Log fuzzy matches for transparency
            if (!match.wasExactMatch) {
              console.log(`Fuzzy matched "${ingredientName}" → "${match.ingredient.name}" (confidence: ${(match.confidence * 100).toFixed(0)}%)`);
            }
            
            const ingredient = match.ingredient;

            const quantity = typeof ingData.quantity === "number" ? ingData.quantity : parseFloat(ingData.quantity) || 1;
            const unit = (ingData.unit || "units").toLowerCase().trim();
            const normalizedUnit = normalizeUnit(unit) || unit;

            await storage.createRecipeIngredient({
              recipeId: recipe.id,
              ingredientId: ingredient.id,
              quantity,
              unit: normalizedUnit,
            }, userId);

            ingredientCount++;
          }

          if (missingIngredients.length > 0) {
            throw new Error(`Missing ingredients in inventory: ${missingIngredients.join(", ")}`);
          }

          if (ingredientCount === 0) {
            throw new Error("No valid ingredients found in inventory");
          }

          // Recalculate recipe cost
          await storage.recalculateRecipeCost(recipe.id, userId);

          results.success.push({ 
            name, 
            ingredientsCount: ingredientCount 
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Unknown error";
          results.errors.push({ 
            recipe: recipeData.name || "Unknown recipe", 
            error: errorMsg 
          });
          console.error(`Failed to import recipe from JSON:`, error);
        }
      }

      res.json({
        imported: results.success.length,
        skipped: results.errors.length,
        recipes: results.success,
        errors: results.errors,
        message: `Imported ${results.success.length} recipes successfully${results.errors.length > 0 ? `, skipped ${results.errors.length} with errors` : ''}`
      });
    } catch (error) {
      console.error("JSON recipe import error:", error);
      res.status(500).json({ error: "Failed to import recipes from JSON" });
    }
  });

  app.post("/api/recipes/import-text", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { text, provider } = req.body;
      
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Request body must contain 'text' field" });
      }

      // Get user's AI settings
      const aiSettings = await storage.getAISettings(userId);
      const aiProvider = provider || aiSettings?.aiProvider || "openai";

      // Get all user's ingredients for context
      const userIngredients = await storage.getAllIngredients(userId);
      const ingredientNames = userIngredients.map(ing => ing.name).join(", ");

      // Prepare AI prompt
      const systemPrompt = `You are a recipe parser. Convert the user's text into a structured JSON array of recipes.

Available ingredients in inventory: ${ingredientNames || "None"}

Return a JSON array where each recipe has this structure:
{
  "name": "Recipe Name",
  "category": "beverage|food|dessert|other",
  "servings": 1,
  "menuPrice": 5.50,
  "description": "Optional description",
  "ingredients": [
    {
      "name": "Ingredient Name",
      "quantity": 2,
      "unit": "oz"
    }
  ]
}

Rules:
1. Only use ingredients that exist in the inventory
2. Use standard units: oz, lb, g, kg, ml, L, cup, tbsp, tsp, each, units
3. Parse quantities and units carefully
4. If ingredient not in inventory, skip it and note in description
5. Return ONLY the JSON array, no other text`;

      let parsedRecipes: any[];

      // Get HuggingFace API key if using that provider
      let customApiKey: string | undefined;
      if (aiProvider === "huggingface") {
        const aiSettings = await storage.getAISettings(userId);
        if (!aiSettings?.huggingfaceToken) {
          return res.status(400).json({ 
            error: "HuggingFace requires an API key. Please configure it in Settings." 
          });
        }
        customApiKey = aiSettings.huggingfaceToken;
      }

      // Call AI using shared helper that supports all providers
      const content = await callAI({
        provider: aiProvider,
        systemPrompt,
        prompt: text,
        customApiKey,
      });

      if (!content) {
        throw new Error(`${aiProvider} returned empty response`);
      }

      // Parse JSON response
      const parsed = JSON.parse(content);
      parsedRecipes = Array.isArray(parsed) ? parsed : parsed.recipes || [];

      // Now import the parsed recipes using fuzzy matching
      const results: { 
        success: Array<{ name: string; ingredientsCount: number }>; 
        errors: Array<{ recipe: string; error: string }> 
      } = { success: [], errors: [] };

      for (const recipeData of parsedRecipes) {
        try {
          const { name, category, servings, menuPrice, description, ingredients } = recipeData;
          
          if (!name || typeof name !== "string") {
            throw new Error("Recipe must have a 'name' field");
          }
          
          if (!Array.isArray(ingredients) || ingredients.length === 0) {
            throw new Error("Recipe must have 'ingredients' array with at least one ingredient");
          }

          // Create recipe
          const recipe = await storage.createRecipe({
            name: name.trim(),
            description: description || "",
            category: category || "other",
            servings: typeof servings === "number" ? servings : 1,
            menuPrice: typeof menuPrice === "number" ? menuPrice : undefined,
          }, userId);

          // Add ingredients to recipe with fuzzy matching
          let ingredientCount = 0;
          const missingIngredients: string[] = [];
          
          for (const ingData of ingredients) {
            const ingredientName = ingData.name;
            if (!ingredientName) continue;

            const match = findIngredientMatch(ingredientName, userIngredients);
            if (!match.ingredient) {
              missingIngredients.push(ingredientName);
              continue;
            }
            
            // Log fuzzy matches for transparency
            if (!match.wasExactMatch) {
              console.log(`Fuzzy matched "${ingredientName}" → "${match.ingredient.name}" (confidence: ${(match.confidence * 100).toFixed(0)}%)`);
            }
            
            const ingredient = match.ingredient;

            const quantity = typeof ingData.quantity === "number" ? ingData.quantity : parseFloat(ingData.quantity) || 1;
            const unit = (ingData.unit || "units").toLowerCase().trim();
            const normalizedUnit = normalizeUnit(unit) || unit;

            await storage.createRecipeIngredient({
              recipeId: recipe.id,
              ingredientId: ingredient.id,
              quantity,
              unit: normalizedUnit,
            }, userId);

            ingredientCount++;
          }

          if (missingIngredients.length > 0) {
            console.warn(`Recipe "${name}" missing ingredients: ${missingIngredients.join(", ")}`);
          }

          if (ingredientCount === 0) {
            throw new Error("No valid ingredients found in inventory");
          }

          // Recalculate recipe cost
          await storage.recalculateRecipeCost(recipe.id, userId);

          results.success.push({ 
            name, 
            ingredientsCount: ingredientCount 
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Unknown error";
          results.errors.push({ 
            recipe: recipeData.name || "Unknown recipe", 
            error: errorMsg 
          });
          console.error(`Failed to import recipe from AI-parsed text:`, error);
        }
      }

      res.json({
        imported: results.success.length,
        skipped: results.errors.length,
        recipes: results.success,
        errors: results.errors,
        message: `Imported ${results.success.length} recipes successfully${results.errors.length > 0 ? `, skipped ${results.errors.length} with errors` : ''}`
      });
    } catch (error) {
      console.error("AI text import error:", error);
      res.status(500).json({ error: "Failed to import recipes from text" });
    }
  });

  app.post("/api/recipes/:id/ingredients", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recipeId = req.params.id;
      
      // Add recipeId to the request body for validation
      const validatedData = insertRecipeIngredientSchema.parse({
        ...req.body,
        recipeId,
      });
      const recipeIngredient = await storage.createRecipeIngredient(validatedData, userId);
      
      // Recalculate recipe cost after adding ingredient
      await storage.recalculateRecipeCost(recipeId, userId);
      
      // Return the updated recipe with ingredients so frontend cache is updated
      const updatedRecipe = await storage.getRecipeWithIngredients(recipeId, userId);
      res.status(201).json(updatedRecipe);
    } catch (error) {
      res.status(400).json({ error: "Invalid recipe ingredient data" });
    }
  });

  app.patch("/api/recipes/:recipeId/ingredients/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { quantity, unit } = req.body;
      
      const updates: { quantity?: number; unit?: string } = {};
      
      if (quantity !== undefined) {
        if (typeof quantity !== "number" || quantity <= 0) {
          return res.status(400).json({ error: "Invalid quantity" });
        }
        updates.quantity = quantity;
      }
      
      if (unit !== undefined) {
        if (typeof unit !== "string" || !unit.trim()) {
          return res.status(400).json({ error: "Invalid unit" });
        }
        updates.unit = unit.trim().toLowerCase();
      }
      
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No updates provided" });
      }
      
      const recipeIngredient = await storage.updateRecipeIngredient(req.params.id, updates, userId);
      if (!recipeIngredient) {
        return res.status(404).json({ error: "Recipe ingredient not found" });
      }
      
      // Recalculate recipe cost after updating ingredient
      const recipeId = req.params.recipeId;
      await storage.recalculateRecipeCost(recipeId, userId);
      
      // Return the updated recipe with ingredients so frontend cache is updated
      const updatedRecipe = await storage.getRecipeWithIngredients(recipeId, userId);
      res.json(updatedRecipe);
    } catch (error) {
      res.status(500).json({ error: "Failed to update recipe ingredient" });
    }
  });

  app.delete("/api/recipes/:recipeId/ingredients/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const deleted = await storage.deleteRecipeIngredient(req.params.id, userId);
      if (!deleted) {
        return res.status(404).json({ error: "Recipe ingredient not found" });
      }
      
      // Recalculate recipe cost after deleting ingredient
      const recipeId = req.params.recipeId;
      await storage.recalculateRecipeCost(recipeId, userId);
      
      // Return the updated recipe with ingredients so frontend cache is updated
      const updatedRecipe = await storage.getRecipeWithIngredients(recipeId, userId);
      res.json(updatedRecipe);
    } catch (error) {
      res.status(500).json({ error: "Failed to delete recipe ingredient" });
    }
  });

  app.post("/api/recipes/:id/sub-recipes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recipeId = req.params.id;
      
      const parseResult = insertRecipeSubIngredientSchema.safeParse({
        ...req.body,
        recipeId,
      });
      
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.message });
      }
      
      const hasCircularDep = await storage.checkCircularDependency(
        recipeId,
        parseResult.data.subRecipeId,
        userId
      );
      
      if (hasCircularDep) {
        return res.status(400).json({ error: "Cannot add this recipe as it would create a circular dependency" });
      }
      
      await storage.createRecipeSubIngredient(parseResult.data, userId);
      await storage.recalculateRecipeCost(recipeId, userId);
      
      const updatedRecipe = await storage.getRecipeWithIngredients(recipeId, userId);
      res.json(updatedRecipe);
    } catch (error) {
      console.error("Error adding sub-recipe:", error);
      res.status(500).json({ error: "Failed to add sub-recipe to recipe" });
    }
  });

  app.patch("/api/recipes/:recipeId/sub-recipes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { quantity } = req.body;
      
      if (typeof quantity !== "number" || quantity <= 0) {
        return res.status(400).json({ error: "Invalid quantity" });
      }
      
      const updated = await storage.updateRecipeSubIngredientQuantity(req.params.id, quantity, userId);
      if (!updated) {
        return res.status(404).json({ error: "Recipe sub-ingredient not found" });
      }
      
      const recipeId = req.params.recipeId;
      await storage.recalculateRecipeCost(recipeId, userId);
      
      const updatedRecipe = await storage.getRecipeWithIngredients(recipeId, userId);
      res.json(updatedRecipe);
    } catch (error) {
      res.status(500).json({ error: "Failed to update sub-recipe quantity" });
    }
  });

  app.delete("/api/recipes/:recipeId/sub-recipes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const deleted = await storage.deleteRecipeSubIngredient(req.params.id, userId);
      if (!deleted) {
        return res.status(404).json({ error: "Recipe sub-ingredient not found" });
      }
      
      const recipeId = req.params.recipeId;
      await storage.recalculateRecipeCost(recipeId, userId);
      
      const updatedRecipe = await storage.getRecipeWithIngredients(recipeId, userId);
      res.json(updatedRecipe);
    } catch (error) {
      res.status(500).json({ error: "Failed to delete sub-recipe from recipe" });
    }
  });

  // AI Agent endpoints (protected by AI usage middleware)
  app.post("/api/ai/recipe-ideas", isAuthenticated, aiUsageMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { customPrompt, includeIngredientMatching } = req.body;
      
      // Get AI provider settings from database
      const settings = await storage.getAISettings(userId);
      const provider = (settings?.aiProvider || "openai") as AIProvider;
      const customApiKey = settings?.huggingfaceToken || undefined;

      // Get all ingredients for context
      const ingredients = await storage.getAllIngredients(userId);
      const ingredientNames = ingredients.map(i => i.name.toLowerCase());
      
      const ingredientList = ingredients
        .map(i => `${i.name} (${i.category}) - $${i.purchaseCost.toFixed(2)} for ${i.purchaseQuantity} ${i.purchaseUnit}`)
        .join("\n");

      const systemPrompt = `You are a professional coffee shop recipe consultant specializing in cost-effective menu development. You MUST respond with valid JSON only, no additional text.`;
      
      const userRequest = customPrompt 
        ? `User request: ${customPrompt}\n\n`
        : '';
      
      const prompt = `${userRequest}Based on these available ingredients, suggest 5 creative and cost-efficient coffee shop recipes${customPrompt ? ` that match the user's request` : ''}.

Available ingredients:
${ingredientList}

Respond with a JSON array where each recipe object has:
{
  "name": "Recipe Name",
  "description": "Brief description",
  "category": "one of: espresso_drinks, cold_brew, tea_drinks, blended_drinks, baked_goods, breakfast, lunch, snacks, other",
  "servings": 1,
  "estimatedCost": 2.50,
  "suggestedPrice": 5.50,
  "ingredients": [
    {
      "ingredientName": "Exact ingredient name from the list above",
      "quantity": 2,
      "unit": "one of: cups, ounces, grams, units, teaspoons, tablespoons, pounds, kilograms, milliliters, liters, pints, quarts, gallons",
      "inInventory": true
    }
  ],
  "missingIngredients": ["ingredient name if not in available list"]
}

For each ingredient, set "inInventory" to true if it's in the available ingredients list, false otherwise.
List any ingredients NOT in the available list in the "missingIngredients" array.
Estimate the cost and suggest a profitable menu price (aim for 65-75% margin).

CRITICAL: Return ONLY valid JSON, no markdown code blocks or explanations.`;

      const response = await callAI({
        provider: provider as AIProvider,
        prompt,
        systemPrompt,
        customApiKey,
      });

      // Try to parse JSON response, clean up markdown code blocks if present
      let recipes;
      try {
        let cleanResponse = response.trim();
        // Remove markdown code blocks if present
        if (cleanResponse.startsWith('```json')) {
          cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        } else if (cleanResponse.startsWith('```')) {
          cleanResponse = cleanResponse.replace(/```\n?/g, '').trim();
        }
        recipes = JSON.parse(cleanResponse);
      } catch (parseError) {
        console.error("Failed to parse AI response as JSON:", parseError);
        // Fallback: return the raw text response
        return res.json({ response, recipes: null });
      }

      res.json({ response, recipes });
    } catch (error: any) {
      console.error("AI recipe ideas error:", error);
      res.status(500).json({ error: error.message || "Failed to generate recipe ideas" });
    }
  });

  // Create recipe from AI suggestion (no usage tracking - just saves AI-generated recipe)
  app.post("/api/ai/create-recipe", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, description, category, servings, ingredients: suggestedIngredients } = req.body;

      if (!name || !category || !servings || !Array.isArray(suggestedIngredients)) {
        return res.status(400).json({ error: "Invalid recipe data" });
      }

      // Get all ingredients for fuzzy matching
      const allIngredients = await storage.getAllIngredients(userId);

      // Create the recipe first
      const recipe = await storage.createRecipe({
        name,
        description: description || "",
        category,
        servings,
      }, userId);

      // Add ingredients to the recipe with fuzzy matching
      for (const suggestedIng of suggestedIngredients) {
        const match = findIngredientMatch(suggestedIng.ingredientName, allIngredients);
        
        if (match.ingredient) {
          // Log fuzzy matches for transparency
          if (!match.wasExactMatch) {
            console.log(`Fuzzy matched "${suggestedIng.ingredientName}" → "${match.ingredient.name}" (confidence: ${(match.confidence * 100).toFixed(0)}%)`);
          }
          
          await storage.createRecipeIngredient({
            recipeId: recipe.id,
            ingredientId: match.ingredient.id,
            quantity: suggestedIng.quantity,
            unit: suggestedIng.unit,
          }, userId);
        } else {
          console.warn(`Ingredient not found: ${suggestedIng.ingredientName}`);
        }
      }

      // Fetch complete recipe with ingredients
      const completeRecipe = await storage.getRecipeWithIngredients(recipe.id, userId);
      res.status(201).json(completeRecipe);
    } catch (error: any) {
      console.error("Create recipe from AI error:", error);
      res.status(500).json({ error: error.message || "Failed to create recipe" });
    }
  });

  // AI Recipe Parser - accepts text or image
  app.post("/api/ai/parse-recipe", upload.single("image"), isAuthenticated, aiUsageMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { recipeText } = req.body;
      const imageFile = req.file;

      if (!recipeText && !imageFile) {
        return res.status(400).json({ error: "Please provide either recipe text or an image" });
      }

      // Validate image file if provided
      if (imageFile) {
        const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
        const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'image/webp'];
        
        if (imageFile.size > MAX_FILE_SIZE) {
          return res.status(400).json({ error: "Image file too large. Maximum size is 5MB." });
        }
        
        if (!ALLOWED_TYPES.includes(imageFile.mimetype)) {
          return res.status(400).json({ error: "Invalid image type. Allowed: JPG, PNG, HEIC, WebP." });
        }
      }

      // Validate text length if provided
      if (recipeText && recipeText.length > 10000) {
        return res.status(400).json({ error: "Recipe text too long. Maximum 10,000 characters." });
      }

      // Get AI provider settings
      const settings = await storage.getAISettings(userId);
      const provider = (settings?.aiProvider || "openai") as AIProvider;
      const customApiKey = settings?.huggingfaceToken || undefined;

      // Check if provider supports vision for image requests
      if (imageFile && provider !== "openai" && provider !== "gemini") {
        return res.status(400).json({ 
          error: "Image parsing is only supported with OpenAI or Gemini. Please change your AI provider in Settings." 
        });
      }

      // Prepare system prompt for recipe extraction
      const systemPrompt = `You are a professional recipe parser. Extract recipe information from text or images and return ONLY valid JSON, no additional text or markdown.`;

      let imageUrl: string | undefined;
      if (imageFile) {
        // Convert image to base64 data URL for AI vision
        const base64Image = imageFile.buffer.toString('base64');
        imageUrl = `data:${imageFile.mimetype};base64,${base64Image}`;
      }

      const prompt = imageFile
        ? `Extract the recipe from this image and return the data in JSON format.`
        : `Extract the recipe from the following text and return the data in JSON format:\n\n${recipeText}`;

      const fullPrompt = `${prompt}

Return a JSON object with this exact structure:
{
  "name": "Recipe name",
  "description": "Brief description",
  "category": "one of: espresso_drinks, cold_brew, tea_drinks, blended_drinks, baked_goods, breakfast, lunch, snacks, other",
  "servings": 1,
  "ingredients": [
    {
      "ingredientName": "Ingredient name",
      "quantity": 2,
      "unit": "one of: cups, ounces, grams, units, teaspoons, tablespoons, pounds, kilograms, milliliters, liters, pints, quarts, gallons"
    }
  ]
}

CRITICAL: Return ONLY valid JSON, no markdown code blocks or explanations.`;

      const response = await callAI({
        provider,
        prompt: fullPrompt,
        systemPrompt,
        customApiKey,
        imageUrl,
      });

      // Parse JSON response with robust error handling
      try {
        let cleanResponse = response.trim();
        
        // Limit response size to prevent memory issues
        if (cleanResponse.length > 50000) {
          throw new Error("AI response too large");
        }
        
        // Remove markdown code blocks if present
        if (cleanResponse.startsWith('```json')) {
          cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        } else if (cleanResponse.startsWith('```')) {
          cleanResponse = cleanResponse.replace(/```\n?/g, '').trim();
        }
        
        const recipeData = JSON.parse(cleanResponse);
        
        // Validate required fields
        if (!recipeData.name || !recipeData.category || !recipeData.servings) {
          throw new Error("Missing required recipe fields");
        }
        
        if (!Array.isArray(recipeData.ingredients) || recipeData.ingredients.length === 0) {
          throw new Error("Recipe must have at least one ingredient");
        }
        
        res.json(recipeData);
      } catch (parseError: any) {
        console.error("Failed to parse AI recipe response:", parseError);
        res.status(500).json({ 
          error: "AI returned invalid response. Please try again or provide clearer recipe data.",
          details: parseError.message
        });
      }
    } catch (error: any) {
      console.error("AI recipe parser error:", error);
      res.status(500).json({ error: error.message || "Failed to parse recipe" });
    }
  });

  app.post("/api/ai/menu-strategy", isAuthenticated, aiUsageMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { customPrompt } = req.body;
      
      // Get AI provider settings from database
      const settings = await storage.getAISettings(userId);
      const provider = (settings?.aiProvider || "openai") as AIProvider;
      const customApiKey = settings?.huggingfaceToken || undefined;

      // Get all recipes for context
      const recipes = await storage.getAllRecipes(userId);
      
      const recipeList = recipes
        .map(r => {
          const cost = r.totalCost || 0;
          const price = r.menuPrice || 0;
          const margin = price > 0 ? ((price - cost) / price * 100).toFixed(1) : "N/A";
          return `${r.name} (${r.category}) - Cost: $${cost.toFixed(2)}, Menu Price: $${price.toFixed(2)}, Margin: ${margin}%`;
        })
        .join("\n");

      const systemPrompt = `You are a professional coffee shop pricing strategist with expertise in menu optimization and profitability analysis.`;
      
      const userRequest = customPrompt 
        ? `User request: ${customPrompt}\n\n`
        : '';
      
      const prompt = `${userRequest}Analyze this coffee shop menu and provide strategic pricing recommendations${customPrompt ? ' focusing on the user\'s request' : ''}:

Current Menu:
${recipeList}

Please provide:
1. Overall profitability assessment
2. Pricing recommendations for each item
3. Suggested menu price adjustments to improve margins while staying competitive
4. High-margin items to promote
5. Low-margin items that need repricing or removal
6. General menu strategy advice

Format your response clearly with numbered sections.`;

      const response = await callAI({
        provider: provider as AIProvider,
        prompt,
        systemPrompt,
        customApiKey,
      });

      res.json({ response });
    } catch (error: any) {
      console.error("AI menu strategy error:", error);
      res.status(500).json({ error: error.message || "Failed to generate menu strategy" });
    }
  });

  // AI Seasonal Menu Suggestions
  app.post("/api/ai/seasonal-suggestions", isAuthenticated, aiUsageMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { season, customPrompt } = req.body;
      
      const settings = await storage.getAISettings(userId);
      const provider = (settings?.aiProvider || "openai") as AIProvider;
      const customApiKey = settings?.huggingfaceToken || undefined;

      const ingredients = await storage.getAllIngredients(userId);
      const recipes = await storage.getAllRecipes(userId);
      
      const ingredientList = ingredients
        .map(i => i.name)
        .join(", ");

      const recipeCategories = [...new Set(recipes.map(r => r.category))].join(", ");

      const systemPrompt = `You are a creative menu consultant specializing in seasonal offerings for cafes and coffee shops. You understand customer preferences, seasonal trends, and how to create buzz with limited-time offerings.`;
      
      const seasonDescriptions: Record<string, string> = {
        winter: "winter holidays, Christmas, New Year's, cozy warming drinks, comfort food",
        spring: "Easter, Mother's Day, fresh flavors, lighter options, floral notes",
        summer: "refreshing cold drinks, iced beverages, fruity flavors, outdoor dining",
        fall: "pumpkin spice, apple, maple, Halloween, Thanksgiving, cozy autumn flavors"
      };
      
      const userRequest = customPrompt ? `Additional focus: ${customPrompt}\n\n` : '';
      
      const prompt = `${userRequest}Create 5 seasonal menu suggestions for ${season} (${seasonDescriptions[season] || season}).

Available ingredients in inventory: ${ingredientList || "Various standard cafe ingredients"}
Current menu categories: ${recipeCategories || "beverages, food items"}

For each suggestion, provide:
1. A creative name that evokes the season
2. Brief description highlighting seasonal appeal
3. Target customer (families, professionals, students, etc.)
4. Estimated profit margin potential (low/medium/high)
5. List of ingredients with quantities

Return ONLY valid JSON array:
[
  {
    "name": "Seasonal Item Name",
    "description": "Appealing description",
    "category": "espresso_drinks|cold_brew|tea_drinks|blended_drinks|baked_goods|breakfast|lunch|snacks|other",
    "season": "${season}",
    "targetAudience": "target customer type",
    "estimatedMargin": "high|medium|low",
    "ingredients": [
      {"ingredientName": "ingredient name", "quantity": 2, "unit": "oz", "inInventory": true}
    ]
  }
]

Mark inInventory as true if the ingredient exists in the available inventory list, false otherwise.`;

      const response = await callAI({
        provider,
        prompt,
        systemPrompt,
        customApiKey,
      });

      let suggestions;
      try {
        let cleanResponse = response.trim();
        if (cleanResponse.startsWith('```json')) {
          cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        } else if (cleanResponse.startsWith('```')) {
          cleanResponse = cleanResponse.replace(/```\n?/g, '').trim();
        }
        suggestions = JSON.parse(cleanResponse);
      } catch (parseError) {
        console.error("Failed to parse seasonal suggestions:", parseError);
        return res.status(500).json({ error: "AI returned invalid response format" });
      }

      res.json({ suggestions });
    } catch (error: any) {
      console.error("AI seasonal suggestions error:", error);
      res.status(500).json({ error: error.message || "Failed to generate seasonal suggestions" });
    }
  });

  // AI Pricing Analysis with detailed recommendations
  app.post("/api/ai/pricing-analysis", isAuthenticated, aiUsageMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { customPrompt } = req.body;
      
      const settings = await storage.getAISettings(userId);
      const provider = (settings?.aiProvider || "openai") as AIProvider;
      const customApiKey = settings?.huggingfaceToken || undefined;

      const recipes = await storage.getAllRecipes(userId);
      
      const recipeData = recipes.map(r => {
        const cost = r.totalCost || 0;
        const price = r.menuPrice || 0;
        const margin = price > 0 ? ((price - cost) / price * 100) : 0;
        return {
          name: r.name,
          category: r.category,
          cost: cost.toFixed(2),
          price: price.toFixed(2),
          margin: margin.toFixed(1),
          hasPrice: price > 0
        };
      });

      const pricedItems = recipeData.filter(r => r.hasPrice);
      const unpricedItems = recipeData.filter(r => !r.hasPrice);
      
      const avgMargin = pricedItems.length > 0 
        ? pricedItems.reduce((sum, r) => sum + parseFloat(r.margin), 0) / pricedItems.length 
        : 0;

      const systemPrompt = `You are an expert restaurant pricing strategist with deep knowledge of food service economics, competitive positioning, and consumer psychology. Focus on actionable, specific recommendations.`;
      
      const userRequest = customPrompt ? `Focus area: ${customPrompt}\n\n` : '';
      
      const prompt = `${userRequest}Analyze this menu's pricing strategy and provide specific recommendations.

MENU DATA:
Items with prices (${pricedItems.length}):
${pricedItems.map(r => `- ${r.name} (${r.category}): Cost $${r.cost}, Price $${r.price}, Margin ${r.margin}%`).join('\n')}

${unpricedItems.length > 0 ? `Items needing prices (${unpricedItems.length}):\n${unpricedItems.map(r => `- ${r.name} (${r.category}): Cost $${r.cost}`).join('\n')}` : ''}

Current average margin: ${avgMargin.toFixed(1)}%

Provide:
1. OVERALL ASSESSMENT: Brief analysis of current pricing health
2. IMMEDIATE OPPORTUNITIES: Quick wins for margin improvement
3. ITEMS TO REPRICE: Specific items that are underpriced or overpriced
4. COMPETITIVE POSITIONING: How to position against competitors
5. PROMOTIONAL STRATEGY: Which items to feature/promote

Format your response clearly with headers and bullet points for easy reading.`;

      const response = await callAI({
        provider,
        prompt,
        systemPrompt,
        customApiKey,
      });

      res.json({ analysis: response, recommendations: [] });
    } catch (error: any) {
      console.error("AI pricing analysis error:", error);
      res.status(500).json({ error: error.message || "Failed to analyze pricing" });
    }
  });

  // AI Business Strategy Advisor
  app.post("/api/ai/business-advice", isAuthenticated, aiUsageMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { businessType, location, customPrompt } = req.body;
      
      const settings = await storage.getAISettings(userId);
      const provider = (settings?.aiProvider || "openai") as AIProvider;
      const customApiKey = settings?.huggingfaceToken || undefined;

      const ingredients = await storage.getAllIngredients(userId);
      const recipes = await storage.getAllRecipes(userId);
      
      const ingredientCategories = [...new Set(ingredients.map(i => i.category))];
      const recipeCategories = [...new Set(recipes.map(r => r.category))];
      
      const avgCost = recipes.length > 0 
        ? recipes.reduce((sum, r) => sum + (r.totalCost || 0), 0) / recipes.length 
        : 0;
      const avgPrice = recipes.filter(r => r.menuPrice).length > 0
        ? recipes.filter(r => r.menuPrice).reduce((sum, r) => sum + (r.menuPrice || 0), 0) / recipes.filter(r => r.menuPrice).length
        : 0;

      const businessTypeLabels: Record<string, string> = {
        coffee_shop: "Coffee Shop / Cafe",
        bakery: "Bakery",
        restaurant: "Restaurant",
        food_truck: "Food Truck",
        catering: "Catering Service"
      };

      const systemPrompt = `You are a seasoned food service business consultant with expertise in market positioning, customer acquisition, premium offerings, and revenue optimization. Provide strategic, actionable advice tailored to the specific business context.`;
      
      const userRequest = customPrompt ? `Specific question: ${customPrompt}\n\n` : '';
      const locationContext = location ? `Location/Market: ${location}\n` : '';
      
      const prompt = `${userRequest}Provide strategic business advice for this ${businessTypeLabels[businessType] || businessType}.

BUSINESS CONTEXT:
${locationContext}Business Type: ${businessTypeLabels[businessType] || businessType}
Inventory Categories: ${ingredientCategories.join(", ") || "Not specified"}
Menu Categories: ${recipeCategories.join(", ") || "Not specified"}
Menu Size: ${recipes.length} items
Average Item Cost: $${avgCost.toFixed(2)}
Average Menu Price: $${avgPrice.toFixed(2)}

Provide comprehensive advice on:

1. MARKET POSITIONING
   - How to differentiate in this market
   - Target customer segments to focus on

2. PREMIUM OPPORTUNITIES
   - Higher-end products/services to introduce
   - Premium pricing strategies that work for this market
   - Signature items that command premium prices

3. REVENUE GROWTH
   - Upselling and cross-selling strategies
   - Add-on services or products
   - Customer retention tactics

4. COMPETITIVE ADVANTAGES
   - How to compete with chains and competitors
   - Unique selling propositions to develop

5. OPERATIONAL IMPROVEMENTS
   - Efficiency gains to improve margins
   - Menu optimization suggestions

${location ? `6. LOCATION-SPECIFIC ADVICE\n   - Strategies specific to ${location}\n   - Local market opportunities` : ''}

Be specific and actionable. Provide concrete examples and price points where relevant.`;

      const response = await callAI({
        provider,
        prompt,
        systemPrompt,
        customApiKey,
      });

      res.json({ advice: response });
    } catch (error: any) {
      console.error("AI business advice error:", error);
      res.status(500).json({ error: error.message || "Failed to generate business advice" });
    }
  });

  // Dashboard Chatbot - Quick questions about menu and metrics with chart suggestions
  app.post("/api/ai/dashboard-chat", isAuthenticated, aiUsageMiddleware, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { message } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message is required" });
      }

      const settings = await storage.getAISettings(userId);
      const provider = (settings?.aiProvider || "openai") as AIProvider;
      const customApiKey = settings?.huggingfaceToken || undefined;

      const ingredients = await storage.getAllIngredients(userId);
      const recipes = await storage.getAllRecipes(userId);
      const userDashboardConfigs = await storage.getAllDashboardConfigs(userId);
      const activeChartTypes = userDashboardConfigs.filter(c => c.isVisible).map(c => c.chartType);
      
      // Calculate key metrics
      const totalInventoryValue = ingredients.reduce((sum, i) => sum + (i.costPerUnit * i.quantity), 0);
      const avgRecipeCost = recipes.length > 0 
        ? recipes.reduce((sum, r) => sum + (r.totalCost || 0), 0) / recipes.length 
        : 0;
      const recipesWithPricing = recipes.filter(r => r.menuPrice && r.menuPrice > 0);
      const avgMargin = recipesWithPricing.length > 0
        ? recipesWithPricing.reduce((sum, r) => {
            const cost = r.costPerServing || 0;
            const price = r.menuPrice || 0;
            return sum + (price > 0 ? ((price - cost) / price * 100) : 0);
          }, 0) / recipesWithPricing.length
        : 0;
      
      const highestMarginRecipe = recipesWithPricing.length > 0
        ? recipesWithPricing.reduce((best, r) => {
            const rMargin = r.menuPrice ? ((r.menuPrice - (r.costPerServing || 0)) / r.menuPrice * 100) : 0;
            const bestMargin = best.menuPrice ? ((best.menuPrice - (best.costPerServing || 0)) / best.menuPrice * 100) : 0;
            return rMargin > bestMargin ? r : best;
          })
        : null;
      
      const lowestMarginRecipe = recipesWithPricing.length > 0
        ? recipesWithPricing.reduce((worst, r) => {
            const rMargin = r.menuPrice ? ((r.menuPrice - (r.costPerServing || 0)) / r.menuPrice * 100) : 0;
            const worstMargin = worst.menuPrice ? ((worst.menuPrice - (worst.costPerServing || 0)) / worst.menuPrice * 100) : 0;
            return rMargin < worstMargin ? r : worst;
          })
        : null;

      const mostExpensiveRecipe = recipes.length > 0
        ? recipes.reduce((max, r) => (r.totalCost || 0) > (max.totalCost || 0) ? r : max)
        : null;

      const ingredientCategories = [...new Set(ingredients.map(i => i.category))];
      const recipeCategories = [...new Set(recipes.map(r => r.category))];

      // Build chart types info for the AI
      const chartTypesInfo = Object.entries(dashboardChartLabels).map(([type, info]) => ({
        type,
        name: info.name,
        description: info.description,
        alreadyOnDashboard: activeChartTypes.includes(type),
      }));

      const systemPrompt = `You are a friendly, helpful assistant for MenuMetrics - a recipe cost analysis app for coffee shops and cafes. You help users understand their menu data and answer questions about their ingredients, recipes, costs, and margins.

Keep responses concise and helpful. Use the metrics data provided to answer questions accurately. If asked about specific items, search the data provided. Be conversational and supportive.

IMPORTANT: You can suggest adding charts to the user's dashboard! When the user asks about visualizing data, seeing charts, creating graphs, or asks questions that would benefit from a visualization, you should suggest relevant chart types.

When suggesting charts, end your response with a special marker:
[SUGGEST_CHARTS: chart_type_1, chart_type_2]

Available chart types you can suggest:
${chartTypesInfo.map(c => `- ${c.type}: ${c.name} - ${c.description}${c.alreadyOnDashboard ? ' (ALREADY ON DASHBOARD)' : ''}`).join('\n')}

Only suggest charts that are NOT already on the user's dashboard. If a chart is already there, mention that instead.
If the user asks for a chart or visualization, suggest the most relevant one(s).
If answering a data question that doesn't need a chart, just answer normally without suggesting charts.`;
      
      const prompt = `User question: "${message}"

CURRENT BUSINESS DATA:

INVENTORY SUMMARY:
- Total ingredients: ${ingredients.length}
- Inventory categories: ${ingredientCategories.join(", ") || "None"}
- Total inventory value: $${totalInventoryValue.toFixed(2)}

MENU SUMMARY:
- Total recipes: ${recipes.length}
- Recipe categories: ${recipeCategories.join(", ") || "None"}
- Recipes with pricing: ${recipesWithPricing.length}
- Average recipe cost: $${avgRecipeCost.toFixed(2)}
- Average margin: ${avgMargin.toFixed(1)}%
${highestMarginRecipe ? `- Highest margin item: ${highestMarginRecipe.name} (${((highestMarginRecipe.menuPrice! - (highestMarginRecipe.costPerServing || 0)) / highestMarginRecipe.menuPrice! * 100).toFixed(1)}%)` : ''}
${lowestMarginRecipe ? `- Lowest margin item: ${lowestMarginRecipe.name} (${((lowestMarginRecipe.menuPrice! - (lowestMarginRecipe.costPerServing || 0)) / lowestMarginRecipe.menuPrice! * 100).toFixed(1)}%)` : ''}
${mostExpensiveRecipe ? `- Most expensive to make: ${mostExpensiveRecipe.name} ($${(mostExpensiveRecipe.totalCost || 0).toFixed(2)})` : ''}

CHARTS ALREADY ON DASHBOARD:
${activeChartTypes.length > 0 ? activeChartTypes.map(t => `- ${dashboardChartLabels[t as keyof typeof dashboardChartLabels]?.name || t}`).join('\n') : '- None yet'}

INGREDIENTS LIST:
${ingredients.slice(0, 20).map(i => `- ${i.name}: $${i.costPerUnit.toFixed(2)}/${i.purchaseUnit} (${i.category})`).join('\n')}
${ingredients.length > 20 ? `... and ${ingredients.length - 20} more` : ''}

RECIPES LIST:
${recipes.slice(0, 20).map(r => `- ${r.name}: Cost $${(r.costPerServing || 0).toFixed(2)}${r.menuPrice ? `, Price $${r.menuPrice.toFixed(2)}` : ''} (${r.category})`).join('\n')}
${recipes.length > 20 ? `... and ${recipes.length - 20} more` : ''}

Answer the user's question based on this data. Be helpful and specific.
If suggesting a chart, remember to add the [SUGGEST_CHARTS: ...] marker at the end of your response.`;

      const aiResponse = await callAI({
        provider,
        prompt,
        systemPrompt,
        customApiKey,
      });

      // Parse the response to extract chart suggestions
      const chartSuggestMatch = aiResponse.match(/\[SUGGEST_CHARTS:\s*([^\]]+)\]/i);
      let suggestedCharts: { type: string; name: string; description: string }[] = [];
      let cleanResponse = aiResponse;

      if (chartSuggestMatch) {
        // Remove the marker from the response
        cleanResponse = aiResponse.replace(/\[SUGGEST_CHARTS:\s*[^\]]+\]/i, '').trim();
        
        // Parse the suggested chart types
        const chartTypesStr = chartSuggestMatch[1];
        const suggestedTypes = chartTypesStr.split(',').map(s => s.trim().toLowerCase());
        
        // Map to full chart info, filtering out invalid types and ones already on dashboard
        suggestedCharts = suggestedTypes
          .filter(type => dashboardChartLabels[type as keyof typeof dashboardChartLabels] && !activeChartTypes.includes(type))
          .map(type => ({
            type,
            name: dashboardChartLabels[type as keyof typeof dashboardChartLabels].name,
            description: dashboardChartLabels[type as keyof typeof dashboardChartLabels].description,
          }));
      }

      res.json({ 
        response: cleanResponse,
        suggestedCharts: suggestedCharts.length > 0 ? suggestedCharts : undefined,
      });
    } catch (error: any) {
      console.error("Dashboard chat error:", error);
      res.status(500).json({ error: error.message || "Failed to process chat message" });
    }
  });

  // AI-powered density estimation for ingredients
  app.post("/api/ingredients/estimate-densities", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log(`[DENSITY] Starting density estimation for user ${userId}`);
      
      // Get AI provider settings
      const settings = await storage.getAISettings(userId);
      const provider = (settings?.aiProvider || "openai") as AIProvider;
      const customApiKey = settings?.huggingfaceToken || undefined;
      console.log(`[DENSITY] Using AI provider: ${provider}`);

      // Get all user's ingredients
      const allIngredients = await storage.getAllIngredients(userId);
      console.log(`[DENSITY] Total ingredients: ${allIngredients.length}`);
      
      // Filter for ingredients missing density (and exclude packaging)
      const needsDensity = allIngredients.filter(ing => 
        !ing.gramsPerMilliliter && !ing.isPackaging
      );
      console.log(`[DENSITY] Ingredients needing density: ${needsDensity.length}`, needsDensity.map(i => i.name));

      if (needsDensity.length === 0) {
        console.log(`[DENSITY] No ingredients need density estimation`);
        return res.json({ 
          message: "All ingredients already have density values!",
          updated: 0,
          total: allIngredients.length
        });
      }

      // Prepare ingredient list for AI (name only, no category)
      const ingredientList = needsDensity
        .map(ing => ing.name)
        .join("\n");

      const systemPrompt = `You are a food science expert specializing in ingredient densities and measurements. Your task is to estimate accurate density values (grams per milliliter) for common food and beverage ingredients.`;

      const prompt = `Estimate the density (grams per milliliter) for each of these food/beverage ingredients. Use standard food science references and common knowledge about ingredient densities.

Ingredients to estimate:
${ingredientList}

IMPORTANT: Return ONLY a valid JSON array with this exact structure, no other text or markdown:
[
  {
    "name": "exact ingredient name from the list above",
    "gramsPerMilliliter": 1.03,
    "reasoning": "brief explanation"
  }
]

Make sure the "name" field exactly matches the ingredient name from the list (no extra text, no categories in parentheses).

Common reference densities:
- Water: 1.00 g/mL
- Milk (whole): 1.03 g/mL
- Heavy cream: 0.99 g/mL
- Espresso/Coffee: 1.00 g/mL
- Sugar (granulated): 0.85 g/mL (settled)
- Flour (all-purpose): 0.50-0.55 g/mL
- Cocoa powder: 0.50 g/mL
- Honey: 1.42 g/mL
- Maple syrup: 1.33 g/mL
- Vanilla extract: 0.88 g/mL
- Butter: 0.91 g/mL
- Oil (vegetable): 0.92 g/mL

Return the JSON array now:`;

      console.log(`[DENSITY] Calling AI for ${needsDensity.length} ingredients...`);
      const response = await callAI({
        provider,
        prompt,
        systemPrompt,
        customApiKey,
      });
      console.log(`[DENSITY] AI response received, length: ${response.length} chars`);

      // Parse AI response
      let cleanResponse = response.trim();
      
      // Remove markdown code blocks
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```\n?/g, '').trim();
      }
      
      const densityEstimates = JSON.parse(cleanResponse);
      console.log(`[DENSITY] Parsed ${densityEstimates.length} density estimates from AI`);
      
      if (!Array.isArray(densityEstimates)) {
        throw new Error("AI response is not an array");
      }

      // Update ingredients with estimated densities
      let updatedCount = 0;
      const results = [];

      for (const estimate of densityEstimates) {
        // Find matching ingredient (case-insensitive)
        const ingredient = needsDensity.find(ing => 
          ing.name.toLowerCase() === estimate.name.toLowerCase()
        );

        if (ingredient && typeof estimate.gramsPerMilliliter === 'number') {
          console.log(`[DENSITY] Updating ${ingredient.name} with density ${estimate.gramsPerMilliliter}`);
          // Update ingredient with new density (preserve all other fields)
          try {
            const updated = await storage.updateIngredient(ingredient.id, {
              name: ingredient.name,
              category: ingredient.category,
              purchaseQuantity: ingredient.purchaseQuantity,
              purchaseUnit: ingredient.purchaseUnit,
              purchaseCost: ingredient.purchaseCost,
              isPackaging: ingredient.isPackaging,
              store: ingredient.store || undefined,
              gramsPerMilliliter: estimate.gramsPerMilliliter,
              densitySource: `AI-estimated (${provider})`,
            }, userId);
            
            if (updated) {
              console.log(`[DENSITY] Successfully updated ${ingredient.name}, new density: ${updated.gramsPerMilliliter}`);
              updatedCount++;
              results.push({
                name: ingredient.name,
                density: estimate.gramsPerMilliliter,
                reasoning: estimate.reasoning
              });
            } else {
              console.error(`[DENSITY] Update returned null for ${ingredient.name}`);
            }
          } catch (updateError: any) {
            console.error(`[DENSITY] Failed to update ${ingredient.name}:`, updateError);
          }
        } else {
          console.log(`[DENSITY] Skipping estimate for ${estimate.name} - no matching ingredient or invalid density`);
        }
      }

      console.log(`[DENSITY] Completed: updated ${updatedCount} of ${needsDensity.length} ingredients`);
      res.json({
        message: `Successfully estimated densities for ${updatedCount} ingredients`,
        updated: updatedCount,
        total: needsDensity.length,
        results
      });

    } catch (error: any) {
      console.error("[DENSITY] Density estimation error:", error);
      res.status(500).json({ 
        error: error.message || "Failed to estimate densities",
        details: error.originalError?.message || error.message
      });
    }
  });

  // AI Settings endpoints
  app.get("/api/settings/ai", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const settings = await storage.getAISettings(userId);
      res.json(settings);
    } catch (error: any) {
      console.error("Get AI settings error:", error);
      res.status(500).json({ error: "Failed to retrieve AI settings" });
    }
  });

  app.post("/api/settings/ai", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertAISettingsSchema.parse(req.body);
      const updated = await storage.saveAISettings(validatedData, userId);
      res.json(updated);
    } catch (error: any) {
      console.error("Save AI settings error:", error);
      res.status(400).json({ error: error.message || "Failed to save AI settings" });
    }
  });

  // Density heuristics endpoints
  app.get("/api/density-heuristics", async (req, res) => {
    try {
      const heuristics = await storage.getAllDensityHeuristics();
      res.json(heuristics);
    } catch (error: any) {
      console.error("Get density heuristics error:", error);
      res.status(500).json({ error: "Failed to retrieve density heuristics" });
    }
  });

  // Suggest density for an ingredient using fuzzy matching
  app.get("/api/density-heuristics/suggest/:ingredientName", async (req, res) => {
    try {
      const { ingredientName } = req.params;
      const heuristics = await storage.getAllDensityHeuristics();
      
      // Import and use fuzzy matching
      const { findMatchingDensity } = await import("@shared/density-lookup");
      const match = findMatchingDensity(ingredientName, heuristics);
      
      if (match) {
        res.json({
          found: true,
          ingredientName: match.match.ingredientName,
          density: match.match.gramsPerMilliliter,
          confidence: match.confidence,
          category: match.match.category,
          notes: match.match.notes,
        });
      } else {
        res.json({ found: false });
      }
    } catch (error: any) {
      console.error("Suggest density error:", error);
      res.status(500).json({ error: "Failed to suggest density" });
    }
  });

  app.post("/api/density-heuristics", async (req, res) => {
    try {
      const validatedData = insertDensityHeuristicSchema.parse(req.body);
      const created = await storage.createDensityHeuristic(validatedData);
      res.status(201).json(created);
    } catch (error: any) {
      console.error("Create density heuristic error:", error);
      res.status(400).json({ error: error.message || "Failed to create density heuristic" });
    }
  });

  app.patch("/api/density-heuristics/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const updated = await storage.updateDensityHeuristic(id, updates);
      if (!updated) {
        return res.status(404).json({ error: "Density heuristic not found" });
      }
      res.json(updated);
    } catch (error: any) {
      console.error("Update density heuristic error:", error);
      res.status(400).json({ error: error.message || "Failed to update density heuristic" });
    }
  });

  // Refresh ingredient densities by matching against density heuristics
  app.post("/api/ingredients/refresh-densities", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { findBestMatch } = await import("@shared/fuzzy-matcher");
      
      const ingredients = await storage.getAllIngredients(userId);
      let densityHeuristics = await storage.getAllDensityHeuristics();
      
      // Filter out invalid density heuristics and map to have 'name' property for fuzzy matching
      const validDensities = densityHeuristics
        .filter(h => h.ingredientName && h.ingredientName.trim())
        .map(h => ({ ...h, name: h.ingredientName }));
      
      // Find ingredients that need density matching
      const ingredientsNeedingDensity = ingredients.filter(i => 
        !i.gramsPerMilliliter && 
        !i.isPackaging && 
        i.purchaseUnit !== "units"
      );
      
      console.log(`Refresh densities: Found ${ingredientsNeedingDensity.length} ingredients needing density`);
      console.log(`Valid densities available: ${validDensities.length}`);
      
      let updated = 0;
      const results: Array<{ name: string; density: number; confidence: number }> = [];
      
      for (const ingredient of ingredientsNeedingDensity) {
        // Try to find matching density using fuzzy matching
        const match = findBestMatch(ingredient.name, validDensities, {
          autoMatchThreshold: 0.60,
          minThreshold: 0.55,
          useNormalization: true,
        });
        
        console.log(`Checking "${ingredient.name}": ${match ? `matched "${match.match.ingredientName}" (${match.confidence.toFixed(2)})` : "no match"}`);
        
        if (match && match.confidence >= 0.60) {
          // Update the ingredient with the found density
          const updated_ingredient = await storage.updateIngredient(
            ingredient.id,
            {
              ...ingredient,
              gramsPerMilliliter: match.match.gramsPerMilliliter,
              densitySource: `Matched from density table: ${match.match.ingredientName}`,
            },
            userId
          );
          
          if (updated_ingredient) {
            updated++;
            results.push({
              name: ingredient.name,
              density: match.match.gramsPerMilliliter,
              confidence: match.confidence,
            });
            console.log(`Updated "${ingredient.name}" with density ${match.match.gramsPerMilliliter}`);
          }
        }
      }
      
      res.json({
        success: true,
        updated,
        total: ingredients.length,
        skipped: ingredients.length - ingredientsNeedingDensity.length,
        results: results.slice(0, 10),
        message: `Successfully updated ${updated} ingredient${updated !== 1 ? "s" : ""} with densities from the reference table.`,
      });
    } catch (error: any) {
      console.error("Refresh densities error:", error);
      res.status(500).json({ error: "Failed to refresh densities" });
    }
  });

  // =====================
  // WASTE LOG ENDPOINTS
  // =====================
  
  app.get("/api/waste-logs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = req.query.limit ? parseInt(req.query.limit) : 100;
      const wasteLogs = await storage.getWasteLogs(userId, limit);
      res.json(wasteLogs);
    } catch (error: any) {
      console.error("Get waste logs error:", error);
      res.status(500).json({ error: "Failed to fetch waste logs" });
    }
  });

  app.get("/api/waste-logs/date-range", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }
      
      const wasteLogs = await storage.getWasteLogsByDateRange(
        userId, 
        new Date(startDate as string), 
        new Date(endDate as string)
      );
      res.json(wasteLogs);
    } catch (error: any) {
      console.error("Get waste logs by date error:", error);
      res.status(500).json({ error: "Failed to fetch waste logs" });
    }
  });

  app.post("/api/waste-logs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body with Zod schema
      const validatedData = insertWasteLogSchema.parse(req.body);
      
      // Verify ingredient exists and belongs to user
      const ingredient = await storage.getIngredient(validatedData.ingredientId, userId);
      if (!ingredient) {
        return res.status(404).json({ error: "Ingredient not found" });
      }
      
      const wasteLog = await storage.createWasteLog({
        ...validatedData,
        wastedAt: validatedData.wastedAt ? new Date(validatedData.wastedAt) : new Date(),
      }, userId);
      
      res.status(201).json(wasteLog);
    } catch (error: any) {
      console.error("Create waste log error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: error.message || "Failed to create waste log" });
    }
  });

  app.delete("/api/waste-logs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const deleted = await storage.deleteWasteLog(req.params.id, userId);
      if (!deleted) {
        return res.status(404).json({ error: "Waste log not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete waste log error:", error);
      res.status(500).json({ error: "Failed to delete waste log" });
    }
  });

  // =====================
  // INVENTORY ENDPOINTS  
  // =====================
  
  app.patch("/api/ingredients/:id/stock", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { currentStock } = req.body;
      
      if (typeof currentStock !== "number" || currentStock < 0) {
        return res.status(400).json({ error: "currentStock must be a non-negative number" });
      }
      
      const updated = await storage.updateIngredientStock(req.params.id, currentStock, userId);
      if (!updated) {
        return res.status(404).json({ error: "Ingredient not found" });
      }
      res.json(updated);
    } catch (error: any) {
      console.error("Update stock error:", error);
      res.status(500).json({ error: "Failed to update stock" });
    }
  });

  app.patch("/api/ingredients/:id/inventory-settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { parValue, storageType, countFrequency } = req.body;
      
      const settings: { parValue?: number; storageType?: string; countFrequency?: string } = {};
      
      if (parValue !== undefined) {
        if (typeof parValue !== "number" || parValue < 0) {
          return res.status(400).json({ error: "parValue must be a non-negative number" });
        }
        settings.parValue = parValue;
      }
      
      if (storageType !== undefined) {
        if (!["dry", "cold", "frozen", "supplies"].includes(storageType)) {
          return res.status(400).json({ error: "storageType must be one of: dry, cold, frozen, supplies" });
        }
        settings.storageType = storageType;
      }
      
      if (countFrequency !== undefined) {
        if (!["weekly", "monthly", "as_needed"].includes(countFrequency)) {
          return res.status(400).json({ error: "countFrequency must be one of: weekly, monthly, as_needed" });
        }
        settings.countFrequency = countFrequency;
      }
      
      if (Object.keys(settings).length === 0) {
        return res.status(400).json({ error: "At least one setting must be provided" });
      }
      
      const updated = await storage.updateIngredientInventorySettings(req.params.id, settings, userId);
      if (!updated) {
        return res.status(404).json({ error: "Ingredient not found" });
      }
      res.json(updated);
    } catch (error: any) {
      console.error("Update inventory settings error:", error);
      res.status(500).json({ error: "Failed to update inventory settings" });
    }
  });

  app.post("/api/inventory/bulk-update", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { updates } = req.body;
      
      if (!Array.isArray(updates)) {
        return res.status(400).json({ error: "updates must be an array" });
      }
      
      const results = [];
      for (const update of updates) {
        const { ingredientId, currentStock } = update;
        if (!ingredientId || typeof currentStock !== "number" || currentStock < 0) {
          continue;
        }
        const updated = await storage.updateIngredientStock(ingredientId, currentStock, userId);
        if (updated) {
          results.push(updated);
        }
      }
      
      res.json({ 
        updated: results.length, 
        total: updates.length,
        message: `Updated ${results.length} of ${updates.length} items` 
      });
    } catch (error: any) {
      console.error("Bulk update stock error:", error);
      res.status(500).json({ error: "Failed to bulk update stock" });
    }
  });

  app.post("/api/inventory/count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body with Zod schema
      const validatedData = insertInventoryCountSchema.parse(req.body);
      
      const count = await storage.recordInventoryCount({
        ...validatedData,
        countedAt: validatedData.countedAt ? new Date(validatedData.countedAt) : new Date(),
      }, userId);
      
      res.status(201).json(count);
    } catch (error: any) {
      console.error("Record inventory count error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to record inventory count" });
    }
  });

  app.get("/api/inventory/counts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = req.query.limit ? parseInt(req.query.limit) : 50;
      const counts = await storage.getInventoryCounts(userId, limit);
      res.json(counts);
    } catch (error: any) {
      console.error("Get inventory counts error:", error);
      res.status(500).json({ error: "Failed to fetch inventory counts" });
    }
  });

  // Get order suggestions based on par values and current stock
  app.get("/api/inventory/order-suggestions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const ingredients = await storage.getAllIngredients(userId);
      
      // Filter ingredients that need ordering (current stock < par value)
      const needsOrder = ingredients
        .filter(ing => 
          ing.parValue !== null && 
          ing.currentStock !== null && 
          ing.currentStock < ing.parValue
        )
        .map(ing => ({
          id: ing.id,
          name: ing.name,
          category: ing.category,
          store: ing.store,
          currentStock: ing.currentStock,
          parValue: ing.parValue,
          orderQuantity: (ing.parValue || 0) - (ing.currentStock || 0),
          purchaseUnit: ing.purchaseUnit,
          purchaseCost: ing.purchaseCost,
          purchaseQuantity: ing.purchaseQuantity,
          storageType: ing.storageType,
        }));
      
      // Group by store
      const byStore: Record<string, typeof needsOrder> = {};
      for (const item of needsOrder) {
        const store = item.store || "Unspecified";
        if (!byStore[store]) {
          byStore[store] = [];
        }
        byStore[store].push(item);
      }
      
      res.json({
        items: needsOrder,
        byStore,
        totalItems: needsOrder.length,
        summary: Object.entries(byStore).map(([store, items]) => ({
          store,
          itemCount: items.length,
          estimatedCost: items.reduce((sum, item) => {
            const unitsNeeded = item.orderQuantity / item.purchaseQuantity;
            return sum + (unitsNeeded * item.purchaseCost);
          }, 0),
        })),
      });
    } catch (error: any) {
      console.error("Get order suggestions error:", error);
      res.status(500).json({ error: "Failed to get order suggestions" });
    }
  });

  // Dashboard configuration routes
  app.get("/api/dashboard-configs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let configs = await storage.getDashboardConfigs(userId);
      
      // Create default configs if user has none
      if (configs.length === 0) {
        configs = await storage.createDefaultDashboardConfigs(userId);
      }
      
      res.json(configs);
    } catch (error) {
      console.error("Get dashboard configs error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard configurations" });
    }
  });

  app.get("/api/dashboard-chart-types", isAuthenticated, async (req: any, res) => {
    try {
      res.json({
        types: dashboardChartTypes,
        labels: dashboardChartLabels,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch chart types" });
    }
  });

  app.post("/api/dashboard-configs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertDashboardConfigSchema.parse(req.body);
      const config = await storage.createDashboardConfig(validatedData, userId);
      res.status(201).json(config);
    } catch (error) {
      console.error("Create dashboard config error:", error);
      res.status(400).json({ error: "Invalid dashboard configuration data" });
    }
  });

  // NOTE: This route MUST be before /:id routes to avoid "reorder" being matched as an ID
  app.patch("/api/dashboard-configs/reorder", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { orderedIds } = req.body;
      if (!Array.isArray(orderedIds)) {
        return res.status(400).json({ error: "orderedIds must be an array" });
      }
      const configs = await storage.reorderDashboardConfigs(userId, orderedIds);
      res.json(configs);
    } catch (error) {
      console.error("Reorder dashboard configs error:", error);
      res.status(500).json({ error: "Failed to reorder dashboard configurations" });
    }
  });

  app.patch("/api/dashboard-configs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const config = await storage.updateDashboardConfig(req.params.id, req.body, userId);
      if (!config) {
        return res.status(404).json({ error: "Dashboard configuration not found" });
      }
      res.json(config);
    } catch (error) {
      console.error("Update dashboard config error:", error);
      res.status(400).json({ error: "Invalid dashboard configuration data" });
    }
  });

  app.delete("/api/dashboard-configs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const deleted = await storage.deleteDashboardConfig(req.params.id, userId);
      if (!deleted) {
        return res.status(404).json({ error: "Dashboard configuration not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Delete dashboard config error:", error);
      res.status(500).json({ error: "Failed to delete dashboard configuration" });
    }
  });

  // ============================================================================
  // MANAGED PRICING ADD-ON ROUTES
  // ============================================================================

  // Get available managed pricing tiers
  app.get("/api/managed-pricing/tiers", isAuthenticated, async (req: any, res) => {
    try {
      res.json(managedPricingTiers);
    } catch (error) {
      console.error("Get managed pricing tiers error:", error);
      res.status(500).json({ error: "Failed to fetch pricing tiers" });
    }
  });

  // Get user's managed pricing subscription
  app.get("/api/managed-pricing", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const subscription = await storage.getManagedPricingSubscription(userId);
      
      if (!subscription) {
        return res.json(null);
      }
      
      // Also return the user's item count for tier recommendation
      const ingredients = await storage.getAllIngredients(userId);
      const recipes = await storage.getAllRecipes(userId);
      const itemCount = ingredients.length + recipes.length;
      
      res.json({
        ...subscription,
        currentItemCount: itemCount,
        tierDetails: managedPricingTiers[subscription.tier as ManagedPricingTier],
      });
    } catch (error) {
      console.error("Get managed pricing subscription error:", error);
      res.status(500).json({ error: "Failed to fetch managed pricing subscription" });
    }
  });

  // Create/subscribe to managed pricing (or reactivate canceled/paused subscription)
  app.post("/api/managed-pricing", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check if user already has a subscription
      const existing = await storage.getManagedPricingSubscription(userId);
      
      if (existing && existing.status === "active") {
        return res.status(400).json({ error: "You already have an active managed pricing subscription" });
      }
      
      // For reactivation, tier is optional - can reuse existing tier
      const requestedTier = req.body.tier || (existing ? existing.tier : null);
      
      if (!requestedTier) {
        return res.status(400).json({ error: "Tier is required for new subscriptions" });
      }
      
      // Validate tier exists
      if (!managedPricingTiers[requestedTier as ManagedPricingTier]) {
        return res.status(400).json({ error: "Invalid pricing tier" });
      }
      
      // Always validate item count against tier limits (new subscription, tier change, OR reactivation)
      const ingredients = await storage.getAllIngredients(userId);
      const recipes = await storage.getAllRecipes(userId);
      const itemCount = ingredients.length + recipes.length;
      const tierLimit = managedPricingTiers[requestedTier as ManagedPricingTier].maxItems;
      
      if (tierLimit !== null && itemCount > tierLimit) {
        return res.status(400).json({ 
          error: `Your business has ${itemCount} items, which exceeds the ${tierLimit} item limit for the ${managedPricingTiers[requestedTier as ManagedPricingTier].name} tier. Please select a higher tier.`
        });
      }
      
      // If user has a canceled/paused subscription, reactivate it
      if (existing) {
        const updates: Record<string, any> = {
          status: "active",
          canceledAt: null,
        };
        
        // Update tier if specified
        if (req.body.tier) {
          updates.tier = req.body.tier;
        }
        
        // Update business details if provided
        if (req.body.businessName !== undefined) updates.businessName = req.body.businessName;
        if (req.body.contactPhone !== undefined) updates.contactPhone = req.body.contactPhone;
        if (req.body.specialNotes !== undefined) updates.specialNotes = req.body.specialNotes;
        
        const reactivated = await storage.updateManagedPricingSubscription(userId, updates);
        return res.json(reactivated);
      }
      
      // Create new subscription
      const validatedData = insertManagedPricingSubscriptionSchema.parse(req.body);
      const subscription = await storage.createManagedPricingSubscription(validatedData, userId);
      res.status(201).json(subscription);
    } catch (error) {
      console.error("Create managed pricing subscription error:", error);
      res.status(400).json({ error: "Invalid subscription data" });
    }
  });

  // Update managed pricing subscription (user can update business details and tier)
  app.patch("/api/managed-pricing", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const existing = await storage.getManagedPricingSubscription(userId);
      if (!existing) {
        return res.status(404).json({ error: "No managed pricing subscription found" });
      }
      
      // Validate with partial update schema (all fields optional)
      const validatedData = updateManagedPricingSubscriptionSchema.parse(req.body);
      
      // If tier is being changed, validate against item count
      if (validatedData.tier) {
        if (!managedPricingTiers[validatedData.tier as ManagedPricingTier]) {
          return res.status(400).json({ error: "Invalid pricing tier" });
        }
        
        // Check item count against new tier
        const ingredients = await storage.getAllIngredients(userId);
        const recipes = await storage.getAllRecipes(userId);
        const itemCount = ingredients.length + recipes.length;
        const tierLimit = managedPricingTiers[validatedData.tier as ManagedPricingTier].maxItems;
        
        if (tierLimit !== null && itemCount > tierLimit) {
          return res.status(400).json({ 
            error: `Your business has ${itemCount} items, which exceeds the ${tierLimit} item limit for this tier.`
          });
        }
      }
      
      const subscription = await storage.updateManagedPricingSubscription(userId, validatedData);
      res.json(subscription);
    } catch (error) {
      console.error("Update managed pricing subscription error:", error);
      res.status(400).json({ error: "Failed to update subscription" });
    }
  });

  // Cancel managed pricing subscription
  app.delete("/api/managed-pricing", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const existing = await storage.getManagedPricingSubscription(userId);
      if (!existing) {
        return res.status(404).json({ error: "No managed pricing subscription found" });
      }
      
      if (existing.status === "canceled") {
        return res.status(400).json({ error: "Subscription is already canceled" });
      }
      
      // If there's a Stripe subscription, cancel it there too
      if (existing.stripeSubscriptionItemId) {
        try {
          const stripe = await getUncachableStripeClient();
          // Get the subscription from the item
          const subscriptionItem = await stripe.subscriptionItems.retrieve(existing.stripeSubscriptionItemId);
          await stripe.subscriptions.cancel(subscriptionItem.subscription as string);
        } catch (stripeError) {
          console.error("Stripe cancellation error:", stripeError);
          // Continue with local cancellation even if Stripe fails
        }
      }
      
      const canceled = await storage.cancelManagedPricingSubscription(userId);
      res.json(canceled);
    } catch (error) {
      console.error("Cancel managed pricing subscription error:", error);
      res.status(500).json({ error: "Failed to cancel subscription" });
    }
  });

  // Get managed pricing Stripe price IDs
  app.get("/api/managed-pricing/prices", isAuthenticated, async (req: any, res) => {
    try {
      // Load managed pricing price IDs from Stripe API
      const stripe = await getUncachableStripeClient();
      const prices = await stripe.prices.list({
        active: true,
        type: 'recurring',
        limit: 100,
      });
      
      const priceMap: Record<string, { priceId: string; amount: number }> = {};
      for (const price of prices.data) {
        if (price.nickname?.toLowerCase().startsWith('managed pricing')) {
          // Extract tier from nickname like "Managed Pricing Small" -> "small"
          const tier = price.nickname.toLowerCase().replace('managed pricing ', '').trim();
          if (['small', 'medium', 'large', 'enterprise'].includes(tier)) {
            priceMap[tier] = { priceId: price.id, amount: price.unit_amount || 0 };
          }
        }
      }
      
      res.json(priceMap);
    } catch (error) {
      console.error("Get managed pricing prices error:", error);
      res.json({}); // Return empty if prices not available
    }
  });

  // Create Stripe checkout session for managed pricing
  app.post("/api/managed-pricing/create-checkout", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { tier, businessName, contactPhone, specialNotes } = req.body;

      if (!tier) {
        return res.status(400).json({ error: "Tier is required" });
      }

      if (!managedPricingTiers[tier as ManagedPricingTier]) {
        return res.status(400).json({ error: "Invalid pricing tier" });
      }

      // Check item count against tier limit
      const ingredients = await storage.getAllIngredients(userId);
      const recipes = await storage.getAllRecipes(userId);
      const itemCount = ingredients.length + recipes.length;
      const tierLimit = managedPricingTiers[tier as ManagedPricingTier].maxItems;

      if (tierLimit !== null && itemCount > tierLimit) {
        return res.status(400).json({
          error: `Your business has ${itemCount} items, which exceeds the ${tierLimit} item limit for the ${managedPricingTiers[tier as ManagedPricingTier].name} tier.`
        });
      }

      // Check if user already has an active subscription
      const existing = await storage.getManagedPricingSubscription(userId);
      if (existing && existing.status === "active") {
        return res.status(400).json({ error: "You already have an active managed pricing subscription" });
      }

      // Get the price ID for this tier from Stripe API
      const stripe = await getUncachableStripeClient();
      const prices = await stripe.prices.list({
        active: true,
        type: 'recurring',
        limit: 100,
      });
      
      const tierNickname = `Managed Pricing ${tier.charAt(0).toUpperCase() + tier.slice(1)}`.toLowerCase();
      const matchingPrice = prices.data.find(p => 
        p.nickname?.toLowerCase() === tierNickname
      );

      if (!matchingPrice) {
        return res.status(400).json({ error: "Stripe pricing not available for this tier. Please contact support." });
      }

      const priceId = matchingPrice.id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      let customerId = user.stripeCustomerId;

      // Create Stripe customer if needed
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          metadata: { userId },
        });
        customerId = customer.id;
        await storage.updateUserStripeInfo(userId, { stripeCustomerId: customerId });
      }

      const baseUrl = process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.REPLIT_DOMAINS?.split(',')[0]
          ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
          : 'http://localhost:5000';

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${baseUrl}/settings?tab=billing&managed_pricing_status=success`,
        cancel_url: `${baseUrl}/settings?tab=billing&managed_pricing_status=canceled`,
        metadata: {
          userId,
          tier,
          addon_type: 'managed_pricing',
          businessName: businessName || '',
          contactPhone: contactPhone || '',
          specialNotes: specialNotes || '',
        },
        subscription_data: {
          metadata: {
            userId,
            tier,
            addon_type: 'managed_pricing',
          },
        },
      });

      res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
      console.error("Create managed pricing checkout error:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  // Handle Stripe webhook for managed pricing subscriptions
  app.post("/api/managed-pricing/webhook", async (req: any, res) => {
    try {
      const event = req.body;

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const metadata = session.metadata;

        if (metadata?.addon_type === 'managed_pricing') {
          const userId = metadata.userId;
          const tier = metadata.tier;

          // Create the managed pricing subscription in our database
          const existing = await storage.getManagedPricingSubscription(userId);
          
          if (existing) {
            // Reactivate existing subscription
            await storage.updateManagedPricingSubscription(userId, {
              status: 'active',
              tier,
              stripeSubscriptionItemId: session.subscription,
              businessName: metadata.businessName || existing.businessName,
              contactPhone: metadata.contactPhone || existing.contactPhone,
              specialNotes: metadata.specialNotes || existing.specialNotes,
            });
          } else {
            // Create new subscription
            await storage.createManagedPricingSubscription({
              tier,
              businessName: metadata.businessName || null,
              contactPhone: metadata.contactPhone || null,
              specialNotes: metadata.specialNotes || null,
            }, userId);

            // Update with Stripe subscription ID
            await storage.updateManagedPricingSubscription(userId, {
              stripeSubscriptionItemId: session.subscription,
            });
          }
        }
      } else if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        
        // Check if this is a managed pricing subscription
        if (subscription.metadata?.addon_type === 'managed_pricing') {
          const userId = subscription.metadata.userId;
          if (userId) {
            await storage.cancelManagedPricingSubscription(userId);
          }
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Managed pricing webhook error:", error);
      res.status(400).json({ error: "Webhook error" });
    }
  });

  // Admin middleware helper
  const isAdmin = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      next();
    } catch (error) {
      res.status(500).json({ error: "Authorization error" });
    }
  };

  // Admin: Get all managed pricing subscriptions
  app.get("/api/admin/managed-pricing", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const subscriptions = await storage.getAllManagedPricingSubscriptions();
      
      // Enrich with item counts and tier details
      const enriched = await Promise.all(
        subscriptions.map(async (sub) => {
          const ingredients = await storage.getAllIngredients(sub.userId);
          const recipes = await storage.getAllRecipes(sub.userId);
          let tierDetails = null;
          if (sub.tier === "small") tierDetails = managedPricingTiers.small;
          else if (sub.tier === "medium") tierDetails = managedPricingTiers.medium;
          else if (sub.tier === "large") tierDetails = managedPricingTiers.large;
          else if (sub.tier === "enterprise") tierDetails = managedPricingTiers.enterprise;
          
          return {
            ...sub,
            currentItemCount: ingredients.length + recipes.length,
            tierDetails,
          };
        })
      );
      
      res.json(enriched);
    } catch (error) {
      console.error("Admin get managed pricing subscriptions error:", error);
      res.status(500).json({ error: "Failed to fetch subscriptions" });
    }
  });

  // Admin: Update managed pricing subscription service tracking
  app.patch("/api/admin/managed-pricing/:userId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const targetUserId = req.params.userId;
      
      const existing = await storage.getManagedPricingSubscription(targetUserId);
      if (!existing) {
        return res.status(404).json({ error: "Subscription not found" });
      }
      
      // Admin can update service tracking fields
      const allowedFields = ["lastPriceUpdateAt", "nextScheduledUpdate", "status", "specialNotes"];
      const updates: Record<string, any> = {};
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          // Convert date strings to Date objects
          if ((field === "lastPriceUpdateAt" || field === "nextScheduledUpdate") && req.body[field]) {
            updates[field] = new Date(req.body[field]);
          } else {
            updates[field] = req.body[field];
          }
        }
      }
      
      const subscription = await storage.updateManagedPricingSubscription(targetUserId, updates);
      res.json(subscription);
    } catch (error) {
      console.error("Admin update managed pricing subscription error:", error);
      res.status(400).json({ error: "Failed to update subscription" });
    }
  });

  // Admin: Get user's ingredient and recipe data (for price management)
  app.get("/api/admin/managed-pricing/:userId/data", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const targetUserId = req.params.userId;
      
      const subscription = await storage.getManagedPricingSubscription(targetUserId);
      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }
      
      const ingredients = await storage.getAllIngredients(targetUserId);
      const recipes = await storage.getAllRecipesWithIngredients(targetUserId);
      const user = await storage.getUser(targetUserId);
      
      res.json({
        subscription,
        user: {
          id: user?.id,
          email: user?.email,
          firstName: user?.firstName,
          lastName: user?.lastName,
        },
        ingredients,
        recipes,
      });
    } catch (error) {
      console.error("Admin get managed pricing data error:", error);
      res.status(500).json({ error: "Failed to fetch user data" });
    }
  });

  // ============================================================
  // EXPORT / IMPORT - Complete Data Backup & Restore
  // ============================================================

  // Export all user data as JSON for backup/migration
  app.get("/api/export", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Gather all user data
      const [
        ingredients,
        recipes,
        categoryPricingSettings,
        aiSettings,
        dashboardConfigs,
        wasteLogs,
        inventoryCounts,
        pricingSnapshots,
      ] = await Promise.all([
        storage.getAllIngredients(userId),
        storage.getAllRecipesWithIngredients(userId),
        storage.getCategoryPricingSettings(userId),
        storage.getAISettings(userId),
        storage.getDashboardConfigs(userId),
        storage.getWasteLogs(userId),
        storage.getInventoryCounts(userId),
        storage.getPricingSnapshots(userId),
      ]);

      // Format export data with version for future compatibility
      const exportData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        data: {
          ingredients: ingredients.map(({ id, userId: uid, ...rest }) => ({ 
            exportId: id,
            ...rest 
          })),
          recipes: recipes.map(({ id, userId: uid, createdAt, ...rest }) => ({
            exportId: id,
            ...rest,
            ingredients: rest.ingredients?.map((ri: any) => ({
              exportIngredientId: ri.ingredientId,
              quantity: ri.quantity,
              unit: ri.unit,
            })) || [],
            subRecipes: rest.subRecipes?.map((sr: any) => ({
              exportSubRecipeId: sr.subRecipeId,
              servings: sr.servings,
            })) || [],
          })),
          categoryPricingSettings: categoryPricingSettings.map(({ id, userId: uid, updatedAt, ...rest }) => rest),
          aiSettings: aiSettings ? { 
            aiProvider: aiSettings.aiProvider,
          } : null,
          dashboardConfigs: dashboardConfigs.map(({ id, userId: uid, createdAt, updatedAt, ...rest }) => rest),
          wasteLogs: wasteLogs.map(({ id, userId: uid, ingredientId, ...rest }) => ({
            exportIngredientId: ingredientId,
            ...rest,
          })),
          inventoryCounts: inventoryCounts.map(({ id, userId: uid, ingredientId, ...rest }) => ({
            exportIngredientId: ingredientId,
            ...rest,
          })),
          pricingSnapshots: pricingSnapshots.map(({ id, userId: uid, createdAt, ...rest }) => rest),
        }
      };

      // Set headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=foodcost-backup-${new Date().toISOString().split('T')[0]}.json`);
      res.json(exportData);
    } catch (error) {
      console.error("Export data error:", error);
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  // Import data from backup file
  app.post("/api/import", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { data, options = {} } = req.body;
      const { clearExisting = false } = options;

      if (!data || !data.version) {
        return res.status(400).json({ error: "Invalid import data format" });
      }

      // Validate version compatibility
      const supportedVersions = ["1.0"];
      if (!supportedVersions.includes(data.version)) {
        return res.status(400).json({ error: `Unsupported export version: ${data.version}` });
      }

      const importData = data.data;
      const stats = {
        ingredients: 0,
        recipes: 0,
        categoryPricingSettings: 0,
        dashboardConfigs: 0,
        wasteLogs: 0,
        inventoryCounts: 0,
        pricingSnapshots: 0,
        skipped: 0,
      };

      // ID mapping: old export IDs -> new database IDs
      const ingredientIdMap = new Map<string, string>();
      const recipeIdMap = new Map<string, string>();

      // If clearing existing data, delete in reverse order of dependencies
      if (clearExisting) {
        // Delete user's existing data
        const existingRecipes = await storage.getAllRecipes(userId);
        for (const recipe of existingRecipes) {
          await storage.deleteRecipe(recipe.id, userId);
        }
        const existingIngredients = await storage.getAllIngredients(userId);
        for (const ingredient of existingIngredients) {
          await storage.deleteIngredient(ingredient.id, userId);
        }
      }

      // 1. Import ingredients first (they're referenced by recipes)
      if (importData.ingredients && Array.isArray(importData.ingredients)) {
        for (const ing of importData.ingredients) {
          const { exportId, ...ingData } = ing;
          try {
            // Remove any base ingredient reference temporarily (will fix in second pass)
            const { additionBaseIngredientId, ...cleanData } = ingData;
            const created = await storage.createIngredient(cleanData, userId);
            ingredientIdMap.set(exportId, created.id);
            stats.ingredients++;
          } catch (e) {
            console.error("Failed to import ingredient:", e);
            stats.skipped++;
          }
        }

        // Second pass: fix base ingredient references
        for (const ing of importData.ingredients) {
          if (ing.additionBaseIngredientId && ingredientIdMap.has(ing.additionBaseIngredientId)) {
            const newId = ingredientIdMap.get(ing.exportId);
            const newBaseId = ingredientIdMap.get(ing.additionBaseIngredientId);
            if (newId && newBaseId) {
              try {
                await storage.updateIngredient(newId, { additionBaseIngredientId: newBaseId }, userId);
              } catch (e) {
                console.error("Failed to update base ingredient reference:", e);
              }
            }
          }
        }
      }

      // 2. Import recipes (without sub-recipes first)
      if (importData.recipes && Array.isArray(importData.recipes)) {
        for (const recipe of importData.recipes) {
          const { exportId, ingredients: recipeIngredients, subRecipes, ...recipeData } = recipe;
          try {
            // Map ingredient IDs to new IDs
            const mappedIngredients = (recipeIngredients || [])
              .filter((ri: any) => ingredientIdMap.has(ri.exportIngredientId))
              .map((ri: any) => ({
                ingredientId: ingredientIdMap.get(ri.exportIngredientId)!,
                quantity: ri.quantity,
                unit: ri.unit,
              }));

            const created = await storage.createRecipe({
              ...recipeData,
              ingredients: mappedIngredients,
              subRecipes: [], // Will add in second pass
            }, userId);
            recipeIdMap.set(exportId, created.id);
            stats.recipes++;
          } catch (e) {
            console.error("Failed to import recipe:", e);
            stats.skipped++;
          }
        }

        // Second pass: add sub-recipe relationships
        for (const recipe of importData.recipes) {
          if (recipe.subRecipes && recipe.subRecipes.length > 0) {
            const newRecipeId = recipeIdMap.get(recipe.exportId);
            if (newRecipeId) {
              for (const sr of recipe.subRecipes) {
                const newSubRecipeId = recipeIdMap.get(sr.exportSubRecipeId);
                if (newSubRecipeId) {
                  try {
                    await storage.addSubRecipeToRecipe(newRecipeId, {
                      subRecipeId: newSubRecipeId,
                      servings: sr.servings,
                    }, userId);
                  } catch (e) {
                    console.error("Failed to add sub-recipe:", e);
                  }
                }
              }
            }
          }
        }
      }

      // 3. Import category pricing settings
      if (importData.categoryPricingSettings && Array.isArray(importData.categoryPricingSettings)) {
        for (const setting of importData.categoryPricingSettings) {
          try {
            await storage.upsertCategoryPricingSetting(setting, userId);
            stats.categoryPricingSettings++;
          } catch (e) {
            console.error("Failed to import category pricing setting:", e);
            stats.skipped++;
          }
        }
      }

      // 4. Import AI settings
      if (importData.aiSettings) {
        try {
          await storage.upsertAISettings(importData.aiSettings, userId);
        } catch (e) {
          console.error("Failed to import AI settings:", e);
        }
      }

      // 5. Import dashboard configs
      if (importData.dashboardConfigs && Array.isArray(importData.dashboardConfigs)) {
        // Clear existing dashboard configs first for clean import
        const existingConfigs = await storage.getDashboardConfigs(userId);
        for (const config of existingConfigs) {
          await storage.deleteDashboardConfig(config.id, userId);
        }
        
        for (const config of importData.dashboardConfigs) {
          try {
            await storage.createDashboardConfig(config, userId);
            stats.dashboardConfigs++;
          } catch (e) {
            console.error("Failed to import dashboard config:", e);
            stats.skipped++;
          }
        }
      }

      // 6. Import waste logs (only if ingredients were imported)
      if (importData.wasteLogs && Array.isArray(importData.wasteLogs)) {
        for (const log of importData.wasteLogs) {
          const { exportIngredientId, ...logData } = log;
          const newIngredientId = ingredientIdMap.get(exportIngredientId);
          if (newIngredientId) {
            try {
              await storage.createWasteLog({
                ...logData,
                ingredientId: newIngredientId,
              }, userId);
              stats.wasteLogs++;
            } catch (e) {
              console.error("Failed to import waste log:", e);
              stats.skipped++;
            }
          }
        }
      }

      // 7. Import inventory counts
      if (importData.inventoryCounts && Array.isArray(importData.inventoryCounts)) {
        for (const count of importData.inventoryCounts) {
          const { exportIngredientId, ...countData } = count;
          const newIngredientId = ingredientIdMap.get(exportIngredientId);
          if (newIngredientId) {
            try {
              await storage.createInventoryCount({
                ...countData,
                ingredientId: newIngredientId,
              }, userId);
              stats.inventoryCounts++;
            } catch (e) {
              console.error("Failed to import inventory count:", e);
              stats.skipped++;
            }
          }
        }
      }

      // 8. Import pricing snapshots (need to remap recipe IDs in the data)
      if (importData.pricingSnapshots && Array.isArray(importData.pricingSnapshots)) {
        for (const snapshot of importData.pricingSnapshots) {
          try {
            // Remap recipe IDs in the pricing data
            const mappedRecipePricing = (snapshot.recipePricing || [])
              .filter((rp: any) => recipeIdMap.has(rp.recipeId))
              .map((rp: any) => ({
                ...rp,
                recipeId: recipeIdMap.get(rp.recipeId)!,
              }));

            await storage.createPricingSnapshot({
              name: snapshot.name,
              recipePricing: mappedRecipePricing,
              categorySettings: snapshot.categorySettings || [],
            }, userId);
            stats.pricingSnapshots++;
          } catch (e) {
            console.error("Failed to import pricing snapshot:", e);
            stats.skipped++;
          }
        }
      }

      res.json({
        success: true,
        message: "Import completed successfully",
        stats,
      });
    } catch (error) {
      console.error("Import data error:", error);
      res.status(500).json({ error: "Failed to import data" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
