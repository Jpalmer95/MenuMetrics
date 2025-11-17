import { useState } from "react";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import recipes");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Recipes</DialogTitle>
          <DialogDescription>
            Upload an Excel or CSV file to import multiple recipes at once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">File Format (one row per ingredient):</p>
                <ul className="text-sm space-y-1 ml-4 list-disc">
                  <li><strong>Recipe Name</strong> - Name of the recipe (repeat for each ingredient)</li>
                  <li><strong>Category</strong> - beverages, pastries, sandwiches, etc.</li>
                  <li><strong>Serving Size</strong> - Number of servings (e.g., "12 oz", "1")</li>
                  <li><strong>Menu Price</strong> - Optional selling price</li>
                  <li><strong>Description</strong> - Optional recipe description</li>
                  <li><strong>Ingredient Name</strong> - Must match existing ingredient exactly</li>
                  <li><strong>Quantity</strong> - Amount of ingredient</li>
                  <li><strong>Unit</strong> - cups, ounces, grams, etc.</li>
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
            <Button
              onClick={handleUpload}
              disabled={!file || isUploading}
              data-testid="button-upload"
            >
              {isUploading ? "Importing..." : "Import Recipes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
