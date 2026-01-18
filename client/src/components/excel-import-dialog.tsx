import { useState, useCallback } from "react";
import { Upload, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ExcelJS from "exceljs";

interface ExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (file: File, mapping: Record<string, string>) => void;
  isLoading?: boolean;
}

interface ColumnMapping {
  excelColumn: string;
  mappedTo: string;
}

const requiredFields = [
  { key: "name", label: "Ingredient Name" },
  { key: "category", label: "Category" },
  { key: "purchaseQuantity", label: "Purchase Quantity (or combined with unit like '64oz')" },
  { key: "purchaseCost", label: "Purchase Cost" },
];

const optionalFields = [
  { key: "purchaseUnit", label: "Purchase Unit (optional - leave blank if combined with quantity)" },
  { key: "store", label: "Store (optional)" },
  { key: "gramsPerMilliliter", label: "Density g/mL (optional)" },
  { key: "densitySource", label: "Density Source (optional)" },
  { key: "isPackaging", label: "Packaging? (optional)" },
];

export function ExcelImportDialog({
  open,
  onOpenChange,
  onImport,
  isLoading,
}: ExcelImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"upload" | "mapping">("upload");

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith(".xlsx") || droppedFile.name.endsWith(".xls"))) {
      processFile(droppedFile);
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  }, []);

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      const worksheet = workbook.worksheets[0];
      
      // Convert worksheet to JSON array
      const jsonData: any[] = [];
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
            jsonData.push(rowData);
          }
        }
      });
      
      if (jsonData.length > 0) {
        const columns = Object.keys(jsonData[0] as any);
        setExcelColumns(columns);
        setPreviewData(jsonData.slice(0, 5));
        
        const autoMapping: Record<string, string> = {};
        [...requiredFields, ...optionalFields].forEach((field) => {
          const found = columns.find((col) =>
            col.toLowerCase().includes(field.key.toLowerCase()) ||
            field.label.toLowerCase().includes(col.toLowerCase()) ||
            col.toLowerCase().replace(/[^a-z]/g, '').includes(field.key.toLowerCase().replace(/[^a-z]/g, ''))
          );
          if (found) {
            autoMapping[field.key] = found;
          }
        });
        setColumnMapping(autoMapping);
        setStep("mapping");
      }
    } catch (error) {
      console.error("Error processing Excel file:", error);
    }
  };

  const handleImport = () => {
    if (file) {
      const allMapped = requiredFields.every((field) => columnMapping[field.key]);
      if (!allMapped) {
        return;
      }
      onImport(file, columnMapping);
      resetDialog();
    }
  };

  const resetDialog = () => {
    setFile(null);
    setExcelColumns([]);
    setPreviewData([]);
    setColumnMapping({});
    setStep("upload");
  };

  const handleClose = () => {
    onOpenChange(false);
    resetDialog();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Excel Spreadsheet</DialogTitle>
          <DialogDescription>
            {step === "upload" 
              ? "Upload an Excel file containing your ingredient data"
              : "Map your Excel columns to ingredient fields"}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" ? (
          <div className="space-y-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-md p-8 text-center transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileInput}
                className="hidden"
                id="excel-upload"
                data-testid="input-excel-file"
              />
              <label
                htmlFor="excel-upload"
                className="cursor-pointer flex flex-col items-center gap-3"
              >
                <div className="rounded-full bg-primary/10 p-4">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Drop your Excel file here or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports .xlsx and .xls formats
                  </p>
                </div>
              </label>
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                Your Excel file should contain columns for ingredient name, category, purchase quantity, 
                purchase unit, and purchase cost. In the next step, you'll map your columns to these fields.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Column Mapping</CardTitle>
                <CardDescription>
                  Map your Excel columns to the required ingredient fields
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 mb-4">
                  <p className="text-sm font-semibold text-foreground">Required Fields</p>
                  {requiredFields.map((field) => (
                    <div key={field.key} className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-sm font-medium">{field.label}</label>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <Select
                          value={columnMapping[field.key] || ""}
                          onValueChange={(value) =>
                            setColumnMapping({ ...columnMapping, [field.key]: value })
                          }
                        >
                          <SelectTrigger data-testid={`select-map-${field.key}`}>
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            {excelColumns.map((col) => (
                              <SelectItem key={col} value={col}>
                                {col}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">Optional Fields</p>
                  {optionalFields.map((field) => (
                    <div key={field.key} className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-sm font-medium text-muted-foreground">{field.label}</label>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <Select
                          value={columnMapping[field.key] || "__skip__"}
                          onValueChange={(value) => {
                            if (value === "__skip__") {
                              const newMapping = { ...columnMapping };
                              delete newMapping[field.key];
                              setColumnMapping(newMapping);
                            } else {
                              setColumnMapping({ ...columnMapping, [field.key]: value });
                            }
                          }}
                        >
                          <SelectTrigger data-testid={`select-map-${field.key}`}>
                            <SelectValue placeholder="(skip)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__skip__">Skip this field</SelectItem>
                            {excelColumns.map((col) => (
                              <SelectItem key={col} value={col}>
                                {col}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Preview (First 5 Rows)</CardTitle>
                <CardDescription>
                  Review your data before importing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        {excelColumns.map((col) => (
                          <th key={col} className="px-2 py-1 text-left font-medium">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, idx) => (
                        <tr key={idx} className="border-b">
                          {excelColumns.map((col) => (
                            <td key={col} className="px-2 py-1 text-muted-foreground">
                              {String(row[col] || "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          {step === "mapping" && (
            <Button
              variant="outline"
              onClick={() => setStep("upload")}
              disabled={isLoading}
              data-testid="button-back-to-upload"
            >
              Back
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            data-testid="button-cancel-import"
          >
            Cancel
          </Button>
          {step === "mapping" && (
            <Button
              onClick={handleImport}
              disabled={
                isLoading ||
                !requiredFields.every((field) => columnMapping[field.key])
              }
              data-testid="button-submit-import"
            >
              {isLoading ? "Importing..." : `Import ${previewData.length}+ Items`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
