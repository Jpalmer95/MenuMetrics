import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as XLSX from "xlsx";
import { storage } from "./storage";
import { insertIngredientSchema, insertRecipeSchema, insertRecipeIngredientSchema, measurementUnits } from "@shared/schema";
import { parseQuantityUnit, normalizeUnit } from "@shared/unit-parser";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  // Excel template download
  app.get("/api/ingredients/template", async (req, res) => {
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

  app.get("/api/ingredients", async (req, res) => {
    try {
      const ingredients = await storage.getAllIngredients();
      res.json(ingredients);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ingredients" });
    }
  });

  app.get("/api/ingredients/:id", async (req, res) => {
    try {
      const ingredient = await storage.getIngredient(req.params.id);
      if (!ingredient) {
        return res.status(404).json({ error: "Ingredient not found" });
      }
      res.json(ingredient);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ingredient" });
    }
  });

  app.post("/api/ingredients", async (req, res) => {
    try {
      const validatedData = insertIngredientSchema.parse(req.body);
      const ingredient = await storage.createIngredient(validatedData);
      res.status(201).json(ingredient);
    } catch (error) {
      res.status(400).json({ error: "Invalid ingredient data" });
    }
  });

  app.patch("/api/ingredients/:id", async (req, res) => {
    try {
      const validatedData = insertIngredientSchema.parse(req.body);
      const ingredient = await storage.updateIngredient(req.params.id, validatedData);
      if (!ingredient) {
        return res.status(404).json({ error: "Ingredient not found" });
      }
      res.json(ingredient);
    } catch (error) {
      res.status(400).json({ error: "Invalid ingredient data" });
    }
  });

  app.delete("/api/ingredients/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteIngredient(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Ingredient not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete ingredient" });
    }
  });

  app.post("/api/ingredients/import", upload.single("file"), async (req: Request, res) => {
    try {
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
          
          const created = await storage.createIngredient(ingredient);
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

  app.get("/api/recipes", async (req, res) => {
    try {
      const recipes = await storage.getAllRecipes();
      res.json(recipes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recipes" });
    }
  });

  app.get("/api/recipes/:id", async (req, res) => {
    try {
      const recipe = await storage.getRecipeWithIngredients(req.params.id);
      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      res.json(recipe);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recipe" });
    }
  });

  app.post("/api/recipes", async (req, res) => {
    try {
      const validatedData = insertRecipeSchema.parse(req.body);
      const recipe = await storage.createRecipe(validatedData);
      res.status(201).json(recipe);
    } catch (error) {
      res.status(400).json({ error: "Invalid recipe data" });
    }
  });

  app.patch("/api/recipes/:id", async (req, res) => {
    try {
      const validatedData = insertRecipeSchema.parse(req.body);
      const recipe = await storage.updateRecipe(req.params.id, validatedData);
      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      res.json(recipe);
    } catch (error) {
      res.status(400).json({ error: "Invalid recipe data" });
    }
  });

  app.delete("/api/recipes/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteRecipe(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete recipe" });
    }
  });

  app.post("/api/recipes/:id/ingredients", async (req, res) => {
    try {
      const validatedData = insertRecipeIngredientSchema.parse(req.body);
      const recipeIngredient = await storage.createRecipeIngredient(validatedData);
      res.status(201).json(recipeIngredient);
    } catch (error) {
      res.status(400).json({ error: "Invalid recipe ingredient data" });
    }
  });

  app.patch("/api/recipes/:recipeId/ingredients/:id", async (req, res) => {
    try {
      const { quantity } = req.body;
      if (typeof quantity !== "number" || quantity <= 0) {
        return res.status(400).json({ error: "Invalid quantity" });
      }
      const recipeIngredient = await storage.updateRecipeIngredientQuantity(req.params.id, quantity);
      if (!recipeIngredient) {
        return res.status(404).json({ error: "Recipe ingredient not found" });
      }
      res.json(recipeIngredient);
    } catch (error) {
      res.status(500).json({ error: "Failed to update recipe ingredient" });
    }
  });

  app.delete("/api/recipes/:recipeId/ingredients/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteRecipeIngredient(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Recipe ingredient not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete recipe ingredient" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
