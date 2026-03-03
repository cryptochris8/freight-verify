"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const carrierFormSchema = z.object({
  dotNumber: z
    .string()
    .min(1, "DOT number is required")
    .max(10, "DOT number must be 10 characters or less")
    .regex(/^d+$/, "DOT number must contain only digits"),
  mcNumber: z
    .string()
    .max(10, "MC number must be 10 characters or less")
    .regex(/^d*$/, "MC number must contain only digits")
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .email("Please enter a valid email address")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .max(20, "Phone number is too long")
    .optional()
    .or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

type CarrierFormValues = z.infer<typeof carrierFormSchema>;

interface CarrierFormProps {
  defaultValues?: Partial<CarrierFormValues>;
  onSubmit: (values: CarrierFormValues) => void | Promise<void>;
  isLoading?: boolean;
}

export function CarrierForm({
  defaultValues,
  onSubmit,
  isLoading = false,
}: CarrierFormProps) {
  const form = useForm<CarrierFormValues>({
    resolver: zodResolver(carrierFormSchema),
    defaultValues: {
      dotNumber: "",
      mcNumber: "",
      email: "",
      phone: "",
      notes: "",
      ...defaultValues,
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Carrier Information</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="dotNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>DOT Number *</FormLabel>
                  <FormControl>
                    <Input placeholder="1234567" {...field} />
                  </FormControl>
                  <FormDescription>
                    USDOT number triggers an automatic FMCSA lookup.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mcNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>MC Number</FormLabel>
                  <FormControl>
                    <Input placeholder="123456" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="dispatch@carrier.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="(555) 123-4567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Input placeholder="Additional notes..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Carrier"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
