import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Loader2, Upload, FileText, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { InsertRecipe } from "@shared/schema";

interface ImportRecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (recipe: any) => void;
}

export function ImportRecipeDialog({
  open,
  onOpenChange,
  onImport,
}: ImportRecipeDialogProps) {
  const [recipeText, setRecipeText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [parsedRecipe, setParsedRecipe] = useState<any>(null);
  const { toast } = useToast();

  const parseRecipeMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      
      if (imageFile) {
        formData.append("image", imageFile);
      } else if (recipeText.trim()) {
        formData.append("recipeText", recipeText);
      } else {
        throw new Error("Please provide recipe text or upload an image");
      }

      const response = await fetch("/api/ai/parse-recipe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to parse recipe");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setParsedRecipe(data);
      toast({
        title: "Recipe Parsed",
        description: "AI has extracted the recipe data. Review and import below.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to parse recipe",
        variant: "destructive",
      });
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleImport = () => {
    if (parsedRecipe) {
      onImport(parsedRecipe);
      handleClose();
    }
  };

  const handleClose = () => {
    setRecipeText("");
    setImageFile(null);
    setImagePreview(null);
    setParsedRecipe(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Import Recipe with AI
          </DialogTitle>
          <DialogDescription>
            Paste recipe text or upload an image, and AI will extract the recipe details automatically
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!parsedRecipe ? (
            <>
              <Tabs defaultValue="text" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="text" data-testid="tab-text">
                    <FileText className="h-4 w-4 mr-2" />
                    Paste Text
                  </TabsTrigger>
                  <TabsTrigger value="image" data-testid="tab-image">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Image
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="text" className="space-y-3">
                  <div>
                    <Label htmlFor="recipe-text">Recipe Text</Label>
                    <Textarea
                      id="recipe-text"
                      placeholder="Paste your recipe here... Include the recipe name, ingredients with quantities, and instructions if available."
                      value={recipeText}
                      onChange={(e) => setRecipeText(e.target.value)}
                      rows={12}
                      className="font-mono text-sm"
                      data-testid="textarea-recipe-text"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="image" className="space-y-3">
                  <div>
                    <Label htmlFor="recipe-image">Recipe Image</Label>
                    <div className="mt-2">
                      {!imagePreview ? (
                        <label htmlFor="recipe-image">
                          <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors">
                            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                            <p className="text-sm text-muted-foreground mb-1">
                              Click to upload a recipe image
                            </p>
                            <p className="text-xs text-muted-foreground">
                              JPG, PNG, or HEIC (max 5MB)
                            </p>
                          </div>
                          <input
                            id="recipe-image"
                            type="file"
                            accept="image/*"
                            onChange={handleImageSelect}
                            className="hidden"
                            data-testid="input-recipe-image"
                          />
                        </label>
                      ) : (
                        <div className="relative">
                          <img
                            src={imagePreview}
                            alt="Recipe preview"
                            className="w-full rounded-lg border"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2"
                            onClick={handleRemoveImage}
                            data-testid="button-remove-image"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                  disabled={parseRecipeMutation.isPending}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => parseRecipeMutation.mutate()}
                  disabled={parseRecipeMutation.isPending || (!recipeText.trim() && !imageFile)}
                  className="flex-1"
                  data-testid="button-parse-recipe"
                >
                {parseRecipeMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Parsing with AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Parse Recipe with AI
                  </>
                )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Card className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-lg">{parsedRecipe.name}</h3>
                  {parsedRecipe.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {parsedRecipe.description}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Badge variant="outline">
                    {parsedRecipe.category?.replace(/_/g, ' ') || 'other'}
                  </Badge>
                  <Badge variant="outline">
                    {parsedRecipe.servings} serving{parsedRecipe.servings > 1 ? 's' : ''}
                  </Badge>
                  <Badge variant="outline">
                    {parsedRecipe.ingredients?.length || 0} ingredients
                  </Badge>
                </div>

                <div>
                  <h4 className="font-medium text-sm mb-2">Ingredients:</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    {parsedRecipe.ingredients?.map((ing: any, idx: number) => (
                      <li key={idx}>
                        {ing.quantity} {ing.unit} {ing.ingredientName}
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setParsedRecipe(null)}
                  className="flex-1"
                  data-testid="button-parse-again"
                >
                  Parse Again
                </Button>
                <Button
                  onClick={handleImport}
                  className="flex-1"
                  data-testid="button-import-recipe"
                >
                  Import Recipe
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
