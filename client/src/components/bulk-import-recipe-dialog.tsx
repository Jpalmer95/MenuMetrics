import { useState } from "react";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, FileJson, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

interface BulkImportRecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export function BulkImportRecipeDialog({
  open,
  onOpenChange,
  onImportComplete,
}: BulkImportRecipeDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [jsonInput, setJsonInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [activeTab, setActiveTab] = useState("file");
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    message: string;
    errors?: Array<{ recipe: string; error: string }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/recipes/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to import recipes");
      }

      const data = await response.json();
      setResult(data);
      
      if (data.imported > 0) {
        onImportComplete();
      }
      
      if (data.imported > 0 && (!data.errors || data.errors.length === 0)) {
        handleClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import recipes");
    } finally {
      setIsUploading(false);
    }
  };

  const handleJsonImport = async () => {
    setIsUploading(true);
    setError(null);
    setResult(null);

    try {
      let recipes;
      try {
        recipes = JSON.parse(jsonInput);
      } catch (err) {
        throw new Error("Invalid JSON format. Please check your syntax.");
      }

      const response = await fetch("/api/recipes/import-json", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recipes: Array.isArray(recipes) ? recipes : [recipes] }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to import recipes");
      }

      const data = await response.json();
      setResult(data);
      
      if (data.imported > 0) {
        onImportComplete();
      }
      
      if (data.imported > 0 && (!data.errors || data.errors.length === 0)) {
        handleClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import recipes");
    } finally {
      setIsUploading(false);
    }
  };

  const handleTextImport = async () => {
    setIsUploading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/recipes/import-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: textInput }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to import recipes");
      }

      const data = await response.json();
      setResult(data);
      
      if (data.imported > 0) {
        onImportComplete();
      }
      
      if (data.imported > 0 && (!data.errors || data.errors.length === 0)) {
        handleClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import recipes");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setJsonInput("");
    setTextInput("");
    setResult(null);
    setError(null);
    onOpenChange(false);
  };

  const getImportHandler = () => {
    switch (activeTab) {
      case "file":
        return handleUpload;
      case "json":
        return handleJsonImport;
      case "text":
        return handleTextImport;
      default:
        return handleUpload;
    }
  };

  const isImportDisabled = () => {
    if (isUploading) return true;
    switch (activeTab) {
      case "file":
        return !file;
      case "json":
        return !jsonInput.trim();
      case "text":
        return !textInput.trim();
      default:
        return true;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Recipes</DialogTitle>
          <DialogDescription>
            Import multiple recipes from Excel, JSON, or text
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="file" data-testid="tab-file">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel/CSV
            </TabsTrigger>
            <TabsTrigger value="json" data-testid="tab-json">
              <FileJson className="h-4 w-4 mr-2" />
              JSON
            </TabsTrigger>
            <TabsTrigger value="text" data-testid="tab-text">
              <FileText className="h-4 w-4 mr-2" />
              AI Text
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 space-y-4">
            <TabsContent value="file" className="space-y-4">
              <Alert>
                <FileSpreadsheet className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">File Format (one row per ingredient):</p>
                    <ul className="text-sm space-y-1 ml-4 list-disc">
                      <li><strong>Recipe Name</strong> - Name of the recipe (repeat for each ingredient)</li>
                      <li><strong>Category</strong> - beverages, pastries, sandwiches, etc.</li>
                      <li><strong>Serving Size</strong> - Number of servings</li>
                      <li><strong>Menu Price</strong> - Optional selling price</li>
                      <li><strong>Ingredient Name</strong> - Must match existing ingredient</li>
                      <li><strong>Quantity</strong> - Amount of ingredient</li>
                      <li><strong>Unit</strong> - cups, oz, grams, etc.</li>
                    </ul>
                    <p className="text-sm text-muted-foreground mt-2">
                      Tip: Export your current recipes to see the correct format
                    </p>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <label
                  htmlFor="file-upload"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover-elevate bg-card"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="h-10 w-10 mb-2 text-muted-foreground" />
                    <p className="mb-1 text-sm text-muted-foreground">
                      {file ? file.name : "Click to upload or drag and drop"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Excel (.xlsx) or CSV files
                    </p>
                  </div>
                  <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    data-testid="input-file-upload"
                  />
                </label>
              </div>
            </TabsContent>

            <TabsContent value="json" className="space-y-4">
              <Alert>
                <FileJson className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">JSON Format:</p>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
{`[
  {
    "name": "Latte",
    "category": "beverage",
    "servings": 1,
    "menuPrice": 5.50,
    "ingredients": [
      { "name": "Espresso", "quantity": 2, "unit": "oz" },
      { "name": "Milk", "quantity": 8, "unit": "oz" }
    ]
  }
]`}
                    </pre>
                    <p className="text-sm text-muted-foreground">
                      Paste a JSON array of recipes with ingredients
                    </p>
                  </div>
                </AlertDescription>
              </Alert>

              <Textarea
                placeholder="Paste your JSON here..."
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
                data-testid="textarea-json-input"
              />
            </TabsContent>

            <TabsContent value="text" className="space-y-4">
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">AI-Powered Text Parsing:</p>
                    <p className="text-sm">
                      Paste recipes in any format (markdown, plain text, etc.). AI will parse and structure them automatically.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Note: Only ingredients in your inventory will be imported. Uses your configured AI provider.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>

              <Textarea
                placeholder="Paste your recipes here (any format)...&#10;&#10;Example:&#10;Latte - $5.50&#10;- 2 oz Espresso&#10;- 8 oz Milk"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="min-h-[200px]"
                data-testid="textarea-text-input"
              />
            </TabsContent>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {result && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">{result.message}</p>
                    <div className="text-sm">
                      <p>✓ Imported: {result.imported} recipes</p>
                      {result.skipped > 0 && (
                        <p className="text-destructive">✗ Skipped: {result.skipped} recipes</p>
                      )}
                    </div>
                    {result.errors && result.errors.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-sm font-semibold">Errors:</p>
                        {result.errors.slice(0, 5).map((err, idx) => (
                          <p key={idx} className="text-xs text-destructive">
                            {err.recipe}: {err.error}
                          </p>
                        ))}
                        {result.errors.length > 5 && (
                          <p className="text-xs text-muted-foreground">
                            ... and {result.errors.length - 5} more errors
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isUploading}
                data-testid="button-cancel"
              >
                {result ? "Close" : "Cancel"}
              </Button>
              {!result && (
                <Button
                  onClick={getImportHandler()}
                  disabled={isImportDisabled()}
                  data-testid="button-import"
                >
                  {isUploading ? "Importing..." : "Import Recipes"}
                </Button>
              )}
              {result && result.imported > 0 && (
                <Button
                  onClick={handleClose}
                  data-testid="button-done"
                >
                  Done
                </Button>
              )}
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
