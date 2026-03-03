import { z } from "zod";

export const loadFormSchema = z.object({
  referenceNumber: z.string().min(1, "Reference number is required").max(50),
  originName: z.string().min(1, "Origin name is required"),
  originAddress: z.string().min(1, "Origin address is required"),
  originLat: z.string().optional().or(z.literal("")),
  originLng: z.string().optional().or(z.literal("")),
  destinationName: z.string().min(1, "Destination name is required"),
  destinationAddress: z.string().min(1, "Destination address is required"),
  destinationLat: z.string().optional().or(z.literal("")),
  destinationLng: z.string().optional().or(z.literal("")),
  pickupDate: z.string().min(1, "Pickup date is required"),
  deliveryDate: z.string().optional().or(z.literal("")),
  commodity: z.string().optional().or(z.literal("")),
  weightLbs: z.string().optional().or(z.literal("")),
  specialInstructions: z.string().optional().or(z.literal("")),
  rateDollars: z.string().optional().or(z.literal("")),
  carrierId: z.string().optional().or(z.literal("")),
});

export type LoadFormValues = z.infer<typeof loadFormSchema>;

export function generateReferenceNumber(): string {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, "0") +
    now.getDate().toString().padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000).toString();
  return "FV-" + dateStr + "-" + rand;
}
