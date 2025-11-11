import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as XLSX from "xlsx";
import { storage } from "./storage";
import { insertIngredientSchema, insertRecipeSchema, insertRecipeIngredientSchema, measurementUnits } from "@shared/schema";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
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

      let imported = 0;
      for (const row of data) {
        try {
          const rowData = row as any;
          const ingredient = insertIngredientSchema.parse({
            name: rowData[mapping.name] || rowData.name || rowData.Name || rowData.Ingredient,
            category: rowData[mapping.category] || rowData.category || rowData.Category || "General",
            quantity: parseFloat(rowData[mapping.quantity] || rowData.quantity || rowData.Quantity || "1"),
            unit: rowData[mapping.unit] || rowData.unit || rowData.Unit || "units",
            costPerUnit: parseFloat(rowData[mapping.costPerUnit] || rowData.costPerUnit || rowData["Cost Per Unit"] || rowData.cost || "0"),
          });
          await storage.createIngredient(ingredient);
          imported++;
        } catch (error) {
          console.error("Failed to import row:", row, error);
        }
      }

      res.json({ count: imported, message: `Imported ${imported} ingredients` });
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
