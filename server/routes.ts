import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as XLSX from "xlsx";
import { storage } from "./storage";
import { insertIngredientSchema, insertRecipeSchema, insertRecipeIngredientSchema, insertAISettingsSchema, measurementUnits } from "@shared/schema";
import { parseQuantityUnit, normalizeUnit } from "@shared/unit-parser";
import { callAI, type AIProvider } from "./ai-providers";

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

  app.get("/api/ingredients/export", async (req, res) => {
    try {
      const ingredients = await storage.getAllIngredients();
      
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

  // AI Agent endpoints
  app.post("/api/ai/recipe-ideas", async (req, res) => {
    try {
      const { customPrompt } = req.body;
      
      // Get AI provider settings from database
      const settings = await storage.getAISettings();
      const provider = (settings?.aiProvider || "openai") as AIProvider;
      const customApiKey = settings?.huggingfaceToken || undefined;

      // Get all ingredients for context
      const ingredients = await storage.getAllIngredients();
      
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
  app.post("/api/ai/create-recipe", async (req, res) => {
    try {
      const { name, description, category, servings, ingredients: suggestedIngredients } = req.body;

      if (!name || !category || !servings || !Array.isArray(suggestedIngredients)) {
        return res.status(400).json({ error: "Invalid recipe data" });
      }

      // Get all ingredients to match names
      const allIngredients = await storage.getAllIngredients();
      const ingredientMap = new Map(allIngredients.map(ing => [ing.name.toLowerCase().trim(), ing]));

      // Create the recipe first
      const recipe = await storage.createRecipe({
        name,
        description: description || "",
        category,
        servings,
      });

      // Add ingredients to the recipe
      for (const suggestedIng of suggestedIngredients) {
        const matchedIngredient = ingredientMap.get(suggestedIng.ingredientName.toLowerCase().trim());
        
        if (matchedIngredient) {
          await storage.createRecipeIngredient({
            recipeId: recipe.id,
            ingredientId: matchedIngredient.id,
            quantity: suggestedIng.quantity,
            unit: suggestedIng.unit,
          });
        } else {
          console.warn(`Ingredient not found: ${suggestedIng.ingredientName}`);
        }
      }

      // Fetch complete recipe with ingredients
      const completeRecipe = await storage.getRecipeWithIngredients(recipe.id);
      res.status(201).json(completeRecipe);
    } catch (error: any) {
      console.error("Create recipe from AI error:", error);
      res.status(500).json({ error: error.message || "Failed to create recipe" });
    }
  });

  // AI Recipe Parser - accepts text or image
  app.post("/api/ai/parse-recipe", upload.single("image"), async (req, res) => {
    try {
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
      const settings = await storage.getAISettings();
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

  app.post("/api/ai/menu-strategy", async (req, res) => {
    try {
      const { customPrompt } = req.body;
      
      // Get AI provider settings from database
      const settings = await storage.getAISettings();
      const provider = (settings?.aiProvider || "openai") as AIProvider;
      const customApiKey = settings?.huggingfaceToken || undefined;

      // Get all recipes for context
      const recipes = await storage.getAllRecipes();
      
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

  // AI Settings endpoints
  app.get("/api/settings/ai", async (req, res) => {
    try {
      const settings = await storage.getAISettings();
      res.json(settings);
    } catch (error: any) {
      console.error("Get AI settings error:", error);
      res.status(500).json({ error: "Failed to retrieve AI settings" });
    }
  });

  app.post("/api/settings/ai", async (req, res) => {
    try {
      const validatedData = insertAISettingsSchema.parse(req.body);
      const updated = await storage.saveAISettings(validatedData);
      res.json(updated);
    } catch (error: any) {
      console.error("Save AI settings error:", error);
      res.status(400).json({ error: error.message || "Failed to save AI settings" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
