import { useState } from "react";
import { Plus, Search, Edit, Trash2, Mail, Phone, Building, MoreHorizontal, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useContactsByOrg, useCreateContact, useUpdateContact, useDeleteContact, useSearchContacts } from "@/hooks/repository-hooks/use-contacts";
import { useOrganizationContext } from "@/contexts/organization-context";
import { ContactData, Contact } from "@/core";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

interface ContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  tags: string[];
  notes?: string;
  status: "active" | "inactive" | "prospect" | "customer" | "lead";
  preferences: {
    preferredContactMethod: "email" | "phone" | "sms";
    marketingOptIn: boolean;
    newsletterOptIn: boolean;
  };
  socialMedia?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
  };
}

export default function ContactsPage() {
  const { currentOrganization } = useOrganizationContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);

  // Queries
  const { data: contacts = [], isLoading: isLoadingContacts, error } = useContactsByOrg(currentOrganization?.id);
  const { data: searchResults = [] } = useSearchContacts(currentOrganization?.id, searchTerm);

  console.log(error);
  
  // Mutations
  const createContactMutation = useCreateContact();
  const updateContactMutation = useUpdateContact();
  const deleteContactMutation = useDeleteContact();

  // Form handling
  const form = useForm<ContactFormData>({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      company: "",
      jobTitle: "",
      address: {
        street: "",
        city: "",
        state: "",
        zipCode: "",
        country: "",
      },
      tags: [],
      notes: "",
      status: "lead",
      preferences: {
        preferredContactMethod: "email",
        marketingOptIn: false,
        newsletterOptIn: false,
      },
      socialMedia: {
        linkedin: "",
        twitter: "",
        facebook: "",
        instagram: "",
      },
    },
  });

  const displayedContacts = searchTerm.trim() ? searchResults : contacts;

  const handleCreateContact = async (data: ContactFormData) => {
    if (!currentOrganization?.id) return;

    // Normalize email for comparison
    const normalizedEmail = data.email.trim().toLowerCase();

    // Check if contact with this email already exists
    const existingContact = contacts.find((contact) => {
      const contactData = contact.data || contact;
      const contactEmail = (contactData.email || "").trim().toLowerCase();
      return contactEmail === normalizedEmail;
    });

    if (existingContact) {
      // Contact exists - update it and merge phone numbers
      const existingContactData = existingContact.data || existingContact;
      const existingPhones = Array.isArray(existingContactData.phone)
        ? existingContactData.phone
        : existingContactData.phone
        ? [existingContactData.phone]
        : [];

      const newPhone = data.phone?.trim();
      const updatedPhones = [...existingPhones];

      // Add new phone if it's different and not already in the list
      if (newPhone && !existingPhones.includes(newPhone)) {
        updatedPhones.push(newPhone);
      }

      // Prepare update data
      const updateData: Partial<ContactData> = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: updatedPhones.length > 0 ? updatedPhones : [],
        company: data.company,
        jobTitle: data.jobTitle,
        address: data.address,
        tags: data.tags,
        notes: data.notes,
        status: data.status,
        preferences: data.preferences,
        socialMedia: data.socialMedia,
        organizationId: currentOrganization.id,
      };

      try {
        await updateContactMutation.mutateAsync({
          id: existingContact.id,
          data: updateData,
        });
        setIsCreateDialogOpen(false);
        form.reset();
        toast.success(
          newPhone && !existingPhones.includes(newPhone)
            ? "Contact updated. New phone number added."
            : "Contact updated."
        );
      } catch (error) {
        console.error("Failed to update contact:", error);
        toast.error("Failed to update contact");
      }
      return;
    }

    // No existing contact - create new one
    const contactData: ContactData = {
      ...data,
      phone: data.phone?.trim() ? [data.phone.trim()] : [],
      organizationId: currentOrganization.id,
    };

    try {
      await createContactMutation.mutateAsync(contactData);
      setIsCreateDialogOpen(false);
      form.reset();
      toast.success("Contact created successfully");
    } catch (error) {
      console.error("Failed to create contact:", error);
      toast.error("Failed to create contact");
    }
  };

  const handleUpdateContact = async (data: ContactFormData) => {
    if (!editingContact?.id) return;

    // Get existing phone numbers
    const existingContactData = editingContact.data || editingContact;
    const existingPhones = Array.isArray(existingContactData.phone)
      ? existingContactData.phone
      : existingContactData.phone
      ? [existingContactData.phone]
      : [];

    // If new phone is provided and different, add it to the list
    const newPhone = data.phone?.trim();
    const updatedPhones = [...existingPhones];
    if (newPhone && !existingPhones.includes(newPhone)) {
      updatedPhones.push(newPhone);
    }

    try {
      await updateContactMutation.mutateAsync({
        id: editingContact.id,
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: updatedPhones.length > 0 ? updatedPhones : [],
          company: data.company,
          jobTitle: data.jobTitle,
          address: data.address,
          tags: data.tags,
          notes: data.notes,
          status: data.status,
          preferences: data.preferences,
          socialMedia: data.socialMedia,
          organizationId: currentOrganization?.id || "",
        },
      });
      setIsEditDialogOpen(false);
      setEditingContact(null);
      form.reset();
      toast.success("Contact updated successfully");
    } catch (error) {
      console.error("Failed to update contact:", error);
      toast.error("Failed to update contact");
    }
  };

  const handleDeleteContact = async () => {
    if (!deleteContactId) return;

    try {
      await deleteContactMutation.mutateAsync(deleteContactId);
      setDeleteContactId(null);
    } catch (error) {
      console.error("Failed to delete contact:", error);
    }
  };

  const openEditDialog = (contact: Contact) => {
    setEditingContact(contact);
    // Handle both direct data structure and nested data structure
    const contactData = contact.data || contact;
    
    form.reset({
      firstName: contactData.firstName || "",
      lastName: contactData.lastName || "",
      email: contactData.email || "",
      phone: Array.isArray(contactData.phone)
        ? contactData.phone[0] || ""
        : contactData.phone || "",
      company: contactData.company || "",
      jobTitle: contactData.jobTitle || "",
      address: contactData.address || {
        street: "",
        city: "",
        state: "",
        zipCode: "",
        country: "",
      },
      tags: contactData.tags || [],
      notes: contactData.notes || "",
      status: contactData.status || "lead",
      preferences: contactData.preferences || {
        preferredContactMethod: "email",
        marketingOptIn: false,
        newsletterOptIn: false,
      },
      socialMedia: contactData.socialMedia || {
        linkedin: "",
        twitter: "",
        facebook: "",
        instagram: "",
      },
    });
    setIsEditDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800";
      case "customer": return "bg-blue-100 text-blue-800";
      case "prospect": return "bg-yellow-100 text-yellow-800";
      case "lead": return "bg-purple-100 text-purple-800";
      case "inactive": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoadingContacts) {
    return (
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 w-full overflow-x-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-0.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Contacts</h1>
            <p className="text-sm text-muted-foreground">Manage your customer contacts</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading contacts...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground">Manage your customer contacts</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] w-[95vw] sm:w-full overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Contact</DialogTitle>
              <DialogDescription>
                Add a new customer contact to your organization.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleCreateContact)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    {...form.register("firstName", { required: "First name is required" })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    {...form.register("lastName", { required: "Last name is required" })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    {...form.register("email", { required: "Email is required" })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    {...form.register("phone")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    {...form.register("company")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">Job Title</Label>
                  <Input
                    id="jobTitle"
                    {...form.register("jobTitle")}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.watch("status")}
                  onValueChange={(value) => form.setValue("status", value as ContactFormData["status"])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  {...form.register("notes")}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createContactMutation.isPending}>
                  {createContactMutation.isPending ? "Creating..." : "Create Contact"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Stats */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Card className="p-2.5 sm:p-3 shrink-0">
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{displayedContacts.length}</span>
            <span className="text-sm text-muted-foreground hidden sm:inline">contacts</span>
          </div>
        </Card>
      </div>

      {/* Contacts List */}
      {displayedContacts.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <User className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-semibold">No contacts</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchTerm.trim() 
                ? "No contacts match your search criteria."
                : "Get started by creating your first contact."
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table View */}
          <Card className="hidden md:block">
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedContacts.map((contact) => {
                      const contactData = contact.data || contact;
                      
                      if (!contact || !contact.id) {
                        return null;
                      }
                      
                      return (
                        <TableRow key={contact.id}>
                          <TableCell className="font-medium">
                            {contactData.firstName || ''} {contactData.lastName || ''}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span>{contactData.email || ''}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {contactData.company && (
                              <div className="flex items-center space-x-2">
                                <Building className="h-4 w-4 text-muted-foreground" />
                                <span>{contactData.company}</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(contactData.status || 'lead')}>
                              {contactData.status || 'lead'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const phones = Array.isArray(contactData.phone)
                                ? contactData.phone
                                : contactData.phone
                                ? [contactData.phone]
                                : [];
                              return phones.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                  {phones.map((phone, idx) => (
                                    <div key={idx} className="flex items-center space-x-2">
                                      <Phone className="h-4 w-4 text-muted-foreground" />
                                      <span>{phone}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : null;
                            })()}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(contact)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => setDeleteContactId(contact.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3 pt-5">
            {displayedContacts.map((contact) => {
              const contactData = contact.data || contact;
              
              if (!contact || !contact.id) {
                return null;
              }

              const phones = Array.isArray(contactData.phone)
                ? contactData.phone
                : contactData.phone
                ? [contactData.phone]
                : [];

              return (
                <Card key={contact.id} className="p-3">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">
                          {contactData.firstName || ''} {contactData.lastName || ''}
                        </h3>
                        {contactData.company && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {contactData.company}
                          </p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(contact)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => setDeleteContactId(contact.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="space-y-2 text-xs">
                      {contactData.email && (
                        <div className="flex items-center space-x-2">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{contactData.email}</span>
                        </div>
                      )}
                      {phones.length > 0 && (
                        <div className="flex items-center space-x-2">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>{phones[0]}</span>
                          {phones.length > 1 && (
                            <span className="text-muted-foreground">+{phones.length - 1} more</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <Badge className={getStatusColor(contactData.status || 'lead')} variant="outline">
                        {contactData.status || 'lead'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(contact)}
                        className="h-7 text-xs"
                      >
                        <Edit className="h-3.5 w-3.5 mr-1.5" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Edit Contact Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] w-[95vw] sm:w-full overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>
              Update the contact information.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleUpdateContact)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-firstName">First Name *</Label>
                <Input
                  id="edit-firstName"
                  {...form.register("firstName", { required: "First name is required" })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lastName">Last Name *</Label>
                <Input
                  id="edit-lastName"
                  {...form.register("lastName", { required: "Last name is required" })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  {...form.register("email", { required: "Email is required" })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  {...form.register("phone")}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-company">Company</Label>
                <Input
                  id="edit-company"
                  {...form.register("company")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-jobTitle">Job Title</Label>
                <Input
                  id="edit-jobTitle"
                  {...form.register("jobTitle")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(value) => form.setValue("status", value as ContactFormData["status"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                rows={3}
                {...form.register("notes")}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateContactMutation.isPending}>
                {updateContactMutation.isPending ? "Updating..." : "Update Contact"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteContactId} onOpenChange={() => setDeleteContactId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the contact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContact}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
