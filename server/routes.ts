import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as XLSX from "xlsx";
import { storage } from "./storage";
import { insertIngredientSchema, insertRecipeSchema, insertRecipeIngredientSchema, insertAISettingsSchema, measurementUnits } from "@shared/schema";
import { parseQuantityUnit, normalizeUnit } from "@shared/unit-parser";
import { callAI, type AIProvider } from "./ai-providers";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { findBestMatch } from "@shared/fuzzy-matcher";
import type { Ingredient } from "@shared/schema";

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
      // Create template with headers and sample data
      const headers = [
        "Ingredient Name",
        "Category",
        "Purchase Quantity",
        "Purchase Unit",
        "Purchase Cost",
        "Store (optional)",
        "Density g/mL (optional)",
        "Density Source (optional)",
        "Packaging? (Yes/No)"
      ];
      
      const sampleRow = [
        "Espresso Beans",
        "Coffee",
        1,
        "pounds",
        9.90,
        "Numinous",
        "",
        "",
        "No"
      ];
      
      const instructions = [
        "INSTRUCTIONS:",
        "1. Fill in your ingredient data starting from row 4",
        "2. Required columns: Ingredient Name, Category, Purchase Quantity, Purchase Unit, Purchase Cost",
        "3. Units must be one of: " + measurementUnits.join(", "),
        "4. Density is optional but helps with volume↔weight conversions (e.g., 1.03 for milk, 0.5 for flour)",
        "5. Mark 'Yes' for Packaging column if item is packaging (cups, lids, etc.)",
        "6. Delete this instructions row before uploading"
      ];
      
      const worksheet = XLSX.utils.aoa_to_sheet([
        instructions,
        [], // Empty row
        headers,
        sampleRow
      ]);
      
      // Set column widths
      worksheet['!cols'] = [
        { wch: 20 }, // Ingredient Name
        { wch: 15 }, // Category
        { wch: 18 }, // Purchase Quantity
        { wch: 15 }, // Purchase Unit
        { wch: 15 }, // Purchase Cost
        { wch: 15 }, // Store
        { wch: 18 }, // Density
        { wch: 18 }, // Density Source
        { wch: 18 }  // Packaging
      ];
      
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Ingredients");
      
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      
      res.setHeader("Content-Disposition", "attachment; filename=ingredient-template.xlsx");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.send(buffer);
    } catch (error) {
      console.error("Template generation error:", error);
      res.status(500).json({ error: "Failed to generate template" });
    }
  });

  app.get("/api/ingredients/export", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const ingredients = await storage.getAllIngredients(userId);
      
      // Map ingredients to export format
      const headers = [
        "Ingredient Name",
        "Category",
        "Purchase Quantity",
        "Purchase Unit",
        "Purchase Cost",
        "Store (optional)",
        "Density g/mL (optional)",
        "Density Source (optional)",
        "Packaging? (Yes/No)"
      ];
      
      const rows = ingredients.map(ing => [
        ing.name,
        ing.category,
        ing.purchaseQuantity,
        ing.purchaseUnit,
        ing.purchaseCost,
        ing.store || "",
        ing.gramsPerMilliliter || "",
        ing.densitySource || "",
        ing.isPackaging ? "Yes" : "No"
      ]);
      
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      
      // Set column widths
      worksheet['!cols'] = [
        { wch: 20 }, // Ingredient Name
        { wch: 15 }, // Category
        { wch: 18 }, // Purchase Quantity
        { wch: 15 }, // Purchase Unit
        { wch: 15 }, // Purchase Cost
        { wch: 15 }, // Store
        { wch: 18 }, // Density
        { wch: 18 }, // Density Source
        { wch: 18 }  // Packaging
      ];
      
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Ingredients");
      
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      
      const timestamp = new Date().toISOString().split('T')[0];
      res.setHeader("Content-Disposition", `attachment; filename=ingredients-export-${timestamp}.xlsx`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.send(buffer);
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ error: "Failed to export ingredients" });
    }
  });

  app.get("/api/recipes/export", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recipes = await storage.getAllRecipes(userId);
      
      // Map recipes to export format (one row per ingredient)
      const headers = [
        "Recipe Name",
        "Category",
        "Serving Size",
        "Menu Price",
        "Description",
        "Ingredient Name",
        "Quantity",
        "Unit"
      ];
      
      const rows: any[] = [];
      
      for (const recipe of recipes) {
        const recipeIngredients = await storage.getRecipeIngredients(recipe.id, userId);
        
        if (recipeIngredients.length === 0) {
          // Recipe with no ingredients - still export it
          rows.push([
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
          // One row per ingredient
          for (const ri of recipeIngredients) {
            rows.push([
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
      
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      
      // Set column widths
      worksheet['!cols'] = [
        { wch: 25 }, // Recipe Name
        { wch: 15 }, // Category
        { wch: 15 }, // Serving Size
        { wch: 12 }, // Menu Price
        { wch: 30 }, // Description
        { wch: 25 }, // Ingredient Name
        { wch: 10 }, // Quantity
        { wch: 12 }  // Unit
      ];
      
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Recipes");
      
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      
      const timestamp = new Date().toISOString().split('T')[0];
      res.setHeader("Content-Disposition", `attachment; filename=recipes-export-${timestamp}.xlsx`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.send(buffer);
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
      
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

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
          
          // Parse density if provided
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

      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

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
      const validatedData = insertRecipeIngredientSchema.parse(req.body);
      const recipeIngredient = await storage.createRecipeIngredient(validatedData, userId);
      res.status(201).json(recipeIngredient);
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
      res.json(recipeIngredient);
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
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete recipe ingredient" });
    }
  });

  // AI Agent endpoints
  app.post("/api/ai/recipe-ideas", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { customPrompt } = req.body;
      
      // Get AI provider settings from database
      const settings = await storage.getAISettings(userId);
      const provider = (settings?.aiProvider || "openai") as AIProvider;
      const customApiKey = settings?.huggingfaceToken || undefined;

      // Get all ingredients for context
      const ingredients = await storage.getAllIngredients(userId);
      
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
  "ingredients": [
    {
      "ingredientName": "Exact ingredient name from the list above",
      "quantity": 2,
      "unit": "one of: cups, ounces, grams, units, teaspoons, tablespoons, pounds, kilograms, milliliters, liters, pints, quarts, gallons"
    }
  ]
}

CRITICAL: Only use ingredients from the available ingredients list above. Match ingredient names exactly. Return ONLY valid JSON, no markdown code blocks or explanations.`;

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

  // Create recipe from AI suggestion
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
  app.post("/api/ai/parse-recipe", upload.single("image"), isAuthenticated, async (req: any, res) => {
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

  app.post("/api/ai/menu-strategy", isAuthenticated, async (req: any, res) => {
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

  // AI-powered density estimation for ingredients
  app.post("/api/ingredients/estimate-densities", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get AI provider settings
      const settings = await storage.getAISettings(userId);
      const provider = (settings?.aiProvider || "openai") as AIProvider;
      const customApiKey = settings?.huggingfaceToken || undefined;

      // Get all user's ingredients
      const allIngredients = await storage.getAllIngredients(userId);
      
      // Filter for ingredients missing density (and exclude packaging)
      const needsDensity = allIngredients.filter(ing => 
        !ing.gramsPerMilliliter && !ing.isPackaging
      );

      if (needsDensity.length === 0) {
        return res.json({ 
          message: "All ingredients already have density values!",
          updated: 0,
          total: allIngredients.length
        });
      }

      // Prepare ingredient list for AI
      const ingredientList = needsDensity
        .map(ing => `${ing.name} (${ing.category})`)
        .join("\n");

      const systemPrompt = `You are a food science expert specializing in ingredient densities and measurements. Your task is to estimate accurate density values (grams per milliliter) for common food and beverage ingredients.`;

      const prompt = `Estimate the density (grams per milliliter) for each of these ingredients. Use standard food science references and common knowledge about ingredient densities.

Ingredients:
${ingredientList}

IMPORTANT: Return ONLY a valid JSON array with this exact structure, no other text:
[
  {
    "name": "exact ingredient name from list",
    "gramsPerMilliliter": 1.03,
    "reasoning": "brief explanation"
  }
]

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

      const response = await callAI({
        provider,
        prompt,
        systemPrompt,
        customApiKey,
      });

      // Parse AI response
      let cleanResponse = response.trim();
      
      // Remove markdown code blocks
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```\n?/g, '').trim();
      }
      
      const densityEstimates = JSON.parse(cleanResponse);
      
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
          // Update ingredient with new density (preserve all other fields)
          await storage.updateIngredient(ingredient.id, {
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
          
          updatedCount++;
          results.push({
            name: ingredient.name,
            density: estimate.gramsPerMilliliter,
            reasoning: estimate.reasoning
          });
        }
      }

      res.json({
        message: `Successfully estimated densities for ${updatedCount} ingredients`,
        updated: updatedCount,
        total: needsDensity.length,
        results
      });

    } catch (error: any) {
      console.error("Density estimation error:", error);
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

  const httpServer = createServer(app);

  return httpServer;
}
