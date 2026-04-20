import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Users, Plus, Pencil, Trash2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Employee } from "@shared/schema";

const employeeFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  role: z.string().max(50).optional(),
  isActive: z.boolean().default(true),
});

type EmployeeFormData = z.infer<typeof employeeFormSchema>;

function EmployeeFormDialog({
  employee,
  open,
  onOpenChange,
}: {
  employee?: Employee;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const isEditing = !!employee;

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      name: employee?.name || "",
      role: employee?.role || "",
      isActive: employee?.isActive ?? true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: EmployeeFormData) => {
      const response = await apiRequest("POST", "/api/employees", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Employee added" });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to add employee", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: EmployeeFormData) => {
      const response = await apiRequest("PATCH", `/api/employees/${employee!.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Employee updated" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to update employee", variant: "destructive" });
    },
  });

  const onSubmit = (data: EmployeeFormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Employee" : "Add Employee"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update employee details" : "Add a new employee for waste logging"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., John Smith" {...field} data-testid="input-employee-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Cook, Barista, Manager" {...field} data-testid="input-employee-role" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel>Active</FormLabel>
                    <p className="text-sm text-muted-foreground">Employee can log waste entries</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-employee-active" />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-employee">
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? "Save Changes" : "Add Employee"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function EmployeesPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | undefined>();

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/employees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Employee removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove employee", variant: "destructive" });
    },
  });

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingEmployee(undefined);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-employees">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Employees
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage employees for waste logging (Business tier feature)
          </p>
        </div>
        <Button onClick={handleAdd} data-testid="button-add-employee">
          <Plus className="h-4 w-4 mr-2" />
          Add Employee
        </Button>
      </div>

      {employees.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-lg">No employees yet</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Add employees to track who logs waste entries
            </p>
            <Button onClick={handleAdd} className="mt-4" data-testid="button-add-first-employee">
              <Plus className="h-4 w-4 mr-2" />
              Add First Employee
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id} data-testid={`employee-row-${employee.id}`}>
                  <TableCell className="font-medium">{employee.name}</TableCell>
                  <TableCell>{employee.role || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={employee.isActive ? "default" : "secondary"}>
                      {employee.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(employee)}
                        data-testid={`button-edit-${employee.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            data-testid={`button-delete-${employee.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Employee</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove {employee.name}? Existing waste logs will keep their records.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(employee.id)}>
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <EmployeeFormDialog
        employee={editingEmployee}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
