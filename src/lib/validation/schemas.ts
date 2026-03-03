import { z } from "zod";

// ── Carrier schemas ──────────────────────────────────────────────
export const carrierCreateSchema = z.object({
  dotNumber: z
    .string()
    .min(1, "DOT number is required")
    .max(10, "DOT number must be 10 digits or fewer")
    .regex(/^\d{1,10}$/, "DOT number must be 1-10 digits"),
  mcNumber: z
    .string()
    .max(10, "MC number must be 10 characters or fewer")
    .regex(/^\d{0,10}$/, "MC number must be numeric")
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .email("Invalid email address")
    .max(255)
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .max(20, "Phone number is too long")
    .regex(/^[\d\s\-\+\(\)]*$/, "Invalid phone number format")
    .optional()
    .or(z.literal("")),
  legalName: z.string().optional().or(z.literal("")),
  dbaName: z.string().optional().or(z.literal("")),
});

export type CarrierCreateInput = z.infer<typeof carrierCreateSchema>;

// ── Load schemas ─────────────────────────────────────────────────
export const loadCreateSchema = z
  .object({
    referenceNumber: z
      .string()
      .min(1, "Reference number is required")
      .max(50, "Reference number is too long")
      .regex(/^[A-Za-z0-9\-_]+$/, "Reference number can only contain letters, numbers, hyphens, and underscores"),
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
    commodity: z.string().max(200).optional().or(z.literal("")),
    weightLbs: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine(
        (val) => !val || (Number(val) > 0 && Number.isFinite(Number(val))),
        "Weight must be a positive number"
      ),
    specialInstructions: z.string().max(2000).optional().or(z.literal("")),
    rateDollars: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine(
        (val) => !val || (Number(val) > 0 && Number.isFinite(Number(val))),
        "Rate must be a positive number"
      ),
    carrierId: z.string().uuid("Invalid carrier ID").optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      if (data.pickupDate && data.deliveryDate) {
        return new Date(data.pickupDate) <= new Date(data.deliveryDate);
      }
      return true;
    },
    {
      message: "Pickup date must be before or equal to delivery date",
      path: ["deliveryDate"],
    }
  );

export type LoadCreateInput = z.infer<typeof loadCreateSchema>;

// ── Verification schemas ─────────────────────────────────────────
export const otpVerifySchema = z.object({
  loadId: z.string().uuid("Invalid load ID"),
  otp: z
    .string()
    .length(6, "OTP must be exactly 6 digits")
    .regex(/^\d{6}$/, "OTP must be exactly 6 digits"),
});

export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;

export const arrivalSchema = z.object({
  loadId: z.string().uuid("Invalid load ID"),
  lat: z.number().min(-90).max(90, "Latitude must be between -90 and 90"),
  lng: z.number().min(-180).max(180, "Longitude must be between -180 and 180"),
  accuracy: z.number().min(0).optional().default(0),
});

export type ArrivalInput = z.infer<typeof arrivalSchema>;

export const geoCoordinateSchema = z.object({
  lat: z.number().min(-90, "Latitude must be >= -90").max(90, "Latitude must be <= 90"),
  lng: z.number().min(-180, "Longitude must be >= -180").max(180, "Longitude must be <= 180"),
});

// ── Alert schemas ────────────────────────────────────────────────
export const alertAcknowledgeSchema = z.object({
  notes: z
    .string()
    .max(1000, "Notes must be 1000 characters or fewer")
    .optional()
    .or(z.literal("")),
});

export type AlertAcknowledgeInput = z.infer<typeof alertAcknowledgeSchema>;

// ── Message schemas ──────────────────────────────────────────────
export const messageCreateSchema = z.object({
  content: z
    .string()
    .min(1, "Message content cannot be empty")
    .max(5000, "Message must be 5000 characters or fewer")
    .refine((val) => val.trim().length > 0, "Message content cannot be empty"),
});

export type MessageCreateInput = z.infer<typeof messageCreateSchema>;

// ── Billing schemas ──────────────────────────────────────────────
export const checkoutSchema = z.object({
  tier: z.enum(["starter", "professional", "business"]),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
